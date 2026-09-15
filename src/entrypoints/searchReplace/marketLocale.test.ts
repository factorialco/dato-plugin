import { describe, expect, it } from 'vitest'
import type { Market } from './marketLocale'
import {
  contentPathFor,
  isBlogPath,
  resolveMarket,
  toDatoLocale
} from './marketLocale'

const marketOf = (href: string) => resolveMarket(new URL(href))

/** Resolves a market, failing the test rather than asserting non-null. */
const expectMarket = (href: string): Market => {
  const market = marketOf(href)

  if (!market) {
    throw new Error(`Expected ${href} to resolve to a market`)
  }

  return market
}

describe(resolveMarket, () => {
  it('resolves a ccTLD market', () => {
    expect(marketOf('https://factorial.ke/partnerships')?.locale).toBe('en-KE')
    expect(marketOf('https://factorial.es/precios')?.locale).toBe('es-ES')
  })

  it('prefers the multi-part TLD over the single-part one', () => {
    expect(marketOf('https://factorialhr.com.br/precos')?.locale).toBe('pt-BR')
    expect(marketOf('https://factorialhr.co.uk/pricing')?.locale).toBe('en-GB')
  })

  it('resolves migrated markets from their prefix on the consolidated domain', () => {
    expect(marketOf('https://factorial.com/el/pricing')?.locale).toBe('el-GR')
    expect(marketOf('https://factorial.com/za/pricing')?.locale).toBe('en-ZA')
  })

  it('does not treat the consolidated domain itself as the US market', () => {
    expect(marketOf('https://factorial.com/pricing')).toBeNull()
  })

  it('does not match a prefix that is only a substring of the first segment', () => {
    expect(marketOf('https://factorial.com/elsewhere')).toBeNull()
  })

  it('returns null for a domain no market claims', () => {
    expect(marketOf('https://example.org/pricing')).toBeNull()
  })
})

describe(contentPathFor, () => {
  it('leaves ccTLD paths alone', () => {
    const url = new URL('https://factorial.ke/partnerships')

    expect(contentPathFor(url, resolveMarket(url))).toBe('/partnerships')
  })

  it('strips the market prefix on the consolidated domain', () => {
    const url = new URL('https://factorial.com/el/pricing')

    expect(contentPathFor(url, resolveMarket(url))).toBe('/pricing')
  })

  it('normalises trailing slashes and the market root', () => {
    const trailing = new URL('https://factorial.ke/payroll/')
    const root = new URL('https://factorial.com/el')

    expect(contentPathFor(trailing, resolveMarket(trailing))).toBe('/payroll')
    expect(contentPathFor(root, resolveMarket(root))).toBe('/')
  })
})

describe(isBlogPath, () => {
  it.each(['/blog', '/blog/', '/blog/some-post', '/el/blog/post'])(
    'skips %s',
    (path) => expect(isBlogPath(path)).toBeTruthy()
  )

  it.each(['/blogging', '/payroll', '/weblog'])('keeps %s', (path) =>
    expect(isBlogPath(path)).toBeFalsy()
  )
})

describe(toDatoLocale, () => {
  const kenya = expectMarket('https://factorial.ke/x')
  const greece = expectMarket('https://factorial.com/el/x')

  it('matches the underscored locale case-insensitively', () => {
    expect(toDatoLocale(kenya, ['en', 'es', 'en_ke'])).toBe('en_ke')
  })

  it('falls back to the bare language when the region has no locale', () => {
    expect(toDatoLocale(greece, ['en', 'el'])).toBe('el')
  })

  it('prefers the locale configured in the project', () => {
    expect(toDatoLocale(kenya, ['en', 'en_ke'], { ke: 'en' })).toBe('en')
  })

  it('ignores a configured locale the project does not have', () => {
    expect(toDatoLocale(kenya, ['en', 'en_ke'], { ke: 'en_KENYA' })).toBe(
      'en_ke'
    )
  })

  it('returns null when nothing matches', () => {
    expect(toDatoLocale(kenya, ['es', 'fr'])).toBeNull()
  })

  // The project writes its regional locales with hyphens, not underscores.
  // Matching only the underscored form sent every regional market to its bare
  // language: factorial.ke resolved to `en` and found nothing, and worse, a
  // .mx URL would have edited `es` instead of `es-MX`.
  const PROJECT_LOCALES = [
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'pt-BR',
    'en-GB',
    'es-MX',
    'ca',
    'pl',
    'en-ZA',
    'en-ke',
    'el',
    'sr',
    'en-AE'
  ]

  it.each([
    ['https://factorial.ke/partnerships', 'en-ke'],
    ['https://factorial.mx/precios', 'es-MX'],
    ['https://factorial.co.uk/pricing', 'en-GB'],
    ['https://factorial.com.br/precos', 'pt-BR'],
    ['https://factorialhr.co.za/pricing', 'en-ZA'],
    ['https://factorialhr.ae/pricing', 'en-AE']
  ])('resolves %s to the regional locale %s', (href, expected) => {
    expect(toDatoLocale(expectMarket(href), PROJECT_LOCALES)).toBe(expected)
  })

  it('still falls back to the bare language when there is no regional locale', () => {
    // Greece is `el` in the project, not `el-GR`.
    expect(toDatoLocale(greece, PROJECT_LOCALES)).toBe('el')
  })

  it('prefers the regional locale over the bare language when both exist', () => {
    expect(toDatoLocale(kenya, ['en', 'en-ke'])).toBe('en-ke')
  })
})
