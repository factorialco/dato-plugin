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

  // A type whose definitions simply have not been fetched is not an error:
  // the walk asks for it, the caller loads it, and the walk runs again.
  it('asks for a block type it has not loaded yet', () => {
    const { unsearched, pendingItemTypeIds } = run(PAGE_FIELDS, [
      block('b1', FEATURE, { ctas: [] })
    ])

    expect(pendingItemTypeIds).toStrictEqual([FEATURE])
    expect(unsearched).toStrictEqual([])
  })

  it('reports a block type that really has no fields', () => {
    const { unsearched, pendingItemTypeIds } = run(
      { ...PAGE_FIELDS, [FEATURE]: [] },
      [block('b1', FEATURE, { ctas: [] })]
    )

    expect(pendingItemTypeIds).toStrictEqual([])
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

describe('scan coverage', () => {
  it('counts the blocks opened and values examined', () => {
    const fields: FieldsByItemType = {
      ...PAGE_FIELDS,
      [FEATURE]: [
        {
          apiKey: 'ctas',
          label: 'CTAs',
          fieldType: 'rich_text',
          localized: false
        },
        {
          apiKey: 'title',
          label: 'Title',
          fieldType: 'string',
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
    const { report } = run(fields, [
      block('b1', FEATURE, {
        title: 'Features',
        ctas: [block('b2', CTA, { external_url: '/somewhere' })]
      })
    ])

    expect(report).toMatchObject({ blocks: 2, values: 2 })
  })

  // The signature of a page that was never really searched.
  it('reports no coverage when nothing was loaded', () => {
    const { report } = run(PAGE_FIELDS, ['blk-not-loaded'])

    expect(report).toMatchObject({ blocks: 0, values: 0 })
  })
})

describe('values a walk cannot open', () => {
  it('names the field types it passed over', () => {
    const fields: FieldsByItemType = {
      [PAGE]: [
        {
          apiKey: 'config',
          label: 'Config',
          fieldType: 'json',
          localized: false
        },
        { apiKey: 'hero', label: 'Hero', fieldType: 'video', localized: false }
      ]
    }
    const { report } = transformRecord({
      record: {
        id: 'r1',
        config: { cta: '/pricing' },
        hero: { url: '/pricing' }
      },
      itemTypeId: PAGE,
      fieldsByItemType: fields,
      namesByItemType: NAMES,
      options: OPTIONS,
      locale: 'en'
    })

    expect(report.skippedFieldTypes).toStrictEqual(['json', 'video'])
  })

  // Not a string (so not "not loaded") and not an unknown type: a payload
  // shaped in a way the walk does not recognise as a block at all.
  it('reports a block field holding an unrecognised payload', () => {
    const { unsearched } = run(PAGE_FIELDS, [
      {
        id: 'b1',
        item_type: { id: FEATURE },
        title: 'flattened, no attributes'
      }
    ])

    expect(unsearched).toStrictEqual([
      { path: 'Sections', reason: 'unrecognised-shape' }
    ])
  })

  it('stays quiet when every value was opened', () => {
    const fields: FieldsByItemType = {
      ...PAGE_FIELDS,
      [FEATURE]: [
        { apiKey: 'url', label: 'URL', fieldType: 'string', localized: false }
      ]
    }
    const { report } = run(fields, [block('b1', FEATURE, { url: '/nothing' })])

    expect(report.skippedFieldTypes).toStrictEqual([])
  })
})
