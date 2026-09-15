import { describe, expect, it } from 'vitest'
import type { FieldsByItemType, Match, MatchOptions } from './replaceEngine'
import { findOccurrences, transformRecord } from './replaceEngine'

/** Picks the one match a test is about, failing loudly if it is not there. */
const matchAt = (
  matches: Match[],
  predicate: (match: Match) => boolean
): Match => {
  const match = matches.find((candidate) => predicate(candidate))

  if (!match) {
    throw new Error('Expected a match but found none')
  }

  return match
}

const OPTIONS: MatchOptions = {
  find: 'https://factorial.ke/privacy',
  replace: 'https://trust.factorial.co/',
  caseSensitive: false,
  wholeWord: false
}

const PAGE = 'page-type'
const HERO = 'hero-type'

const FIELDS: FieldsByItemType = {
  [PAGE]: [
    { apiKey: 'title', label: 'Title', fieldType: 'string', localized: true },
    { apiKey: 'slug', label: 'Slug', fieldType: 'slug', localized: true },
    {
      apiKey: 'body',
      label: 'Body',
      fieldType: 'structured_text',
      localized: true
    },
    {
      apiKey: 'sections',
      label: 'Sections',
      fieldType: 'rich_text',
      localized: false
    },
    { apiKey: 'meta', label: 'SEO', fieldType: 'seo', localized: true },
    { apiKey: 'topic', label: 'Topic', fieldType: 'link', localized: false }
  ],
  [HERO]: [
    {
      apiKey: 'cta_url',
      label: 'CTA URL',
      fieldType: 'string',
      localized: false
    },
    { apiKey: 'note', label: 'Note', fieldType: 'text', localized: false }
  ]
}

const NAMES = { [PAGE]: 'Page', [HERO]: 'Hero' }

const block = (id: string, attributes: Record<string, unknown>) => ({
  id,
  type: 'item',
  attributes,
  relationships: { item_type: { data: { id: HERO, type: 'item_type' } } }
})

const span = (value: string) => ({ type: 'span', value })

const buildRecord = () => ({
  id: 'rec-1',
  title: { en_ke: 'Privacy at Factorial', es: 'Privacidad' },
  slug: { en_ke: 'payroll', es: 'nominas' },
  body: {
    en_ke: {
      schema: 'dast',
      document: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              span('Read https://factorial.ke/privacy for details.'),
              {
                type: 'link',
                url: 'https://factorial.ke/privacy',
                children: [span('our privacy policy')]
              }
            ]
          },
          {
            type: 'block',
            item: block('blk-nested', {
              cta_url: 'https://factorial.ke/privacy',
              note: 'n/a'
            })
          }
        ]
      }
    },
    es: {
      schema: 'dast',
      document: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [span('Ver https://factorial.ke/privacy')]
          }
        ]
      }
    }
  },
  sections: [
    block('blk-a', {
      cta_url: 'https://factorial.ke/privacy',
      note: 'untouched'
    }),
    block('blk-b', { cta_url: '/pricing', note: 'untouched' })
  ],
  meta: {
    en_ke: {
      title: 'Privacy — https://factorial.ke/privacy',
      description: 'No match here'
    }
  },
  topic: 'some-record-id'
})

const dryRun = (locale: string | null = 'en_ke') =>
  transformRecord({
    record: buildRecord(),
    itemTypeId: PAGE,
    fieldsByItemType: FIELDS,
    namesByItemType: NAMES,
    options: OPTIONS,
    locale
  })

describe(findOccurrences, () => {
  it('finds every non-overlapping occurrence', () => {
    expect(findOccurrences('a-b-a-b', { ...OPTIONS, find: 'a' })).toStrictEqual(
      [
        { start: 0, end: 1 },
        { start: 4, end: 5 }
      ]
    )
  })

  it('is case-insensitive unless asked otherwise', () => {
    expect(
      findOccurrences('Foo foo', { ...OPTIONS, find: 'foo' })
    ).toHaveLength(2)
    expect(
      findOccurrences('Foo foo', {
        ...OPTIONS,
        find: 'foo',
        caseSensitive: true
      })
    ).toHaveLength(1)
  })

  it('honours whole-word matching', () => {
    const options = { ...OPTIONS, find: 'cat', wholeWord: true }

    expect(findOccurrences('a cat sat', options)).toHaveLength(1)
    expect(findOccurrences('concatenate', options)).toHaveLength(0)
  })

  it('returns nothing for an empty needle', () => {
    expect(findOccurrences('anything', { ...OPTIONS, find: '' })).toStrictEqual(
      []
    )
  })
})

describe('transformRecord dry run', () => {
  it('finds matches in text, structured text, link URLs, nested blocks and SEO', () => {
    const { matches } = dryRun()

    expect(matches.map((match) => match.path)).toStrictEqual([
      'Body › en_ke',
      'Body › en_ke › link URL',
      'Body › en_ke › Hero › CTA URL',
      'Sections › Hero › CTA URL',
      'SEO › en_ke › title'
    ])
  })

  it('produces no update payload on its own', () => {
    expect(dryRun().changedFields).toStrictEqual({})
  })

  it('restricts localized fields to the target locale', () => {
    expect(
      dryRun('en_ke').matches.some((match) => match.locale === 'es')
    ).toBeFalsy()
    expect(
      dryRun(null).matches.some((match) => match.locale === 'es')
    ).toBeTruthy()
  })

  it('ignores field types that cannot hold editable prose', () => {
    expect(
      dryRun().matches.some((match) => match.path.includes('Topic'))
    ).toBeFalsy()
  })

  it('shows the replacement in context', () => {
    const seo = matchAt(dryRun().matches, (match) =>
      match.path.endsWith('title')
    )

    expect(seo.prefix).toBe('Privacy — ')
    expect(seo.matched).toBe('https://factorial.ke/privacy')
    expect(seo.replacement).toBe('https://trust.factorial.co/')
    expect(seo.suffix).toBe('')
  })
})

describe('transformRecord apply', () => {
  const apply = (keys: string[]) =>
    transformRecord({
      record: buildRecord(),
      itemTypeId: PAGE,
      fieldsByItemType: FIELDS,
      namesByItemType: NAMES,
      options: OPTIONS,
      locale: 'en_ke',
      enabledKeys: new Set(keys)
    })

  it('rewrites every enabled occurrence and nothing else', () => {
    const { matches } = dryRun()
    const { changedFields } = apply(matches.map((match) => match.key))

    expect(new Set(Object.keys(changedFields))).toStrictEqual(
      new Set(['body', 'meta', 'sections'])
    )

    const body = changedFields.body as Record<string, any>
    const paragraph = body.en_ke.document.children[0]

    expect(paragraph.children[0].value).toBe(
      'Read https://trust.factorial.co/ for details.'
    )
    expect(paragraph.children[1].url).toBe('https://trust.factorial.co/')
    expect(body.en_ke.document.children[1].item.attributes.cta_url).toBe(
      'https://trust.factorial.co/'
    )
    expect((changedFields.meta as any).en_ke.title).toBe(
      'Privacy — https://trust.factorial.co/'
    )
  })

  it('leaves other locales of a localized field untouched', () => {
    const { matches } = dryRun()
    const body = apply(matches.map((m) => m.key)).changedFields.body as Record<
      string,
      any
    >

    expect(body.es.document.children[0].children[0].value).toBe(
      'Ver https://factorial.ke/privacy'
    )
  })

  it('collapses unchanged sibling blocks to their id', () => {
    const { matches } = dryRun()
    const sections = apply(matches.map((m) => m.key)).changedFields
      .sections as unknown[]

    expect(sections[1]).toBe('blk-b')
    expect(sections[0]).toMatchObject({ id: 'blk-a' })
  })

  it('rewrites only the selected occurrence when some are deselected', () => {
    const { matches } = dryRun()
    const only = matchAt(
      matches,
      (match) => match.path === 'Sections › Hero › CTA URL'
    )
    const { changedFields } = apply([only.key])

    expect(Object.keys(changedFields)).toStrictEqual(['sections'])
    expect((changedFields.sections as any[])[0].attributes.cta_url).toBe(
      'https://trust.factorial.co/'
    )
  })

  it('writes nothing when no occurrence is selected', () => {
    expect(apply([]).changedFields).toStrictEqual({})
  })

  it('keys occurrences by block id, so reordering does not shift them', () => {
    const record = buildRecord()
    const keysInOrder = dryRun().matches.map((match) => match.key)

    record.sections = [record.sections[1], record.sections[0]]

    const reordered = transformRecord({
      record,
      itemTypeId: PAGE,
      fieldsByItemType: FIELDS,
      namesByItemType: NAMES,
      options: OPTIONS,
      locale: 'en_ke'
    })

    expect(new Set(reordered.matches.map((match) => match.key))).toStrictEqual(
      new Set(keysInOrder)
    )
  })
})

describe('nested block recursion', () => {
  const PAGE_T = 'page-t'
  const SECTION_T = 'section-t'
  const INNER_T = 'inner-t'

  const fields: FieldsByItemType = {
    [PAGE_T]: [
      {
        apiKey: 'sections',
        label: 'Sections',
        fieldType: 'rich_text',
        localized: true
      }
    ],
    [SECTION_T]: [
      {
        apiKey: 'cta_url',
        label: 'CTA URL',
        fieldType: 'string',
        localized: false
      },
      {
        apiKey: 'inner',
        label: 'Inner',
        fieldType: 'rich_text',
        localized: false
      }
    ],
    [INNER_T]: [
      { apiKey: 'body', label: 'Body', fieldType: 'text', localized: false }
    ]
  }

  const names = { [PAGE_T]: 'Page', [SECTION_T]: 'Section', [INNER_T]: 'Inner' }

  const nested = (id: string, itemTypeId: string, attributes: object) => ({
    id,
    type: 'item',
    attributes,
    relationships: {
      item_type: { data: { id: itemTypeId, type: 'item_type' } }
    }
  })

  const record = {
    id: 'p1',
    sections: {
      'en-ke': [
        nested('b1', SECTION_T, {
          cta_url: 'https://factorial.ke/privacy',
          inner: [
            nested('b2', INNER_T, { body: 'see https://factorial.ke/privacy' })
          ]
        })
      ]
    }
  }

  const scan = (locale: string | null) =>
    transformRecord({
      record,
      itemTypeId: PAGE_T,
      fieldsByItemType: fields,
      namesByItemType: names,
      options: OPTIONS,
      locale
    })

  it('descends through a block list and into blocks inside blocks', () => {
    expect(scan('en-ke').matches.map((match) => match.path)).toStrictEqual([
      'Sections › en-ke › Section › CTA URL',
      'Sections › en-ke › Section › Inner › Inner › Body'
    ])
  })

  // Localized fields are filtered to the requested locale, so resolving the
  // wrong one makes a page look as though its blocks were never searched.
  // This is what made a mis-resolved locale present as "search is not
  // recursing into blocks".
  it('finds nothing in those blocks under a different locale', () => {
    expect(scan('en').matches).toStrictEqual([])
  })
})
