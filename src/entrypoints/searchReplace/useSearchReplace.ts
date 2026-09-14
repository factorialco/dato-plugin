import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildClient } from '@datocms/cma-client-browser'
import type { RenderPageCtx } from 'datocms-plugin-sdk'
import type { Match, MatchOptions } from './replaceEngine'
import { transformRecord } from './replaceEngine'
import type {
  FullRecord,
  SchemaIndex,
  SearchableModel
} from './searchReplace.services'
import {
  applyToRecord,
  fetchDatoLocaleByTld,
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
    () => ({ find, replace, caseSensitive, wholeWord }),
    [find, replace, caseSensitive, wholeWord]
  )

  const loadingSchema = Boolean(client) && !schema && !loadError

  const setupError =
    loadError ??
    (client
      ? null
      : 'This plugin needs your DatoCMS access token. Enable “Grant access to current user’s API token” in the plugin settings.')

  const canScan =
    phase === 'idle' &&
    Boolean(client && schema && model?.slugFieldApiKey && find) &&
    searchableTargets(targets).length > 0

  const scan = useCallback(async () => {
    if (!client || !schema || !model) {
      return
    }

    setPhase('scanning')
    setRows([])
    setSelectedKeys(new Set())

    try {
      const searchable = searchableTargets(targets)
      const locales = [
        ...new Set(searchable.map((target) => target.datoLocale as string))
      ]
      const pathIndex = await fetchPathIndex(client, model, locales)

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
          const { matches } = transformRecord({
            record,
            itemTypeId: model.id,
            fieldsByItemType: schema.fieldsByItemType,
            namesByItemType: schema.namesByItemType,
            options,
            locale: target.datoLocale
          })

          scanned.push({
            target,
            status: matches.length > 0 ? 'matched' : 'no-matches',
            recordId,
            record,
            matches,
            message: null
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
        new Set(scanned.flatMap((row) => row.matches.map((match) => match.key)))
      )
      setPhase('reviewing')
    } catch (error) {
      setLoadError(errorMessage(error))
      setPhase('idle')
    } finally {
      setProgress(null)
    }
  }, [client, schema, model, targets, options])

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
        if (selected) {
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
        } catch (error) {
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
    },
    [client, schema, model, options, selectedKeys, publishIfPublished]
  )

  const pendingRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status === 'matched' &&
          row.matches.some((match) => selectedKeys.has(match.key))
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
  }, [])

  return {
    phase,
    loadingSchema,
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
    handleScan: scan,
    handleToggleKey: toggleKey,
    handleToggleRow: setRowSelection,
    applyRows,
    handleReset: reset
  }
}
