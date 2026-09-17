import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@datocms/cma-client-browser'
import { createRecordPathFinder } from './recordPaths'
import type { SearchableModel } from './searchReplace.services'

const MODEL: SearchableModel = {
  id: 'page-t',
  apiKey: 'page',
  name: 'Page',
  slugFieldChecked: true,
  slugFieldApiKey: 'slug',
  slugFieldLocalized: true,
  parentFieldApiKey: 'parent_page'
}

type Row = {
  id: string
  slug: Record<string, string>
  parent_page?: string | null
}

const ROWS: Row[] = [
  { id: 'rec-top', slug: { en: 'hr-software', es: 'software-rrhh' } },
  { id: 'rec-parent', slug: { en: 'product' } },
  { id: 'rec-child', slug: { en: 'payroll' }, parent_page: 'rec-parent' },
  // Same slug as the child, but hanging off nothing — the case a slug lookup
  // alone would get wrong.
  { id: 'rec-orphan', slug: { en: 'payroll' } },
  { id: 'rec-deep', slug: { en: 'reports' }, parent_page: 'rec-child' },
  { id: 'rec-loop', slug: { en: 'loop' }, parent_page: 'rec-loop' }
]

const buildClient = () => {
  const list = vi.fn<(params: Record<string, any>) => Promise<Row[]>>(
    (params) => {
      const wanted = params.filter.fields.slug.eq as string
      const locale = params.locale as string

      return Promise.resolve(ROWS.filter((row) => row.slug[locale] === wanted))
    }
  )

  const find = vi.fn<(id: string) => Promise<Row>>((id) => {
    const row = ROWS.find((candidate) => candidate.id === id)

    return row ? Promise.resolve(row) : Promise.reject(new Error('404'))
  })

  const client = { items: { list, find } } as unknown as Client

  return { client, list, find }
}

const finderFor = (model: SearchableModel = MODEL) => {
  const { client, list, find } = buildClient()

  return { finder: createRecordPathFinder(client, model), list, find }
}

describe(createRecordPathFinder, () => {
  it('finds a top-level page by its slug', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/hr-software', 'en')).resolves.toBe('rec-top')
  })

  it('asks only for the slug it needs, not for every record', async () => {
    const { finder, list } = finderFor()

    await finder.recordAt('/hr-software', 'en')

    expect(list).toHaveBeenCalledOnce()
    expect(list.mock.calls[0][0]).toMatchObject({
      filter: { type: 'page', fields: { slug: { eq: 'hr-software' } } },
      locale: 'en'
    })
  })

  it('reads the slug for the locale asked for', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/software-rrhh', 'es')).resolves.toBe(
      'rec-top'
    )
    await expect(finder.recordAt('/hr-software', 'es')).resolves.toBeNull()
  })

  it('follows the parent chain for a nested page', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/product/payroll', 'en')).resolves.toBe(
      'rec-child'
    )
  })

  it('follows a chain more than one deep', async () => {
    const { finder } = finderFor()

    await expect(
      finder.recordAt('/product/payroll/reports', 'en')
    ).resolves.toBe('rec-deep')
  })

  // The reason the chain is checked at all: two records share the slug, and
  // only one of them actually sits at that path.
  it('picks the record whose ancestors match, not merely its slug', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/payroll', 'en')).resolves.toBe('rec-orphan')
    await expect(finder.recordAt('/product/payroll', 'en')).resolves.toBe(
      'rec-child'
    )
  })

  it('rejects a path whose ancestors are wrong', async () => {
    const { finder } = finderFor()

    await expect(
      finder.recordAt('/elsewhere/payroll', 'en')
    ).resolves.toBeNull()
  })

  it('rejects a path shorter than the record sits at', async () => {
    const { finder } = finderFor()

    // rec-deep is at /product/payroll/reports, so /reports is not it.
    await expect(finder.recordAt('/reports', 'en')).resolves.toBeNull()
  })

  it('rejects a path longer than the record sits at', async () => {
    const { finder } = finderFor()

    await expect(
      finder.recordAt('/product/hr-software', 'en')
    ).resolves.toBeNull()
  })

  it('fetches a shared parent once across sibling lookups', async () => {
    const { finder, find } = finderFor()

    await finder.recordAt('/product/payroll', 'en')
    await finder.recordAt('/product/payroll/reports', 'en')

    const parentCalls = find.mock.calls.filter(
      ([id]) => id === 'rec-parent'
    ).length

    expect(parentCalls).toBe(1)
  })

  it('does not hang on a record that is its own parent', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/loop/loop', 'en')).resolves.toBeNull()
  })

  it('returns nothing for an unknown path', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/nothing-here', 'en')).resolves.toBeNull()
  })

  it('returns nothing for the site root', async () => {
    const { finder } = finderFor()

    await expect(finder.recordAt('/', 'en')).resolves.toBeNull()
  })

  it('returns nothing when the model has no slug field', async () => {
    const { finder, list } = finderFor({
      ...MODEL,
      slugFieldApiKey: null
    })

    await expect(finder.recordAt('/hr-software', 'en')).resolves.toBeNull()
    expect(list).not.toHaveBeenCalled()
  })

  it('reads a non-localized slug straight off the record', async () => {
    const plain = createRecordPathFinder(
      {
        items: {
          list: () => Promise.resolve([{ id: 'rec-plain', slug: 'about' }]),
          find: () => Promise.reject(new Error('404'))
        }
      } as unknown as Client,
      { ...MODEL, slugFieldLocalized: false }
    )

    await expect(plain.recordAt('/about', 'en')).resolves.toBe('rec-plain')
  })
})
