import { describe, expect, it } from 'vitest'
import { buildLinkOptions, internalPathOf } from './linkTargets'

const RESOLVER = { pathOf: () => null, recordAt: () => null }
const CONVENTION = {
  linkTypeApiKey: 'link_type',
  externalTypeValue: 'external',
  externalUrlApiKey: 'external_url'
}

describe(internalPathOf, () => {
  it('takes a bare path as-is', () => {
    expect(internalPathOf('/pricing')).toBe('/pricing')
    expect(internalPathOf('/pricing/')).toBe('/pricing')
  })

  it('reads the path out of a market URL', () => {
    expect(internalPathOf('https://factorialhr.com/hr-software')).toBe(
      '/hr-software'
    )
    expect(internalPathOf('factorial.ke/payroll')).toBe('/payroll')
  })

  it('strips the market prefix on the consolidated domain', () => {
    expect(internalPathOf('https://factorial.com/gr/pricing')).toBe('/pricing')
  })

  // The distinction the external fallback turns on: a URL no market claims
  // cannot be expressed as a record in this project.
  it('treats a non-market domain as external', () => {
    expect(internalPathOf('https://trust.factorial.co/')).toBeNull()
    expect(internalPathOf('https://example.org/x')).toBeNull()
  })

  it('returns null for empty or unparseable input', () => {
    expect(internalPathOf('')).toBeNull()
    expect(internalPathOf('   ')).toBeNull()
  })
})

describe(buildLinkOptions, () => {
  const build = (find: string, replace: string) =>
    buildLinkOptions({
      find,
      replace,
      resolver: RESOLVER,
      convention: CONVENTION
    })

  it('is off when the search is not for a URL', () => {
    expect(build('Factorial HR', 'Factorial')).toBeNull()
  })

  it('resolves both sides when the replacement is a page', () => {
    expect(build('/pricing', '/plans')).toMatchObject({
      findPath: '/pricing',
      replacePath: '/plans'
    })
  })

  it('leaves replacePath null when the replacement is outside the project', () => {
    expect(build('/privacy', 'https://trust.factorial.co/')).toMatchObject({
      findPath: '/privacy',
      replacePath: null,
      replaceUrl: 'https://trust.factorial.co/'
    })
  })
})
