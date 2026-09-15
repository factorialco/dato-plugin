import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildClient } from '@datocms/cma-client-browser'
import type { RenderPageCtx } from 'datocms-plugin-sdk'
import { readParameters } from '../../lib/pluginParameters'
import { buildLinkOptions } from './linkTargets'
import { urlSearchVariants } from './urlVariants'
import type {
  LinkConvention,
  LinkOptions,
  Match,
  MatchOptions,
  ScanReport,
  UnsearchedBlock
} from './replaceEngine'
import { transformRecord } from './replaceEngine'
import type {
  FullRecord,
  SchemaIndex,
  SearchableModel
} from './searchReplace.services'
import {
  applyToRecord,
  fetchDatoLocaleByTld,
  buildLinkResolver,
  fetchPathIndex,
  fetchRecord,
  fetchSchemaIndex
} from './searchReplace.services'
import type { ParsedTarget } from './urlTargets'
import { parseTargets, searchableTargets } from './urlTargets'

export type RowStatus =
  | 'skipped'
  | 'not-found'
  | 'no-matches'
  | 'matched'
  | 'applied'
  | 'error'

/**
 * Says what the scan could not look inside, so a page with no matches can be
 * told apart from a page that was not fully searched.
 */
const describeScan = (
  unsearched: UnsearchedBlock[],
  report: ScanReport,
  matched: boolean
): string | null => {
  if (unsearched.length === 0) {
    // Saying what was covered is what makes "no matches" an answer rather
    // than a shrug: a page walked end to end genuinely does not contain the
    // term, while one that opened no blocks never really looked.
    return matched
      ? null
      : `Searched ${report.values} value(s) in ${report.blocks} block(s)`
  }

  const notLoaded = unsearched.filter(
    (block) => block.reason === 'not-loaded'
  ).length
  const unknown = unsearched.length - notLoaded
  const parts = [
    notLoaded > 0 ? `${notLoaded} block(s) were not loaded` : null,
    unknown > 0
      ? `${unknown} block(s) are of a type this plugin has no fields for`
      : null
  ].filter(Boolean)

  return `Not fully searched (${report.values} value(s) in ${report.blocks} block(s)): ${parts.join(', ')} — ${unsearched[0].path}`
}

export type ScanRow = {
  target: ParsedTarget
  status: RowStatus
  recordId: string | null
  record: FullRecord | null
  matches: Match[]
  /** Why the row is in its current state, when that needs saying. */
  message: string | null
}

export type Phase = 'idle' | 'scanning' | 'reviewing' | 'applying'

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`

/**
 * Identifies the parameters a set of results belongs to.
 *
 * Applying re-walks each record with the *current* options and the enabled
 * keys collected during the scan, so the two have to agree: changing `find`
 * after a dry run and pressing Apply would otherwise write something the
 * preview never showed. Anything that changes which occurrences exist, or
 * what they become, belongs here — `publishIfPublished` does not, since it
 * only affects what happens after the rewrite.
 */
export const scanParametersSignature = (
  modelId: string | null,
  options: MatchOptions,
  targets: ParsedTarget[]
): string =>
  JSON.stringify({
    modelId,
    options,
    targets: searchableTargets(targets).map(
      (target) => `${target.datoLocale}::${target.contentPath}`
    )
  })

export const useSearchReplace = (ctx: RenderPageCtx) => {
  const [phase, setPhase] = useState<Phase>('idle')
  const [schema, setSchema] = useState<SchemaIndex | null>(null)
  const [datoLocaleByTld, setDatoLocaleByTld] = useState<
    Record<string, string>
  >({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const [modelId, setModelId] = useState<string | null>(null)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [urls, setUrls] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [publishIfPublished, setPublishIfPublished] = useState(false)

  const [rows, setRows] = useState<ScanRow[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  /**
   * What the current phase is waiting on. Building the path index pages
   * through every record of the model, which happens before the per-page
   * counter exists — without this the UI showed nothing at all until the
   * first page had been scanned.
   */
  const [stage, setStage] = useState<string | null>(null)

  const client = useMemo(() => {
    if (!ctx.currentUserAccessToken) {
      return null
    }

    return buildClient({
      apiToken: ctx.currentUserAccessToken,
      environment: ctx.environment
    })
  }, [ctx.currentUserAccessToken, ctx.environment])

  const siteLocales = useMemo(() => ctx.site.attributes.locales, [ctx.site])

  const linkConvention = useMemo<LinkConvention>(() => {
    const parameters = readParameters(ctx)

    return {
      linkTypeApiKey: parameters.linkTypeFieldApiKey,
      externalTypeValue: parameters.linkExternalTypeValue,
      externalUrlApiKey: parameters.linkExternalUrlFieldApiKey
    }
  }, [ctx])

  useEffect(() => {
    // The missing-token case is knowable during render, so it is derived below
    // rather than pushed into state from here.
    if (!client) {
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const [index, locales] = await Promise.all([
          fetchSchemaIndex(client),
          fetchDatoLocaleByTld(client)
        ])

        if (cancelled) {
          return
        }

        setSchema(index)
        setDatoLocaleByTld(locales)
      } catch (error) {
        if (cancelled) {
          return
        }

        setLoadError(errorMessage(error))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [client])

  const model = useMemo<SearchableModel | null>(
    () => schema?.models.find((candidate) => candidate.id === modelId) ?? null,
    [schema, modelId]
  )

  const targets = useMemo(
    () => parseTargets(urls, siteLocales, datoLocaleByTld),
    [urls, siteLocales, datoLocaleByTld]
  )

  const options = useMemo<MatchOptions>(
    () => ({
      find,
      replace,
      caseSensitive,
      wholeWord,
      // A URL is stored in more than one shape, so a URL search looks for all
      // of them and puts back the one it found.
      variants: urlSearchVariants(find, replace) ?? undefined
    }),
    [find, replace, caseSensitive, wholeWord]
  )

  const scanSignature = useMemo(
    () => scanParametersSignature(modelId, options, targets),
    [modelId, options, targets]
  )
  const [scannedSignature, setScannedSignature] = useState<string | null>(null)

  /** Results on screen no longer match the parameters in the form. */
  const resultsStale =
    phase === 'reviewing' &&
    scannedSignature !== null &&
    scannedSignature !== scanSignature

  const loadingSchema = Boolean(client) && !schema && !loadError

  const setupError =
    loadError ??
    (client
      ? null
      : 'This plugin needs your DatoCMS access token. Enable “Grant access to current user’s API token” in the plugin settings.')

  const canScan =
    phase !== 'scanning' &&
    phase !== 'applying' &&
    Boolean(client && schema && model?.slugFieldApiKey && find) &&
    searchableTargets(targets).length > 0

  const scan = useCallback(async () => {
    if (!client || !schema || !model) {
      return
    }

    setPhase('scanning')
    setRows([])
    setSelectedKeys(new Set())
    setStage(`Indexing ${model.name} records…`)

    try {
      const searchable = searchableTargets(targets)
      const locales = [
        ...new Set(searchable.map((target) => target.datoLocale as string))
      ]
      const [pathIndex, linkResolver] = await Promise.all([
        fetchPathIndex(client, model, locales),
        buildLinkResolver(client, schema, locales)
      ])

      // Links stored as record references render as a URL but hold an id, so
      // a text search cannot see them. Resolving ids to paths is what lets the
      // search match — and repoint — them.
      const link: LinkOptions | null = buildLinkOptions({
        find: options.find,
        replace: options.replace,
        resolver: linkResolver,
        convention: linkConvention
      })

      setStage(null)
      setProgress({ done: 0, total: searchable.length })

      const scanned: ScanRow[] = []

      for (const target of targets) {
        if (target.skipReason !== null) {
          scanned.push({
            target,
            status: 'skipped',
            recordId: null,
            record: null,
            matches: [],
            message: null
          })
          continue
        }

        const recordId = pathIndex
          .get(target.datoLocale as string)
          ?.get(target.contentPath as string)

        if (!recordId) {
          scanned.push({
            target,
            status: 'not-found',
            recordId: null,
            record: null,
            matches: [],
            message: `No ${model.name} with path ${target.contentPath} in ${target.datoLocale}`
          })
          setProgress((current) =>
            current ? { ...current, done: current.done + 1 } : current
          )
          continue
        }

        try {
          const record = await fetchRecord(client, recordId)
          const { matches, unsearched, report } = transformRecord({
            record,
            itemTypeId: model.id,
            fieldsByItemType: schema.fieldsByItemType,
            namesByItemType: schema.namesByItemType,
            options,
            locale: target.datoLocale,
            link
          })

          scanned.push({
            target,
            status: matches.length > 0 ? 'matched' : 'no-matches',
            recordId,
            record,
            matches,
            message: describeScan(unsearched, report, matches.length > 0)
          })
        } catch (error) {
          scanned.push({
            target,
            status: 'error',
            recordId,
            record: null,
            matches: [],
            message: errorMessage(error)
          })
        }

        setProgress((current) =>
          current ? { ...current, done: current.done + 1 } : current
        )
      }

      setRows(scanned)
      setSelectedKeys(
        // Only what can actually be rewritten: a reference the replacement
        // cannot be expressed as is reported, not selected.
        new Set(
          scanned.flatMap((row) =>
            row.matches
              .filter((match) => match.applicable)
              .map((match) => match.key)
          )
        )
      )
      setPhase('reviewing')
      setScannedSignature(scanSignature)

      const matched = scanned.filter((row) => row.matches.length > 0)
      const occurrences = scanned.reduce(
        (total, row) => total + row.matches.length,
        0
      )

      // A long scan can finish while the operator is looking elsewhere, and
      // "no matches" looks identical to "still running" without this.
      ctx.notice(
        occurrences === 0
          ? `Dry run finished — no matches in ${plural(scanned.length, 'page')}`
          : `Dry run finished — ${plural(occurrences, 'match', 'matches')} in ${plural(matched.length, 'page')}`
      )
    } catch (error) {
      setLoadError(errorMessage(error))
      setPhase('idle')
    } finally {
      setProgress(null)
      setStage(null)
    }
  }, [
    client,
    schema,
    model,
    targets,
    options,
    ctx,
    scanSignature,
    linkConvention
  ])

  const toggleKey = useCallback((key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current)

      if (!next.delete(key)) {
        next.add(key)
      }

      return next
    })
  }, [])

  const setRowSelection = useCallback((row: ScanRow, selected: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current)

      for (const match of row.matches) {
        if (selected && match.applicable) {
          next.add(match.key)
        } else {
          next.delete(match.key)
        }
      }

      return next
    })
  }, [])

  const applyRows = useCallback(
    async (toApply: ScanRow[]) => {
      if (!client || !schema || !model) {
        return
      }

      setPhase('applying')
      setProgress({ done: 0, total: toApply.length })

      let applied = 0
      let failed = 0

      for (const row of toApply) {
        const enabledKeys = new Set(
          row.matches
            .map((match) => match.key)
            .filter((key) => selectedKeys.has(key))
        )

        if (!row.record || enabledKeys.size === 0) {
          continue
        }

        try {
          const { changedFields } = transformRecord({
            record: row.record,
            itemTypeId: model.id,
            fieldsByItemType: schema.fieldsByItemType,
            namesByItemType: schema.namesByItemType,
            options,
            locale: row.target.datoLocale,
            enabledKeys
          })

          const outcome = await applyToRecord(
            client,
            row.record,
            changedFields,
            publishIfPublished
          )

          setRows((current) =>
            current.map((candidate) =>
              candidate.target.raw === row.target.raw
                ? {
                    ...candidate,
                    status: 'applied',
                    message: outcome.published
                      ? `${enabledKeys.size} replaced and republished`
                      : `${enabledKeys.size} replaced, saved as draft`
                  }
                : candidate
            )
          )
          applied += 1
        } catch (error) {
          failed += 1
          const message = errorMessage(error)

          setRows((current) =>
            current.map((candidate) =>
              candidate.target.raw === row.target.raw
                ? {
                    ...candidate,
                    status: 'error',
                    message: message.includes('STALE_ITEM_VERSION')
                      ? 'Record changed since the dry run — scan again'
                      : message
                  }
                : candidate
            )
          )
        }

        setProgress((current) =>
          current ? { ...current, done: current.done + 1 } : current
        )
      }

      setProgress(null)
      setPhase('reviewing')

      ctx.notice(
        failed === 0
          ? `Applied to ${plural(applied, 'page')}`
          : `Applied to ${plural(applied, 'page')}, ${failed} failed — see the rows below`
      )
    },
    [client, schema, model, options, selectedKeys, publishIfPublished, ctx]
  )

  const pendingRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status === 'matched' &&
          row.matches.some(
            (match) => match.applicable && selectedKeys.has(match.key)
          )
      ),
    [rows, selectedKeys]
  )

  const selectedCount = useMemo(
    () =>
      rows.reduce(
        (total, row) =>
          total +
          row.matches.filter((match) => selectedKeys.has(match.key)).length,
        0
      ),
    [rows, selectedKeys]
  )

  const reset = useCallback(() => {
    setRows([])
    setSelectedKeys(new Set())
    setPhase('idle')
    setScannedSignature(null)
  }, [])

  return {
    phase,
    loadingSchema,
    stage,
    setupError,
    schema,
    model,
    modelId,
    handleModelChange: setModelId,
    find,
    handleFindChange: setFind,
    replace,
    handleReplaceChange: setReplace,
    urls,
    handleUrlsChange: setUrls,
    caseSensitive,
    handleCaseSensitiveChange: setCaseSensitive,
    wholeWord,
    handleWholeWordChange: setWholeWord,
    publishIfPublished,
    handlePublishChange: setPublishIfPublished,
    targets,
    rows,
    selectedKeys,
    selectedCount,
    pendingRows,
    progress,
    canScan,
    resultsStale,
    handleScan: scan,
    handleToggleKey: toggleKey,
    handleToggleRow: setRowSelection,
    applyRows,
    handleReset: reset
  }
}
