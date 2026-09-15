import { describe, expect, it } from 'vitest'
import type { FieldsByItemType, LinkedRecord } from './replaceEngine'
import { transformRecord } from './replaceEngine'

const PAGE = 'page-t'
const SECTIONS = 'sections-t'
const CTA = 'cta-t'

// Mirrors the real shape: Page.sections_block is a *reference* to a
// SectionsBlock record, which DatoCMS renders expanded in the form so it reads
// as though it were nested.
const FIELDS: FieldsByItemType = {
  [PAGE]: [
    { apiKey: 'title', label: 'Title', fieldType: 'string', localized: false },
    {
      apiKey: 'sections_block',
      label: 'Sections',
      fieldType: 'link',
      localized: false,
      linkedItemTypeIds: [SECTIONS]
    },
    {
      apiKey: 'tag_list',
      label: 'Tags',
      fieldType: 'links',
      localized: false,
      linkedItemTypeIds: [CTA]
    }
  ],
  [SECTIONS]: [
    {
      apiKey: 'blocks',
      label: 'Blocks',
      fieldType: 'rich_text',
      localized: false
    }
  ],
  [CTA]: [
    {
      apiKey: 'external_url',
      label: 'Hyperlink to external url',
      fieldType: 'string',
      localized: false
    }
  ]
}

const NAMES = {
  [PAGE]: 'Page',
  [SECTIONS]: 'Sections Block',
  [CTA]: 'Action CTA'
}

const OPTIONS = {
  find: 'https://factorialhr.com/pricing',
  replace: 'https://factorialhr.com/pricing-plans',
  caseSensitive: false,
  wholeWord: false
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

const PAGE_RECORD = {
  id: 'rec-page',
  title: 'HR Software',
  sections_block: 'rec-sections',
  tag_list: []
}

const SECTIONS_RECORD: LinkedRecord = {
  itemTypeId: SECTIONS,
  values: {
    blocks: [
      block('blk-cta', CTA, {
        external_url: 'https://factorialhr.com/pricing'
      })
    ]
  }
}

const run = (
  linkedRecords: Record<string, LinkedRecord>,
  enabledKeys?: Set<string>
) =>
  transformRecord({
    record: PAGE_RECORD,
    itemTypeId: PAGE,
    fieldsByItemType: FIELDS,
    namesByItemType: NAMES,
    options: OPTIONS,
    locale: 'en',
    linkedRecords,
    enabledKeys
  })

describe('pages whose content lives in a linked record', () => {
  // The reported symptom: one block walked, nothing found, nothing flagged.
  it('asks for the referenced record instead of stopping', () => {
    const { matches, pendingLinkIds } = run({})

    expect(matches).toHaveLength(0)
    expect(pendingLinkIds).toStrictEqual(['rec-sections'])
  })

  it('finds the URL once the referenced record is loaded', () => {
    const { matches } = run({ 'rec-sections': SECTIONS_RECORD })

    expect(matches.map((match) => match.path)).toStrictEqual([
      'Sections › Sections Block › Blocks › Action CTA › Hyperlink to external url'
    ])
  })

  it('writes the change against the referenced record, not the page', () => {
    const linked = { 'rec-sections': SECTIONS_RECORD }
    const { matches } = run(linked)
    const applied = run(linked, new Set(matches.map((match) => match.key)))

    expect(applied.changedFields).toStrictEqual({})

    const blocks = applied.changedLinkedRecords['rec-sections'].blocks as Array<
      Record<string, any>
    >

    expect(blocks[0].attributes.external_url).toBe(
      'https://factorialhr.com/pricing-plans'
    )
  })

  it('follows a multi-reference field too', () => {
    const page = { ...PAGE_RECORD, tag_list: ['rec-cta-a', 'rec-cta-b'] }
    const { pendingLinkIds } = transformRecord({
      record: page,
      itemTypeId: PAGE,
      fieldsByItemType: FIELDS,
      namesByItemType: NAMES,
      options: OPTIONS,
      locale: 'en',
      linkedRecords: { 'rec-sections': SECTIONS_RECORD }
    })

    expect(pendingLinkIds).toStrictEqual(['rec-cta-a', 'rec-cta-b'])
  })

  it('does not loop when records reference each other', () => {
    const loop: Record<string, LinkedRecord> = {
      'rec-sections': {
        itemTypeId: PAGE,
        values: { title: 'loop', sections_block: 'rec-page', tag_list: [] }
      }
    }

    expect(() => run(loop)).not.toThrow()
  })
})
