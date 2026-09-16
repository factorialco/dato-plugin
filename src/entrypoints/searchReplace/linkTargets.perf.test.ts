import { describe, expect, it } from 'vitest'
import type { FieldsByItemType } from './replaceEngine'
import { linkTargetModelIds } from './searchReplace.services'

const PAGE = 'page-t'
const SECTIONS = 'sections-t'
const TAG = 'tag-t'

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
      linkedItemTypeIds: [TAG]
    }
  ],
  [SECTIONS]: [
    { apiKey: 'body', label: 'Body', fieldType: 'text', localized: false }
  ]
}

describe(linkTargetModelIds, () => {
  it('finds what the given types can point at, across both reference kinds', () => {
    expect(linkTargetModelIds(FIELDS, [PAGE])).toStrictEqual([SECTIONS, TAG])
  })

  // The scoping that keeps a scan from indexing the whole project: a type with
  // no references contributes no models to index.
  it('returns nothing for a type that holds no references', () => {
    expect(linkTargetModelIds(FIELDS, [SECTIONS])).toStrictEqual([])
  })

  it('ignores types whose fields are not loaded', () => {
    expect(linkTargetModelIds(FIELDS, ['never-loaded'])).toStrictEqual([])
  })
})
