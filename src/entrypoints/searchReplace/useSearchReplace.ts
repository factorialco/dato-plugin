import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildClient } from '@datocms/cma-client-browser'
import type { RenderPageCtx } from 'datocms-plugin-sdk'
import { readParameters } from '../../lib/pluginParameters'
import { buildLinkOptions, internalPathOf } from './linkTargets'
import { createRecordPathFinder } from './recordPaths'
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
  FieldLoader,
  FullRecord,
  LinkedRecordPayload,
  SchemaIndex,
  SearchableModel
} from './searchReplace.services'
import {
  MAX_RESOLVE_PASSES,
  applyToRecord,
  createFieldLoader,
  fetchDatoLocaleByTld,
  fetchLinkedRecords,
  fetchModelRecordStubs,
  fetchRecordsByIds,
  fetchSchemaIndex,
  SCAN_BATCH,
  SCAN_PARALLEL,
  chunked,
  mapWithLimit,
  loadModelDetails
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
    if (matched) {
      return null
    }

    const covered = `Searched ${report.values} value(s) in ${report.blocks} block(s) of ${report.itemTypes.length} type(s)`

    return report.skippedFieldTypes.length > 0
      ? `${covered} — skipped field types: ${report.skippedFieldTypes.join(', ')}`
      : covered
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
  /** Referenced records loaded with it, so applying can write to them too. */
  linked: Record<string, LinkedRecordPayload>
  /**
   * Records actually written, once applied.
   *
   * A change usually lands on records the page merely points at, and each has
   * to be published on its own. Listing them is what makes that possible —
   * otherwise the only thing left on screen is the page, which may not be
   * where anything changed.
   */
  written: Array<{ id: string; label: string; published: boolean }>
  matches: Match[]
  /** Why the row is in its current state, when that needs saying. */
  message: string | null
}

export type Phase = 'idle' | 'scanning' | 'reviewing' | 'applying'

/** Whether a scan is scoped to given page URLs or to a whole model. */
export type SearchScope = 'pages' | 'all'

/**
 * Past this many records, a scan is worth confirming before it starts: it is
 * one request per batch of thirty plus whatever each record references, and
 * the person asking may not have realised how large the model is.
 */
const LARGE_SCAN = 200

/**
 * Occurrences worth selecting: everything rewritable, minus repeats of a value
 * already covered by an earlier row.
 *
 * A shared component is reached from every page that uses it, so one stored
 * value appears under many pages. Selecting it once is the honest count, and
 * keeps "Apply all" from queueing the same edit over and over.
 */
const selectableKeys = (rows: ScanRow[]): Set<string> => {
  const seen = new Set<string>()
  const keys = new Set<string>()

  for (const row of rows) {
    for (const match of row.matches) {
      if (!match.applicable || seen.has(match.valueKey)) {
        continue
      }

      seen.add(match.valueKey)
      keys.add(match.key)
    }
  }

  return keys
}

/** Values already covered by an earlier row, so repeats can be labelled. */
export const duplicateValueKeys = (rows: ScanRow[]): Set<string> => {
  const seen = new Set<string>()
  const repeats = new Set<string>()

  for (const row of rows) {
    for (const match of row.matches) {
      if (seen.has(match.valueKey)) {
        repeats.add(match.key)
      } else {
        seen.add(match.valueKey)
      }
    }
  }

  return repeats
}

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
/**
 * Walks a record, loading whatever it references until nothing is left
 * pending — a page whose sections live in a linked record is only searched
 * once that record is in hand.
 */
const walkWithLinkedRecords = async (
  client: NonNullable<ReturnType<typeof buildClient>>,
  loader: FieldLoader,
  input: Omit<
    Parameters<typeof transformRecord>[0],
    'linkedRecords' | 'fieldsByItemType'
  >,
  /** Records the scan already fetched, so applying does not fetch them again. */
  seed: Record<string, LinkedRecordPayload> = {}
): Promise<{
  result: ReturnType<typeof transformRecord>
  linked: Record<string, LinkedRecordPayload>
  /** True when the walk stopped at the cap with work still outstanding. */
  exhausted: boolean
}> => {
  // The seed is used directly rather than copied, so a caller can hand the
  // same cache to every record in a scan. Pages share components — a nav, a
  // footer, a CTA used everywhere — and fetching those once per page was most
  // of the cost of scanning a whole model.
  const linked = seed
  const asked = new Set<string>(Object.keys(seed))

  const walk = () =>
    transformRecord({
      ...input,
      fieldsByItemType: loader.fieldsByItemType,
      linkedRecords: linked
    })

  let result = walk()

  // Each pass asks for what it could not resolve — field definitions for the
  // types it met, and the records it was pointed at — so only what a page
  // actually contains is ever fetched.
  // Loop while each pass is still resolving something, rather than for a
  // fixed number of passes. The old fixed count was shared between loading
  // field definitions and loading records, so a cold cache spent its passes on
  // definitions and never reached the content — and the same search run again,
  // against a warm cache, went deeper and found more. Results must not depend
  // on what an earlier scan happened to cache.
  let passes = 0

  for (; passes < MAX_RESOLVE_PASSES; passes += 1) {
    const loadedTypes = await loader.ensure(result.pendingItemTypeIds)

    const missing: string[] = []

    for (const id of result.pendingLinkIds) {
      if (!asked.has(id)) {
        asked.add(id)
        missing.push(id)
      }
    }

    if (!loadedTypes && missing.length === 0) {
      break
    }

    if (missing.length > 0) {
      Object.assign(linked, await fetchLinkedRecords(client, missing))
    }

    result = walk()
  }

  return { result, linked, exhausted: passes >= MAX_RESOLVE_PASSES }
}

export const scanParametersSignature = (
  modelId: string | null,
  options: MatchOptions,
  targets: ParsedTarget[],
  scope: SearchScope = 'pages',
  scopeLocale: string | null = null
): string =>
  JSON.stringify({
    modelId,
    options,
    scope,
    scopeLocale,
    targets:
      scope === 'all'
        ? []
        : searchableTargets(targets).map(
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
  const [onlyMatches, setOnlyMatches] = useState(false)
  const [scope, setScope] = useState<SearchScope>('pages')
  const [scopeLocale, setScopeLocale] = useState<string | null>(null)
  const [linkOptions, setLinkOptions] = useState<LinkOptions | null>(null)
  // A ref rather than state: the scan loop reads it between records, and must
  // see the change the click made rather than the value it closed over.
  const scanCancelled = useRef(false)
  const [foundSoFar, setFoundSoFar] = useState(0)
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

  // Cached for the life of the client, so a second scan re-fetches nothing.
  const fieldLoader = useMemo(
    () => (client ? createFieldLoader(client) : null),
    [client]
  )

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

  const [modelDetails, setModelDetails] = useState<SearchableModel | null>(null)

  const baseModel = useMemo<SearchableModel | null>(
    () => schema?.models.find((candidate) => candidate.id === modelId) ?? null,
    [schema, modelId]
  )

  // The chosen model's slug field decides whether URLs can be matched at all,
  // so it is looked up as soon as one is chosen rather than at scan time —
  // otherwise the form cannot say whether the model is usable. Nothing is
  // cleared on the way out: `model` below falls back to the undetailed entry
  // whenever the details belong to a different model.
  useEffect(() => {
    if (!client || !fieldLoader || !baseModel) {
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const detailed = await loadModelDetails(client, fieldLoader, baseModel)

        if (!cancelled) {
          setModelDetails(detailed)
        }
      } catch {
        // Leaving the details unchecked keeps the form neutral rather than
        // claiming the model has no slug field.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [client, fieldLoader, baseModel])

  const model = useMemo<SearchableModel | null>(
    () => (modelDetails?.id === baseModel?.id ? modelDetails : baseModel),
    [modelDetails, baseModel]
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
    () =>
      scanParametersSignature(modelId, options, targets, scope, scopeLocale),
    [modelId, options, targets, scope, scopeLocale]
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

  // A slug is only needed to turn a URL into a record. Searching the whole
  // model needs no URLs, so models without one — a homepage, a singleton —
  // can still be searched that way.
  const scopeIsUsable =
    scope === 'all'
      ? true
      : Boolean(model?.slugFieldChecked && model.slugFieldApiKey) &&
        searchableTargets(targets).length > 0

  const canScan =
    phase !== 'scanning' &&
    phase !== 'applying' &&
    Boolean(client && schema && model && find) &&
    scopeIsUsable

  const scan = useCallback(async () => {
    if (!client || !schema || !model || !fieldLoader) {
      return
    }

    scanCancelled.current = false
    setPhase('scanning')
    setFoundSoFar(0)
    setRows([])
    setSelectedKeys(new Set())
    setStage(`Indexing ${model.name} records…`)

    try {
      const searchableModel = model.slugFieldChecked
        ? model
        : await loadModelDetails(client, fieldLoader, model)
      const searchable = searchableTargets(targets)
      // Without URLs there is no locale to read off one, so the scan uses the
      // locale chosen in the form.
      const scanLocale =
        scopeLocale ?? searchable[0]?.datoLocale ?? siteLocales[0] ?? 'en'
      const locales = [
        ...new Set(searchable.map((target) => target.datoLocale as string))
      ]
      const pathFinder = createRecordPathFinder(client, searchableModel)

      // The two URLs are resolved to records once, rather than every record's
      // path being resolved so one of them can be recognised.
      const findPath = internalPathOf(options.find)
      const replacePath = internalPathOf(options.replace)
      const primaryLocale = searchable[0]?.datoLocale ?? locales[0] ?? null

      const [findRecordId, replaceRecordId] = await Promise.all([
        findPath && primaryLocale
          ? pathFinder.recordAt(findPath, primaryLocale)
          : Promise.resolve(null),
        replacePath && primaryLocale
          ? pathFinder.recordAt(replacePath, primaryLocale)
          : Promise.resolve(null)
      ])

      // Links stored as record references render as a URL but hold an id, so
      // a text search cannot see them. Resolving ids to paths is what lets the
      // search match — and repoint — them.
      const link: LinkOptions | null = buildLinkOptions({
        find: options.find,
        replace: options.replace,
        findRecordId,
        replaceRecordId,
        convention: linkConvention
      })

      setLinkOptions(link)

      // Rows that never reach a record — skipped URLs, and paths no record
      // matched — are known before any walking starts.
      const scanned0: ScanRow[] = []
      const plan: Array<{ target: ParsedTarget; recordId: string | null }> = []

      if (scope === 'pages') {
        for (const target of targets) {
          if (target.skipReason !== null) {
            scanned0.push({
              target,
              status: 'skipped',
              recordId: null,
              record: null,
              linked: {},
              written: [],
              matches: [],
              message: null
            })
            continue
          }

          const recordId = await pathFinder.recordAt(
            target.contentPath as string,
            target.datoLocale as string
          )

          if (recordId) {
            plan.push({ target, recordId })
            continue
          }

          scanned0.push({
            target,
            status: 'not-found',
            recordId: null,
            record: null,
            linked: {},
            written: [],
            matches: [],
            message: `No ${model.name} with path ${target.contentPath} in ${target.datoLocale}`
          })
        }
      }

      if (scope === 'all') {
        setStage('Listing records')

        const stubs = await fetchModelRecordStubs(
          client,
          searchableModel,
          scanLocale
        )

        if (stubs.length > LARGE_SCAN) {
          const go = await ctx.openConfirm({
            title: `Search all ${stubs.length} ${model.name} records?`,
            content: `This reads every record of the model and whatever it links to. Nothing is written until you apply a change.`,
            choices: [{ label: 'Search', value: true, intent: 'positive' }],
            cancel: { label: 'Cancel', value: false }
          })

          if (!go) {
            setPhase('idle')
            setStage(null)

            return
          }
        }

        for (const stub of stubs) {
          plan.push({
            target: {
              raw: stub.label,
              market: null,
              datoLocale: scanLocale,
              contentPath: null,
              localeFromLanguage: false,
              skipReason: null
            },
            recordId: stub.id
          })
        }
      }

      setStage(null)
      setProgress({
        done: 0,
        total: scope === 'all' ? plan.length : searchable.length
      })

      const scanned: ScanRow[] = [...scanned0]

      // One cache of referenced records for the whole scan.
      const sharedLinked: Record<string, LinkedRecordPayload> = {}

      // The one place a record is walked, whichever scope chose it.
      const scanOne = async (
        target: ParsedTarget,
        recordId: string,
        record: FullRecord
      ): Promise<ScanRow> => {
        try {
          const {
            result: { matches, unsearched, report },
            linked,
            exhausted
          } = await walkWithLinkedRecords(
            client,
            fieldLoader,
            {
              record,
              itemTypeId: model.id,
              namesByItemType: schema.namesByItemType,
              options,
              locale: target.datoLocale,
              link
            },
            sharedLinked
          )

          if (matches.length > 0) {
            setFoundSoFar((current) => current + matches.length)
          }

          return {
            target,
            status: matches.length > 0 ? 'matched' : 'no-matches',
            recordId,
            record,
            linked,
            written: [],
            matches,
            message: exhausted
              ? `Stopped before the page was fully resolved — results may be incomplete (${report.values} value(s) in ${report.blocks} block(s))`
              : describeScan(unsearched, report, matches.length > 0)
          }
        } catch (error) {
          return {
            target,
            status: 'error',
            recordId,
            record: null,
            linked: {},
            written: [],
            matches: [],
            message: errorMessage(error)
          }
        } finally {
          setProgress((current) =>
            current ? { ...current, done: current.done + 1 } : current
          )
        }
      }

      // Records are fetched a batch at a time and then walked in parallel.
      // Scanning fifteen hundred pages one after another spent almost all of
      // its time waiting: one request to fetch, then a walk that waits on its
      // own requests, then the next page.
      for (const batch of chunked(plan, SCAN_BATCH)) {
        // Checked per batch rather than per record: a batch is one request
        // that is already in flight by the time anyone clicks.
        if (scanCancelled.current) {
          break
        }

        const fetched = await fetchRecordsByIds(
          client,
          batch
            .map((planned) => planned.recordId)
            .filter((id): id is string => id !== null)
        )

        const walked = await mapWithLimit(
          batch,
          SCAN_PARALLEL,
          async (planned) =>
            planned.recordId && fetched[planned.recordId]
              ? await scanOne(
                  planned.target,
                  planned.recordId,
                  fetched[planned.recordId]
                )
              : null
        )

        for (const row of walked) {
          if (row) {
            scanned.push(row)
          }
        }

        // Shown as they arrive: on a whole-model scan the last page can be
        // minutes after the first, and there is no reason to withhold results
        // that are already final.
        setRows([...scanned])
        setSelectedKeys(
          new Set(
            scanned.flatMap((row) =>
              row.matches
                .filter((match) => match.applicable)
                .map((match) => match.key)
            )
          )
        )
      }

      setRows(scanned)
      setSelectedKeys(selectableKeys(scanned))
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
    fieldLoader,
    schema,
    model,
    targets,
    scope,
    scopeLocale,
    siteLocales,
    options,
    ctx,
    scanSignature,
    linkConvention
  ])

  /**
   * Stops a scan between records.
   *
   * Whatever was searched before the stop is kept: those rows are complete,
   * and a mistyped search term over a large model should not mean waiting for
   * it to finish or reloading the page.
   */
  const cancelScan = useCallback(() => {
    scanCancelled.current = true
  }, [])

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
      if (!client || !schema || !model || !fieldLoader) {
        return
      }

      setPhase('applying')
      setProgress({ done: 0, total: toApply.length })

      let applied = 0
      let failed = 0

      // A component used across the site is reached from every page that uses
      // it, so the same record turns up in many rows. It only has to be
      // written once — and writing it twice would fail anyway, since the
      // second attempt still carries the version read before the first.
      const alreadyWritten = new Map<string, { published: boolean }>()

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
          const {
            result: { changedFields, changedLinkedRecords }
          } = await walkWithLinkedRecords(
            client,
            fieldLoader,
            {
              record: row.record,
              itemTypeId: model.id,
              namesByItemType: schema.namesByItemType,
              options,
              locale: row.target.datoLocale,
              link: linkOptions,
              enabledKeys
            },
            row.linked
          )

          const changedRecordCount =
            Object.keys(changedLinkedRecords).length +
            (Object.keys(changedFields).length > 0 ? 1 : 0)

          // Selected occurrences that rewrite nothing mean the apply walked
          // different input from the dry run. Saying so beats reporting
          // success over a write that never happened.
          if (changedRecordCount === 0) {
            throw new Error(
              'Nothing to write — the page no longer matches the dry run. Scan again.'
            )
          }

          const pageRecordId = row.record.id
          const written: Array<{
            id: string
            label: string
            published: boolean
          }> = []

          // Referenced records are saved first: if one of them fails, the page
          // is left untouched rather than half-updated.
          for (const [id, fields] of Object.entries(changedLinkedRecords)) {
            const linked = row.linked[id]

            const seen = alreadyWritten.get(id)

            if (seen) {
              // Listed again so it can still be opened and published from
              // here, but not written a second time.
              written.push({
                id,
                label: `${schema.namesByItemType[linked?.itemTypeId ?? ''] ?? 'Record'} (already updated)`,
                published: seen.published
              })
              continue
            }

            if (linked) {
              const linkedOutcome = await applyToRecord(
                client,
                linked.record,
                fields,
                publishIfPublished
              )

              alreadyWritten.set(id, { published: linkedOutcome.published })
              written.push({
                id,
                label: schema.namesByItemType[linked.itemTypeId] ?? 'Record',
                published: linkedOutcome.published
              })
            }
          }

          const outcome =
            Object.keys(changedFields).length > 0
              ? await applyToRecord(
                  client,
                  row.record,
                  changedFields,
                  publishIfPublished
                )
              : { published: false, error: null }

          setRows((current) =>
            current.map((candidate) =>
              candidate.target.raw === row.target.raw
                ? {
                    ...candidate,
                    status: 'applied',
                    written:
                      Object.keys(changedFields).length > 0
                        ? [
                            ...written,
                            {
                              id: pageRecordId,
                              label: model.name,
                              published: outcome.published
                            }
                          ]
                        : written,
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
    [
      client,
      schema,
      model,
      options,
      selectedKeys,
      publishIfPublished,
      ctx,
      linkOptions,
      fieldLoader
    ]
  )

  const publishRecord = useCallback(
    async (recordId: string) => {
      if (!client) {
        return
      }

      try {
        await client.items.publish(recordId)

        setRows((current) =>
          current.map((row) => ({
            ...row,
            written: row.written.map((record) =>
              record.id === recordId ? { ...record, published: true } : record
            )
          }))
        )
      } catch (error) {
        ctx.alert(errorMessage(error))
      }
    },
    [client, ctx]
  )

  const duplicateKeys = useMemo(() => duplicateValueKeys(rows), [rows])

  const visibleRows = useMemo(
    () =>
      onlyMatches
        ? rows.filter(
            (row) => row.status === 'matched' || row.status === 'applied'
          )
        : rows,
    [rows, onlyMatches]
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
    onlyMatches,
    handleOnlyMatchesChange: setOnlyMatches,
    visibleRows,
    duplicateKeys,
    handlePublishRecord: publishRecord,
    scope,
    handleScopeChange: setScope,
    scopeLocale,
    handleScopeLocaleChange: setScopeLocale,
    siteLocales,
    handleCancelScan: cancelScan,
    foundSoFar,
    handleReset: reset
  }
}
