import { describe, expect, it } from 'vitest'
import { findOccurrences } from './replaceEngine'
import { urlSearchVariants } from './urlVariants'

const search = (find: string, replace: string) => ({
  find,
  replace,
  caseSensitive: false,
  wholeWord: false,
  variants: urlSearchVariants(find, replace) ?? undefined
})

const replaceAll = (text: string, find: string, replace: string): string => {
  const options = search(find, replace)

  return findOccurrences(text, options).reduceRight(
    (result, range) =>
      result.slice(0, range.start) + range.replace + result.slice(range.end),
    text
  )
}

describe(urlSearchVariants, () => {
  it('is off when the search is not for a URL', () => {
    expect(urlSearchVariants('Factorial HR', 'Factorial')).toBeNull()
  })

  it('looks for the absolute and the bare-path spelling', () => {
    expect(
      urlSearchVariants(
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toStrictEqual([
      {
        find: 'https://factorialhr.com/pricing',
        replace: 'https://factorialhr.com/pricing-plans',
        pathBoundary: false
      },
      { find: '/pricing', replace: '/pricing-plans', pathBoundary: true }
    ])
  })
})

describe('replacing a URL stored in either shape', () => {
  // The case from the report: searched as an absolute URL, stored as a path.
  it('finds a relative link when searched for by absolute URL', () => {
    expect(
      replaceAll(
        '/pricing',
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toBe('/pricing-plans')
  })

  it('keeps a relative link relative', () => {
    // Rewriting it absolute would pin every market's link to one domain.
    expect(
      replaceAll(
        'See /pricing for details',
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toBe('See /pricing-plans for details')
  })

  it('keeps an absolute link absolute', () => {
    expect(
      replaceAll(
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toBe('https://factorialhr.com/pricing-plans')
  })

  it('rewrites another market spelling of the same page', () => {
    expect(
      replaceAll(
        'https://factorial.ke/pricing',
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toBe('https://factorial.ke/pricing-plans')
  })

  it('does not truncate a longer path that starts the same', () => {
    expect(
      replaceAll(
        '/pricing-calculator',
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toBe('/pricing-calculator')
  })

  it('matches a path followed by a query or another segment', () => {
    expect(
      replaceAll(
        '/pricing?utm=x and /pricing/enterprise',
        'https://factorialhr.com/pricing',
        'https://factorialhr.com/pricing-plans'
      )
    ).toBe('/pricing-plans?utm=x and /pricing-plans/enterprise')
  })

  it('writes an off-site replacement out in full', () => {
    expect(
      replaceAll(
        '/privacy',
        'https://factorial.ke/privacy',
        'https://trust.factorial.co/'
      )
    ).toBe('https://trust.factorial.co/')
  })

  it('leaves plain text searches alone', () => {
    expect(replaceAll('Factorial HR rocks', 'Factorial HR', 'Factorial')).toBe(
      'Factorial rocks'
    )
  })
})
