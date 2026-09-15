import type { Client } from '@datocms/cma-client-browser'
import type {
  FieldDef,
  FieldsByItemType,
  NamesByItemType
} from './replaceEngine'
import { normalizePath } from './marketLocale'

/** Model the tool can search in, plus the fields it needs to resolve URLs. */
export type SearchableModel = {
  id: string
  apiKey: string
  name: string
  /** Field holding the URL segment, or null when the model has none. */
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

const CONCURRENCY = 8

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

const linksToItemType = (field: RawField, itemTypeId: string): boolean => {
  const validator = field.validators.item_item_type as
    | { item_types?: string[] }
    | undefined

  return Boolean(validator?.item_types?.includes(itemTypeId))
}

const pickSlugField = (fields: RawField[]): RawField | null =>
  fields.find((field) => field.field_type === 'slug') ??
  fields.find((field) => field.api_key === 'slug') ??
  null

const toFieldDef = (field: RawField): FieldDef => ({
  apiKey: field.api_key,
  label: field.label,
  fieldType: field.field_type,
  localized: field.localized
})

/**
 * Loads every model and block model with its fields.
 *
 * Block fields are needed too: the engine recurses into nested blocks and has
 * to know each one's field types to know what is prose and what is a reference.
 */
export const fetchSchemaIndex = async (
  client: Client
): Promise<SchemaIndex> => {
  const itemTypes = (await client.itemTypes.list()) as unknown as RawItemType[]

  const fieldLists = await mapWithConcurrency(
    itemTypes,
    async (itemType) =>
      [
        itemType,
        (await client.fields.list(itemType.id)) as unknown as RawField[]
      ] as const
  )

  const fieldsByItemType: FieldsByItemType = {}
  const namesByItemType: NamesByItemType = {}
  const models: SearchableModel[] = []

  for (const [itemType, fields] of fieldLists) {
    fieldsByItemType[itemType.id] = fields.map(toFieldDef)
    namesByItemType[itemType.id] = itemType.name

    if (itemType.modular_block) {
      continue
    }

    const slugField = pickSlugField(fields)
    const parentField = fields.find(
      (field) =>
        field.field_type === 'link' && linksToItemType(field, itemType.id)
    )

    models.push({
      id: itemType.id,
      apiKey: itemType.api_key,
      name: itemType.name,
      slugFieldApiKey: slugField?.api_key ?? null,
      slugFieldLocalized: slugField?.localized ?? false,
      parentFieldApiKey: parentField?.api_key ?? null
    })
  }

  models.sort((a, b) => a.name.localeCompare(b.name))

  return { models, fieldsByItemType, namesByItemType }
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

type RecordStub = {
  id: string
  slug: unknown
  parentId: string | null
}

/** Maps `locale -> content path -> record id` for one model. */
export type PathIndex = Map<string, Map<string, string>>

const slugForLocale = (
  slug: unknown,
  locale: string,
  localized: boolean
): string | null => {
  if (!localized) {
    return typeof slug === 'string' ? slug : null
  }

  if (typeof slug !== 'object' || slug === null) {
    return null
  }

  const value = (slug as Record<string, unknown>)[locale]

  return typeof value === 'string' ? value : null
}

/**
 * Builds the URL path of every record in `model`, per locale, by walking the
 * parent chain — so a page nested under a parent resolves at
 * `/parent-slug/child-slug`, matching how the site routes it.
 */
export const fetchPathIndex = async (
  client: Client,
  model: SearchableModel,
  locales: string[]
): Promise<PathIndex> => {
  if (!model.slugFieldApiKey) {
    return new Map()
  }

  const stubs = new Map<string, RecordStub>()

  for await (const record of client.items.listPagedIterator({
    filter: { type: model.apiKey },
    version: 'current'
  })) {
    const raw = record as unknown as Record<string, unknown>
    const parent = model.parentFieldApiKey ? raw[model.parentFieldApiKey] : null

    stubs.set(record.id, {
      id: record.id,
      slug: raw[model.slugFieldApiKey],
      parentId: typeof parent === 'string' ? parent : null
    })
  }

  const index: PathIndex = new Map(locales.map((locale) => [locale, new Map()]))

  const pathOf = (
    stub: RecordStub,
    locale: string,
    seen: Set<string>
  ): string | null => {
    const slug = slugForLocale(stub.slug, locale, model.slugFieldLocalized)

    if (slug === null) {
      return null
    }

    if (!stub.parentId || seen.has(stub.parentId)) {
      return normalizePath(slug)
    }

    const parent = stubs.get(stub.parentId)

    if (!parent) {
      return normalizePath(slug)
    }

    const parentPath = pathOf(parent, locale, new Set(seen).add(stub.parentId))

    if (parentPath === null) {
      return normalizePath(slug)
    }

    return normalizePath(parentPath === '/' ? slug : `${parentPath}/${slug}`)
  }

  for (const stub of [...stubs.values()]) {
    for (const locale of locales) {
      const path = pathOf(stub, locale, new Set([stub.id]))

      if (path === null) {
        continue
      }

      const byPath = index.get(locale)

      // First record wins, so a duplicate slug cannot silently retarget a URL.
      if (byPath && !byPath.has(path)) {
        byPath.set(path, stub.id)
      }
    }
  }

  return index
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
