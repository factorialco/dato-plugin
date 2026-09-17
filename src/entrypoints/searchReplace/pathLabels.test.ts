import { describe, expect, it } from 'vitest'
import type { FieldsByItemType } from './replaceEngine'
import { transformRecord } from './replaceEngine'

const PAGE = 'page-t'
const SECTIONS = 'sections-t'

const OPTIONS = {
  find: '/pricing',
  replace: '/plans',
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

const pathsFor = (
  fieldsByItemType: FieldsByItemType,
  namesByItemType: Record<string, string>,
  record: Record<string, unknown> & { id: string }
) =>
  transformRecord({
    record,
    itemTypeId: PAGE,
    fieldsByItemType,
    namesByItemType,
    options: OPTIONS,
    locale: 'en',
    linkedRecords: {}
  }).matches.map((match) => match.path)

describe('breadcrumbs', () => {
  // The locale is shown once beside the path. Repeating it at every localized
  // field was most of the length of a deep path.
  it('leaves the locale out of the path', () => {
    const fields: FieldsByItemType = {
      [PAGE]: [
        { apiKey: 'body', label: 'Body', fieldType: 'string', localized: true }
      ]
    }

    expect(
      pathsFor(
        fields,
        { [PAGE]: 'Page' },
        {
          id: 'r1',
          body: { en: '/pricing' }
        }
      )
    ).toStrictEqual(['Body'])
  })

  it('collapses a record that repeats the field leading to it', () => {
    const fields: FieldsByItemType = {
      [PAGE]: [
        {
          apiKey: 'sections_block',
          label: 'Sections Block',
          fieldType: 'rich_text',
          localized: false
        }
      ],
      [SECTIONS]: [
        { apiKey: 'url', label: 'URL', fieldType: 'string', localized: false }
      ]
    }

    expect(
      pathsFor(
        fields,
        { [PAGE]: 'Page', [SECTIONS]: 'Sections Block' },
        {
          id: 'r1',
          sections_block: [block('b1', SECTIONS, { url: '/pricing' })]
        }
      )
    ).toStrictEqual(['Sections Block › URL'])
  })

  // Real nesting, not noise: a block inside another of the same kind has to
  // stay visible, or the path stops saying where the value sits.
  it('keeps a block nested inside another of the same kind', () => {
    const fields: FieldsByItemType = {
      [PAGE]: [
        {
          apiKey: 'sections',
          label: 'Sections',
          fieldType: 'rich_text',
          localized: false
        }
      ],
      [SECTIONS]: [
        {
          apiKey: 'children',
          label: 'Children',
          fieldType: 'rich_text',
          localized: false
        },
        { apiKey: 'url', label: 'URL', fieldType: 'string', localized: false }
      ]
    }

    expect(
      pathsFor(
        fields,
        { [PAGE]: 'Page', [SECTIONS]: 'Card' },
        {
          id: 'r1',
          sections: [
            block('b1', SECTIONS, {
              children: [block('b2', SECTIONS, { url: '/pricing' })]
            })
          ]
        }
      )
    ).toStrictEqual(['Sections › Card › Children › Card › URL'])
  })
})
