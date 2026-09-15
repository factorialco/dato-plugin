import { describe, expect, it } from 'vitest'
import type { FieldsByItemType } from './replaceEngine'
import { transformRecord } from './replaceEngine'

const PAGE = 'page-t'
const FEATURE = 'feature-t'
const CTA = 'cta-t'

const NAMES = {
  [PAGE]: 'Page',
  [FEATURE]: 'Feature Component',
  [CTA]: 'Action CTA'
}

const block = (
  id: string,
  itemTypeId: string,
  attributes: Record<string, unknown>
) => ({
  id,
  type: 'item',
  attributes,
  relationships: { item_type: { data: { id: itemTypeId, type: 'item_type' } } }
})

const OPTIONS = {
  find: '/pricing',
  replace: '/plans',
  caseSensitive: false,
  wholeWord: false
}

const run = (fieldsByItemType: FieldsByItemType, sections: unknown[]) =>
  transformRecord({
    record: { id: 'rec-1', sections_block: sections },
    itemTypeId: PAGE,
    fieldsByItemType,
    namesByItemType: NAMES,
    options: OPTIONS,
    locale: 'en'
  })

const PAGE_FIELDS: FieldsByItemType = {
  [PAGE]: [
    {
      apiKey: 'sections_block',
      label: 'Sections',
      fieldType: 'rich_text',
      localized: false
    }
  ]
}

describe('blocks that cannot be searched', () => {
  // The shape a record read *without* `nested` comes back as: block fields hold
  // ids. Searching it silently finds nothing, which is indistinguishable from
  // a page that genuinely has nothing.
  it('reports a block that came back as an id', () => {
    const { matches, unsearched } = run(PAGE_FIELDS, ['blk-not-loaded'])

    expect(matches).toHaveLength(0)
    expect(unsearched).toStrictEqual([
      { path: 'Sections', reason: 'not-loaded' }
    ])
  })

  it('reports a block whose type it has no fields for', () => {
    const { unsearched } = run(PAGE_FIELDS, [
      block('b1', FEATURE, { ctas: [] })
    ])

    expect(unsearched).toStrictEqual([
      { path: 'Sections › Feature Component', reason: 'unknown-type' }
    ])
  })

  it('says nothing when everything was searched', () => {
    const fields: FieldsByItemType = {
      ...PAGE_FIELDS,
      [FEATURE]: [
        { apiKey: 'url', label: 'URL', fieldType: 'string', localized: false }
      ]
    }
    const { matches, unsearched } = run(fields, [
      block('b1', FEATURE, { url: 'https://factorialhr.com/pricing' })
    ])

    expect(matches).toHaveLength(1)
    expect(unsearched).toStrictEqual([])
  })

  it('finds a URL three blocks down', () => {
    const fields: FieldsByItemType = {
      ...PAGE_FIELDS,
      [FEATURE]: [
        {
          apiKey: 'ctas',
          label: 'CTAs',
          fieldType: 'rich_text',
          localized: false
        }
      ],
      [CTA]: [
        {
          apiKey: 'external_url',
          label: 'External URL',
          fieldType: 'string',
          localized: false
        }
      ]
    }
    const { matches, unsearched } = run(fields, [
      block('b1', FEATURE, {
        ctas: [
          block('b2', CTA, { external_url: 'https://factorialhr.com/pricing' })
        ]
      })
    ])

    expect(matches.map((match) => match.path)).toStrictEqual([
      'Sections › Feature Component › CTAs › Action CTA › External URL'
    ])
    expect(unsearched).toStrictEqual([])
  })
})
