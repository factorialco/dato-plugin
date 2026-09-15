import { expect, describe, it } from 'vitest'
import { parseTargets, searchableTargets } from './urlTargets'

const LOCALES = ['en', 'es', 'en_ke', 'el', 'pt_BR']

const EXAMPLE = `
"https://factorial.ke/partnerships"
"https://factorial.ke/device-management-mdm"
"https://factorial.ke/blog/"
"https://factorial.ke/payroll"
`

describe(parseTargets, () => {
  it('resolves locale and path from the URL, stripping pasted quotes', () => {
    const targets = parseTargets(EXAMPLE, LOCALES)

    expect(targets.map((target) => target.contentPath)).toStrictEqual([
      '/partnerships',
      '/device-management-mdm',
      '/blog',
      '/payroll'
    ])
    expect(targets.every((target) => !target.raw.includes('"'))).toBeTruthy()
    expect(
      searchableTargets(targets).map((target) => target.datoLocale)
    ).toStrictEqual(['en_ke', 'en_ke', 'en_ke'])
  })

  it('skips blog URLs without dropping them from the report', () => {
    const blog = parseTargets(EXAMPLE, LOCALES).find(
      (target) => target.contentPath === '/blog'
    )

    expect(blog?.skipReason).toBe('blog')
    expect(searchableTargets(parseTargets(EXAMPLE, LOCALES))).toHaveLength(3)
  })

  it('flags URLs no market or locale claims', () => {
    const targets = parseTargets(
      [
        'https://example.org/x',
        'https://factorialhr.com.br/y',
        'not a url'
      ].join('\n'),
      ['en']
    )

    expect(targets.map((target) => target.skipReason)).toStrictEqual([
      'unknown-market',
      'unknown-locale',
      'invalid-url'
    ])
  })

  it('marks a repeated page as a duplicate, keeping the first', () => {
    const targets = parseTargets(
      ['https://factorial.ke/payroll', 'factorial.ke/payroll/'].join('\n'),
      LOCALES
    )

    expect(targets.map((target) => target.skipReason)).toStrictEqual([
      null,
      'duplicate'
    ])
  })

  it('accepts URLs pasted without a protocol', () => {
    expect(parseTargets('factorial.ke/payroll', LOCALES)[0]).toMatchObject({
      datoLocale: 'en_ke',
      contentPath: '/payroll',
      skipReason: null
    })
  })
})
