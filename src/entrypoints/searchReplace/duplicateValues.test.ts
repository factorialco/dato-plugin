import { describe, expect, it } from 'vitest'
import type { FieldsByItemType, LinkedRecord } from './replaceEngine'
import { transformRecord } from './replaceEngine'

const PAGE = 'page-t'
const CTA = 'cta-t'
const SHARED = 'rec-shared'

const FIELDS: FieldsByItemType = {
  [PAGE]: [
    {
      apiKey: 'cta',
      label: 'CTA',
      fieldType: 'link',
      localized: false,
      linkedItemTypeIds: [CTA]
    }
  ],
  [CTA]: [
    { apiKey: 'url', label: 'URL', fieldType: 'string', localized: false }
  ]
}

const NAMES = { [PAGE]: 'Page', [CTA]: 'Action CTA' }

const OPTIONS = {
  find: '/pricing',
  replace: '/plans',
  caseSensitive: false,
  wholeWord: false
}

const linked: Record<string, LinkedRecord> = {
  [SHARED]: {
    itemTypeId: CTA,
    values: { url: 'https://factorialhr.com/pricing' }
  }
}

const walkPage = (pageId: string) =>
  transformRecord({
    record: { id: pageId, cta: SHARED },
    itemTypeId: PAGE,
    fieldsByItemType: FIELDS,
    namesByItemType: NAMES,
    options: OPTIONS,
    locale: 'en',
    linkedRecords: linked
  })

describe('one value reached from several pages', () => {
  // A shared component is reached from every page that uses it. The match is
  // reported under each, because that is where someone looking for it will
  // look — but it is one stored value and one edit.
  it('reports it under each page that reaches it', () => {
    expect(walkPage('page-a').matches).toHaveLength(1)
    expect(walkPage('page-b').matches).toHaveLength(1)
  })

  it('gives it the same value identity whichever page found it', () => {
    expect(walkPage('page-a').matches[0].valueKey).toBe(
      walkPage('page-b').matches[0].valueKey
    )
  })

  // Reached through differently-named fields, the occurrence key differs —
  // it carries the route — while the value identity does not. That is the
  // case the identity exists for.
  it('identifies the value the same however it was reached', () => {
    const viaSecondary: FieldsByItemType = {
      [PAGE]: [
        {
          apiKey: 'secondary_cta',
          label: 'Secondary CTA',
          fieldType: 'link',
          localized: false,
          linkedItemTypeIds: [CTA]
        }
      ],
      [CTA]: FIELDS[CTA]
    }
    const other = transformRecord({
      record: { id: 'page-b', secondary_cta: SHARED },
      itemTypeId: PAGE,
      fieldsByItemType: viaSecondary,
      namesByItemType: NAMES,
      options: OPTIONS,
      locale: 'en',
      linkedRecords: linked
    })

    const first = walkPage('page-a').matches[0]

    expect(other.matches[0].key).not.toBe(first.key)
    expect(other.matches[0].valueKey).toBe(first.valueKey)
  })

  it('distinguishes different values inside the same record', () => {
    const twoFields: FieldsByItemType = {
      ...FIELDS,
      [CTA]: [
        { apiKey: 'url', label: 'URL', fieldType: 'string', localized: false },
        { apiKey: 'alt', label: 'Alt', fieldType: 'string', localized: false }
      ]
    }
    const { matches } = transformRecord({
      record: { id: 'page-a', cta: SHARED },
      itemTypeId: PAGE,
      fieldsByItemType: twoFields,
      namesByItemType: NAMES,
      options: OPTIONS,
      locale: 'en',
      linkedRecords: {
        [SHARED]: {
          itemTypeId: CTA,
          values: { url: '/pricing', alt: '/pricing' }
        }
      }
    })

    expect(matches).toHaveLength(2)
    expect(matches[0].valueKey).not.toBe(matches[1].valueKey)
  })
})
