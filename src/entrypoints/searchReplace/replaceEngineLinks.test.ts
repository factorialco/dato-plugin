import { describe, expect, it } from 'vitest'
import type {
  FieldsByItemType,
  LinkOptions,
  MatchOptions
} from './replaceEngine'
import { transformRecord } from './replaceEngine'

const PAGE = 'page-type'
const CTA = 'cta-type'

const PRICING_ID = 'rec-pricing'
const PLANS_ID = 'rec-plans'

const FIELDS: FieldsByItemType = {
  [PAGE]: [
    {
      apiKey: 'sections',
      label: 'Sections',
      fieldType: 'rich_text',
      localized: false
    },
    {
      apiKey: 'topic',
      label: 'Topic',
      fieldType: 'link',
      localized: false,
      linkedItemTypeIds: [PAGE]
    }
  ],
  [CTA]: [
    { apiKey: 'label', label: 'Label', fieldType: 'string', localized: false },
    {
      apiKey: 'link_type',
      label: 'Link type',
      fieldType: 'string',
      localized: false
    },
    {
      apiKey: 'internal_page',
      label: 'Internal page',
      fieldType: 'link',
      localized: false,
      linkedItemTypeIds: [PAGE]
    },
    {
      apiKey: 'external_url',
      label: 'External URL',
      fieldType: 'string',
      localized: false
    }
  ]
}

const NAMES = { [PAGE]: 'Page', [CTA]: 'CTA' }

const OPTIONS: MatchOptions = {
  find: '/pricing',
  replace: '/plans',
  caseSensitive: false,
  wholeWord: false
}

const CONVENTION = {
  linkTypeApiKey: 'link_type',
  externalTypeValue: 'external',
  externalUrlApiKey: 'external_url'
}

const linkOptions = (over: Partial<LinkOptions> = {}): LinkOptions => ({
  findPath: '/pricing',
  replacePath: '/plans',
  replaceUrl: 'https://factorialhr.com/plans',
  findRecordId: PRICING_ID,
  replaceRecordId: PLANS_ID,
  convention: CONVENTION,
  ...over
})

const cta = (attributes: Record<string, unknown>) => ({
  id: 'blk-cta',
  type: 'item',
  attributes,
  relationships: { item_type: { data: { id: CTA, type: 'item_type' } } }
})

const buildRecord = () => ({
  id: 'rec-1',
  sections: [
    cta({
      label: 'See pricing',
      link_type: 'internal',
      internal_page: PRICING_ID,
      external_url: null
    })
  ],
  topic: PRICING_ID
})

const run = (link: LinkOptions | null, enabledKeys?: Set<string>) =>
  transformRecord({
    record: buildRecord(),
    itemTypeId: PAGE,
    fieldsByItemType: FIELDS,
    namesByItemType: NAMES,
    options: OPTIONS,
    locale: 'en',
    link,
    enabledKeys
  })

describe('reference links', () => {
  it('is invisible to a plain text search', () => {
    // The string "/pricing" is never stored on this record; the site builds it
    // from the linked page's slug.
    expect(run(null).matches).toHaveLength(0)
  })

  it('finds links whose target renders at the searched path', () => {
    const { matches } = run(linkOptions())

    expect(matches.map((match) => match.path)).toStrictEqual([
      'Sections › CTA › Internal page',
      'Topic'
    ])
    expect(matches[0].matched).toBe('/pricing (linked page)')
    expect(matches[0].replacement).toBe('/plans (linked page)')
  })

  it('repoints the reference when the replacement is a page', () => {
    const { matches } = run(linkOptions())
    const { changedFields } = run(
      linkOptions(),
      new Set(matches.map((match) => match.key))
    )

    const block = (changedFields.sections as Array<Record<string, any>>)[0]

    expect(block.attributes.internal_page).toBe(PLANS_ID)
    // Still internal, so it keeps following that page if its slug changes.
    expect(block.attributes.link_type).toBe('internal')
    expect(changedFields.topic).toBe(PLANS_ID)
  })

  it('converts to an external link when nothing matches the replacement', () => {
    const external = linkOptions({
      replacePath: null,
      replaceRecordId: null,
      replaceUrl: 'https://trust.factorial.co/'
    })
    const { matches } = run(external)
    const { changedFields } = run(
      external,
      new Set(matches.map((match) => match.key))
    )

    const block = (changedFields.sections as Array<Record<string, any>>)[0]

    expect(block.attributes.link_type).toBe('external')
    expect(block.attributes.external_url).toBe('https://trust.factorial.co/')
    expect(block.attributes.internal_page).toBeNull()
  })

  it('reports, but will not touch, a reference it cannot express', () => {
    // `topic` sits on the record, which has no link_type/external_url pair.
    const external = linkOptions({
      replacePath: null,
      replaceRecordId: null,
      replaceUrl: 'https://trust.factorial.co/'
    })
    const topic = run(external).matches.find((match) => match.path === 'Topic')

    expect(topic?.applicable).toBeFalsy()
    expect(topic?.note).toContain('external_url')
  })

  it('leaves an unapplicable reference alone even when selected', () => {
    const external = linkOptions({
      replacePath: null,
      replaceRecordId: null,
      replaceUrl: 'https://trust.factorial.co/'
    })
    const { matches } = run(external)
    const { changedFields } = run(
      external,
      new Set(matches.map((match) => match.key))
    )

    expect(changedFields.topic).toBeUndefined()
  })

  it('ignores references pointing somewhere else', () => {
    const elsewhere = linkOptions({
      findPath: '/careers',
      findRecordId: 'rec-careers'
    })

    expect(run(elsewhere).matches).toHaveLength(0)
  })

  it('writes nothing when no occurrence is selected', () => {
    expect(run(linkOptions(), new Set()).changedFields).toStrictEqual({})
  })
})
