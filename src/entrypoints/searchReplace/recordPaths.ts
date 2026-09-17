import type { Client } from '@datocms/cma-client-browser'
import type { SearchableModel } from './searchReplace.services'

/**
 * Finds the record a URL path belongs to, by asking for it.
 *
 * The obvious way to map paths to records is to list every record of the model
 * and build the whole index — which costs the same whether you asked about
 * three pages or three thousand, and on a large model runs to thousands of
 * requests before a search even starts.
 *
 * Instead the last segment of the path is looked up directly, and only the
 * handful of records sharing that slug have their parent chain checked. The
 * cost then follows what was actually asked for.
 */
export type RecordPathFinder = {
  recordAt: (path: string, locale: string) => Promise<string | null>
}

type Stub = {
  id: string
  slug: string | null
  parentId: string | null
}

const segmentsOf = (path: string): string[] =>
  path.split('/').filter((segment) => segment !== '')

export const createRecordPathFinder = (
  client: Client,
  model: SearchableModel
): RecordPathFinder => {
  // Parents are shared between sibling pages, so they are fetched once.
  const parents = new Map<string, Stub | null>()

  const stubOf = (raw: Record<string, unknown>, locale: string): Stub => {
    const slugValue = model.slugFieldApiKey
      ? raw[model.slugFieldApiKey]
      : undefined
    const slug = model.slugFieldLocalized
      ? typeof slugValue === 'object' && slugValue !== null
        ? (((slugValue as Record<string, unknown>)[locale] as string) ?? null)
        : null
      : typeof slugValue === 'string'
        ? slugValue
        : null
    const parent = model.parentFieldApiKey ? raw[model.parentFieldApiKey] : null

    return {
      id: String(raw.id),
      slug,
      parentId: typeof parent === 'string' ? parent : null
    }
  }

  const parentStub = async (
    id: string,
    locale: string
  ): Promise<Stub | null> => {
    const cached = parents.get(id)

    if (cached !== undefined) {
      return cached
    }

    try {
      // The CMA client's items.find(id, queryParams), not Array#find.
      // oxlint-disable-next-line unicorn/no-array-method-this-argument
      const raw = (await client.items.find(id, {
        version: 'current'
      })) as unknown as Record<string, unknown>
      const stub = stubOf(raw, locale)

      parents.set(id, stub)

      return stub
    } catch {
      parents.set(id, null)

      return null
    }
  }

  /** Whether `stub`'s ancestors spell out the segments before its own. */
  const ancestorsMatch = async (
    stub: Stub,
    expected: string[],
    locale: string
  ): Promise<boolean> => {
    let current = stub
    const seen = new Set([stub.id])

    // Walking up from the record, so the expected segments are consumed from
    // the end. `toReversed` would read better but is ES2023, past our target.
    // oxlint-disable-next-line unicorn/no-array-reverse
    for (const segment of [...expected].reverse()) {
      if (!current.parentId || seen.has(current.parentId)) {
        return false
      }

      const parent = await parentStub(current.parentId, locale)

      if (!parent || parent.slug !== segment) {
        return false
      }

      seen.add(parent.id)
      current = parent
    }

    // Nothing above the first segment, or the path would be longer than asked.
    return !current.parentId
  }

  return {
    recordAt: async (path, locale) => {
      if (!model.slugFieldApiKey) {
        return null
      }

      const segments = segmentsOf(path)
      const ownSlug = segments.at(-1)

      if (!ownSlug) {
        return null
      }

      const candidates = (await client.items.list({
        filter: {
          type: model.apiKey,
          fields: { [model.slugFieldApiKey]: { eq: ownSlug } }
        },
        locale,
        version: 'current',
        page: { limit: 100 }
      })) as unknown as Array<Record<string, unknown>>

      const ancestors = segments.slice(0, -1)

      for (const candidate of candidates) {
        const stub = stubOf(candidate, locale)

        if (stub.slug !== ownSlug) {
          continue
        }

        if (await ancestorsMatch(stub, ancestors, locale)) {
          return stub.id
        }
      }

      return null
    }
  }
}
