import type { Client } from '@datocms/cma-client-browser'
import type {
  FieldDef,
  FieldsByItemType,
  NamesByItemType
} from './replaceEngine'

/** Model the tool can search in, plus the fields it needs to resolve URLs. */
export type SearchableModel = {
  id: string
  apiKey: string
  name: string
  /** Field holding the URL segment, or null when the model has none. */
  /**
   * Whether the slug details below have been looked up. They are loaded per
   * model on selection, so before that `slugFieldApiKey` being null means
   * "not checked yet", not "this model has none".
   */
  slugFieldChecked: boolean
  slugFieldApiKey: string | null
  slugFieldLocalized: boolean
  /** Self-referencing link field used to build nested paths, if any. */
  parentFieldApiKey: string | null
}

export type SchemaIndex = {
  models: SearchableModel[]
  fieldsByItemType: FieldsByItemType
  namesByItemType: NamesByItemType
}

type RawItemType = {
  id: string
  name: string
  api_key: string
  modular_block: boolean
}

type RawField = {
  id: string
  label: string
  api_key: string
  field_type: string
  localized: boolean
  validators: Record<string, unknown>
}

/**
 * Requests in flight at once.
 *
 * Dropped to 3 while the plugin was firing one per item type in the whole
 * project and getting 429s back. It no longer does — what remains is one
 * request per item type a page actually uses, and a few batches of records —
 * so the cautious value now just makes the dry run wait in a queue. Ten is
 * still far below the rate DatoCMS allows for a burst this size.
 */
const CONCURRENCY = 10

/** Runs `task` over `items`, a few at a time, preserving order. */
const mapWithConcurrency = async <T, R>(
  items: T[],
  task: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = []
  let cursor = 0

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    async () => {
      for (;;) {
        const index = cursor++

        if (index >= items.length) {
          return
        }

        results[index] = await task(items[index])
      }
    }
  )

  await Promise.all(workers)

  return results
}

/** Models a `link` / `links` field is allowed to point at. */
const linkedItemTypeIds = (field: RawField): string[] => {
  const validator = (field.validators.item_item_type ??
    field.validators.items_item_type) as { item_types?: string[] } | undefined

  return validator?.item_types ?? []
}

const toFieldDef = (field: RawField): FieldDef => ({
  apiKey: field.api_key,
  label: field.label,
  fieldType: field.field_type,
  localized: field.localized,
  linkedItemTypeIds: linkedItemTypeIds(field)
})

/**
 * Loads every model and block model with its fields.
 *
 * Block fields are needed too: the engine recurses into nested blocks and has
 * to know each one's field types to know what is prose and what is a reference.
 */
/**
 * Loads the project's models, and nothing else.
 *
 * Field definitions are deliberately not fetched here. A project with several
 * hundred item types means several hundred `/fields` requests, which DatoCMS
 * rate-limits — the plugin was firing them all on every load and getting a
 * wall of 429s back. Fields are loaded on demand instead, by `FieldLoader`,
 * which in practice touches the handful of types a page actually uses.
 */
export const fetchSchemaIndex = async (
  client: Client
): Promise<SchemaIndex> => {
  const itemTypes = (await client.itemTypes.list()) as unknown as RawItemType[]

  const namesByItemType: NamesByItemType = {}
  const models: SearchableModel[] = []

  for (const itemType of itemTypes) {
    namesByItemType[itemType.id] = itemType.name

    if (itemType.modular_block) {
      continue
    }

    models.push({
      id: itemType.id,
      apiKey: itemType.api_key,
      name: itemType.name,
      // Filled in by `loadModelDetails` once a model is actually chosen.
      slugFieldChecked: false,
      slugFieldApiKey: null,
      slugFieldLocalized: false,
      parentFieldApiKey: null
    })
  }

  models.sort((a, b) => a.name.localeCompare(b.name))

  return { models, fieldsByItemType: {}, namesByItemType }
}

/**
 * Fetches field definitions on demand, once per item type.
 *
 * The walk asks for the types it meets; the caller loads them and walks again.
 * That keeps the request count proportional to what a page actually contains
 * rather than to the size of the whole schema.
 */
export type FieldLoader = {
  fieldsByItemType: FieldsByItemType
  /** Loads any of `ids` not seen yet. Resolves true when something was added. */
  ensure: (ids: string[]) => Promise<boolean>
}

export const createFieldLoader = (client: Client): FieldLoader => {
  const fieldsByItemType: FieldsByItemType = {}
  const requested = new Set<string>()

  return {
    fieldsByItemType,
    ensure: async (ids) => {
      const missing = ids.filter((id) => id && !requested.has(id))

      if (missing.length === 0) {
        return false
      }

      for (const id of missing) {
        requested.add(id)
      }

      const loaded = await mapWithConcurrency(missing, async (id) => {
        const fields = (await client.fields.list(id)) as unknown as RawField[]

        return [id, fields.map(toFieldDef)] as const
      })

      for (const [id, fields] of loaded) {
        fieldsByItemType[id] = fields
      }

      return true
    }
  }
}

/** Slug and parent fields of the chosen model, needed to match URLs to records. */
export const loadModelDetails = async (
  client: Client,
  loader: FieldLoader,
  model: SearchableModel
): Promise<SearchableModel> => {
  await loader.ensure([model.id])

  // Read back from the loader rather than asking again: `ensure` has just
  // fetched exactly this.
  const fields = loader.fieldsByItemType[model.id] ?? []
  const slugField =
    fields.find((field) => field.fieldType === 'slug') ??
    fields.find((field) => field.apiKey === 'slug')
  const parentField = fields.find(
    (field) =>
      field.fieldType === 'link' &&
      (field.linkedItemTypeIds ?? []).includes(model.id)
  )

  return {
    ...model,
    slugFieldChecked: true,
    slugFieldApiKey: slugField?.apiKey ?? null,
    slugFieldLocalized: slugField?.localized ?? false,
    parentFieldApiKey: parentField?.apiKey ?? null
  }
}

/**
 * Market TLD -> project locale, read from the project's own
 * `market_configuration` records. Returns an empty map when the model is absent
 * or unreadable, in which case locale resolution falls back to normalising the
 * frontend locale. See `toDatoLocale`.
 */
export const fetchDatoLocaleByTld = async (
  client: Client
): Promise<Record<string, string>> => {
  const byTld: Record<string, string> = {}

  try {
    for await (const record of client.items.listPagedIterator({
      filter: { type: 'market_configuration' },
      version: 'current'
    })) {
      const { tld, dato_locale: datoLocale } = record as unknown as {
        tld?: string
        dato_locale?: string
      }

      if (tld && datoLocale) {
        byTld[tld] = datoLocale
      }
    }
  } catch {
    return {}
  }

  return byTld
}

export type FullRecord = Record<string, unknown> & {
  id: string
  meta: { status: string; current_version: string }
}

export const fetchRecord = async (
  client: Client,
  id: string
): Promise<FullRecord> =>
  // This is the CMA client's items.find(id, queryParams), not Array#find with
  // a thisArg.
  // oxlint-disable-next-line unicorn/no-array-method-this-argument
  (await client.items.find(id, {
    nested: true,
    version: 'current'
  })) as unknown as FullRecord

export type WriteOutcome = {
  published: boolean
  error: string | null
}

/**
 * Writes the rewritten fields, refusing the write if the record changed since
 * the dry run read it. Republishing is opt-in and only happens for records that
 * were fully published — a record with unpublished draft changes is left alone
 * so this tool never publishes someone else's work in progress.
 */
export const applyToRecord = async (
  client: Client,
  record: FullRecord,
  changedFields: Record<string, unknown>,
  publishIfPublished: boolean
): Promise<WriteOutcome> => {
  await client.items.update(record.id, {
    ...changedFields,
    meta: { current_version: record.meta.current_version }
  })

  if (!publishIfPublished || record.meta.status !== 'published') {
    return { published: false, error: null }
  }

  await client.items.publish(record.id)

  return { published: true, error: null }
}

/**
 * Runaway guard on the resolve loop, not a depth limit.
 *
 * Each pass loads whatever the previous one asked for, so the count needed
 * depends on how deeply a page nests its references — generous enough that no
 * real page reaches it, and the scan says so if one ever does.
 */
export const MAX_RESOLVE_PASSES = 50

/**
 * Largest page the API returns when block payloads are included. Fetching by
 * id is bounded by the same limit.
 */
const NESTED_PAGE_SIZE = 30

export const chunked = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

const toPayload = (record: FullRecord): LinkedRecordPayload => ({
  itemTypeId: (record.item_type as { id: string } | undefined)?.id ?? '',
  values: record as Record<string, unknown>,
  record
})

/**
 * Loads referenced records so their contents can be searched with the page.
 *
 * Fetched in batches by id. These are records of many different models, which
 * rules out `filter[type]` — but not `filter[ids]`, which combines with the
 * nesting the walk needs perfectly well. Fetching them one at a time, as this
 * did, was the single largest source of requests: a page built from a few
 * hundred referenced records cost a few hundred round trips, each doubled by
 * its CORS preflight.
 *
 * A batch that fails is retried one id at a time, so a single unreadable or
 * deleted reference costs only itself rather than everything beside it.
 */
/** Runs `task` over `items`, `limit` at a time, preserving order. */
export const mapWithLimit = async <T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = []
  let cursor = 0

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = cursor++

        if (index >= items.length) {
          return
        }

        results[index] = await task(items[index])
      }
    }
  )

  await Promise.all(workers)

  return results
}

/** Records fetched per request, and pages walked at once. */
export const SCAN_BATCH = 30
export const SCAN_PARALLEL = 5

export const fetchLinkedRecords = async (
  client: Client,
  ids: string[]
): Promise<Record<string, LinkedRecordPayload>> => {
  const batches = await mapWithConcurrency(
    chunked(ids, NESTED_PAGE_SIZE),
    async (batch): Promise<FullRecord[]> => {
      try {
        return (await client.items.list({
          filter: { ids: batch.join(',') },
          nested: true,
          version: 'current',
          page: { limit: NESTED_PAGE_SIZE }
        })) as unknown as FullRecord[]
      } catch {
        const one = await mapWithConcurrency(batch, async (id) => {
          try {
            return await fetchRecord(client, id)
          } catch {
            // A reference the current user cannot read, or a record since
            // deleted: the page is still worth searching without it.
            return null
          }
        })

        return one.filter((record): record is FullRecord => record !== null)
      }
    }
  )

  return Object.fromEntries(
    batches.flat().map((record) => [record.id, toPayload(record)])
  )
}

/**
 * The records themselves, by id, with their block payloads.
 *
 * Same batching as referenced records — a scan over a whole model was fetching
 * them one at a time.
 */
export const fetchRecordsByIds = async (
  client: Client,
  ids: string[]
): Promise<Record<string, FullRecord>> => {
  const loaded = await fetchLinkedRecords(client, ids)

  return Object.fromEntries(
    Object.entries(loaded).map(([id, payload]) => [id, payload.record])
  )
}

export type LinkedRecordPayload = {
  itemTypeId: string
  values: Record<string, unknown>
  /** Kept for its version, which guards the write. */
  record: FullRecord
}

/** A record of the chosen model, with enough to label it in the report. */
export type RecordStub = {
  id: string
  label: string
}

/**
 * Every record of a model, for a scan that is not scoped to given pages.
 *
 * Listed without block payloads: this is only deciding *which* records to walk,
 * and the walk fetches what it needs in batches afterwards. Asking for the
 * payloads here would cap the page size at 30 instead of 500.
 */
export const fetchModelRecordStubs = async (
  client: Client,
  model: SearchableModel,
  locale: string
): Promise<RecordStub[]> => {
  const stubs: RecordStub[] = []

  for await (const record of client.items.listPagedIterator({
    filter: { type: model.apiKey },
    version: 'current'
  })) {
    const raw = record as unknown as Record<string, unknown>
    const slugValue = model.slugFieldApiKey
      ? raw[model.slugFieldApiKey]
      : undefined
    const slug = model.slugFieldLocalized
      ? typeof slugValue === 'object' && slugValue !== null
        ? (slugValue as Record<string, unknown>)[locale]
        : undefined
      : slugValue

    stubs.push({
      id: record.id,
      label: typeof slug === 'string' && slug !== '' ? `/${slug}` : record.id
    })
  }

  return stubs
}
