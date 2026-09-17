import { describe, expect, it, vi } from 'vitest'
import type { Client } from '@datocms/cma-client-browser'
import {
  createFieldLoader,
  fetchLinkedRecords,
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

describe(fetchLinkedRecords, () => {
  const buildRecordClient = () => {
    const list = vi.fn<(params: Record<string, any>) => Promise<unknown[]>>(
      (params) =>
        Promise.resolve(
          String(params.filter.ids)
            .split(',')
            .map((id) => ({ id, item_type: { id: PAGE } }))
        )
    )
    const find = vi.fn<(id: string) => Promise<unknown>>((id) =>
      Promise.resolve({ id, item_type: { id: PAGE } })
    )

    return {
      client: { items: { list, find } } as unknown as Client,
      list,
      find
    }
  }

  const ids = (count: number) =>
    Array.from({ length: count }, (_, index) => `rec-${index}`)

  // The point of the change: a page built from hundreds of referenced records
  // must not cost hundreds of round trips.
  it('fetches in batches rather than one request per record', async () => {
    const { client, list, find } = buildRecordClient()

    const loaded = await fetchLinkedRecords(client, ids(70))

    expect(Object.keys(loaded)).toHaveLength(70)
    expect(list).toHaveBeenCalledTimes(3)
    expect(find).not.toHaveBeenCalled()
  })

  it('asks for the block payloads the walk needs', async () => {
    const { client, list } = buildRecordClient()

    await fetchLinkedRecords(client, ids(2))

    expect(list.mock.calls[0][0]).toMatchObject({
      filter: { ids: 'rec-0,rec-1' },
      nested: true,
      version: 'current'
    })
  })

  // One unreadable reference must not cost the twenty-nine beside it.
  it('falls back to one at a time when a batch fails', async () => {
    const { client, list, find } = buildRecordClient()

    list.mockRejectedValueOnce(new Error('one of these is not readable'))
    find.mockRejectedValueOnce(new Error('not readable'))

    const loaded = await fetchLinkedRecords(client, ids(3))

    expect(Object.keys(loaded)).toHaveLength(2)
    expect(find).toHaveBeenCalledTimes(3)
  })
})
