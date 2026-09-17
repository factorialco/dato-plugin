import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@datocms/cma-client-browser'
import {
  buildLinkResolver,
  createFieldLoader,
  fetchSchemaIndex,
  loadModelDetails
} from './searchReplace.services'

const PAGE = 'page-t'
const TAG = 'tag-t'

const ITEM_TYPES = [
  { id: PAGE, name: 'Page', api_key: 'page', modular_block: false },
  { id: TAG, name: 'Tag', api_key: 'tag', modular_block: false }
]

const FIELDS: Record<string, unknown[]> = {
  [PAGE]: [
    {
      id: 'f1',
      label: 'Slug',
      api_key: 'slug',
      field_type: 'slug',
      localized: true,
      validators: {}
    },
    {
      id: 'f2',
      label: 'Tags',
      api_key: 'tag_list',
      field_type: 'links',
      localized: false,
      validators: { items_item_type: { item_types: [TAG] } }
    }
  ],
  [TAG]: [
    {
      id: 'f3',
      label: 'Slug',
      api_key: 'slug',
      field_type: 'slug',
      localized: true,
      validators: {}
    }
  ]
}

const RECORDS: Record<string, unknown[]> = {
  page: [{ id: 'rec-page', slug: { en: 'hr-software' } }],
  tag: [{ id: 'rec-tag', slug: { en: 'payroll' } }]
}

const buildFakeClient = () => {
  const fieldsList = vi.fn<(id: string) => Promise<unknown[]>>((id) =>
    Promise.resolve(FIELDS[id] ?? [])
  )

  const client = {
    itemTypes: { list: () => Promise.resolve(ITEM_TYPES) },
    fields: { list: fieldsList },
    items: {
      // eslint-disable-next-line require-yield
      listPagedIterator: (params: { filter: { type: string } }) => {
        const rows = RECORDS[params.filter.type] ?? []

        return (async function* stream() {
          for (const row of rows) {
            yield row
          }
        })()
      }
    }
  }

  return { client: client as unknown as Client, fieldsList }
}

describe(fetchSchemaIndex, () => {
  // The whole point of loading lazily: opening the plugin must not fetch a
  // /fields request per item type.
  it('lists models without fetching any fields', async () => {
    const { client, fieldsList } = buildFakeClient()
    const schema = await fetchSchemaIndex(client)

    expect(schema.models.map((model) => model.name)).toStrictEqual([
      'Page',
      'Tag'
    ])
    expect(fieldsList).not.toHaveBeenCalled()
  })

  // The regression: a model whose fields have not been read yet must not look
  // like a model that has no slug field. That drove the dropdown label, the
  // hint, and the dry-run button being disabled.
  it('marks slug details as not yet looked up', async () => {
    const { client } = buildFakeClient()
    const schema = await fetchSchemaIndex(client)
    const [page] = schema.models

    // Asserting the flag is present, not merely falsy: without it `undefined`
    // reads as "not checked" by accident, and the UI is back to treating a
    // missing answer as a negative one.
    expect('slugFieldChecked' in page).toBeTruthy()
    expect(page.slugFieldChecked).toBeFalsy()
    expect(page.slugFieldApiKey).toBeNull()
  })
})

describe(loadModelDetails, () => {
  it('finds the slug field and records that it looked', async () => {
    const { client } = buildFakeClient()
    const schema = await fetchSchemaIndex(client)
    const loader = createFieldLoader(client)
    const page = schema.models.find((model) => model.id === PAGE)

    if (!page) {
      throw new Error('Expected the fake project to have a Page model')
    }

    await expect(loadModelDetails(client, loader, page)).resolves.toMatchObject(
      {
        slugFieldChecked: true,
        slugFieldApiKey: 'slug',
        slugFieldLocalized: true
      }
    )
  })
})

describe(createFieldLoader, () => {
  it('fetches each item type once, however often it is asked', async () => {
    const { client, fieldsList } = buildFakeClient()
    const loader = createFieldLoader(client)

    await expect(loader.ensure([PAGE, TAG])).resolves.toBeTruthy()
    await expect(loader.ensure([PAGE])).resolves.toBeFalsy()
    expect(fieldsList).toHaveBeenCalledTimes(2)
    expect(loader.fieldsByItemType[PAGE]).toHaveLength(2)
  })
})

describe(buildLinkResolver, () => {
  // The second regression: slug fields must come from the loader. Reading them
  // off SearchableModel — where they are only filled in for the model being
  // searched — left every other model looking slug-less, so the resolver came
  // back empty and reference links silently stopped matching.
  it('indexes models whose slug details have not been filled in', async () => {
    const { client } = buildFakeClient()
    const schema = await fetchSchemaIndex(client)
    const loader = createFieldLoader(client)

    expect(schema.models.every((model) => !model.slugFieldChecked)).toBeTruthy()

    const resolver = await buildLinkResolver(
      client,
      loader,
      schema,
      [PAGE, TAG],
      ['en'],
      new Map()
    )

    expect(resolver.pathOf('rec-tag', 'en')).toBe('/payroll')
    expect(resolver.recordAt('/hr-software', 'en')).toBe('rec-page')
  })

  it('reuses a cached index instead of listing records again', async () => {
    const { client } = buildFakeClient()
    const schema = await fetchSchemaIndex(client)
    const loader = createFieldLoader(client)
    const cache = new Map()

    await buildLinkResolver(client, loader, schema, [PAGE], ['en'], cache)
    const resolver = await buildLinkResolver(
      client,
      loader,
      schema,
      [PAGE],
      ['en'],
      cache
    )

    expect(cache.size).toBe(1)
    expect(resolver.recordAt('/hr-software', 'en')).toBe('rec-page')
  })

  it('indexes nothing when no model is reachable', async () => {
    const { client } = buildFakeClient()
    const schema = await fetchSchemaIndex(client)
    const loader = createFieldLoader(client)

    const resolver = await buildLinkResolver(
      client,
      loader,
      schema,
      [],
      ['en'],
      new Map()
    )

    expect(resolver.recordAt('/hr-software', 'en')).toBeNull()
  })
})
