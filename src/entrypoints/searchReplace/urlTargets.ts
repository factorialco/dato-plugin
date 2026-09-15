import type { Market } from './marketLocale'
import {
  contentPathFor,
  isBlogPath,
  normalizePath,
  resolveDatoLocale,
  resolveMarket
} from './marketLocale'

/** Why a pasted URL will not be searched. `null` means it will be. */
export type TargetSkipReason =
  | 'blog'
  | 'invalid-url'
  | 'unknown-market'
  | 'unknown-locale'
  | 'duplicate'

export type ParsedTarget = {
  /** The line exactly as pasted, used as the row's identity in the UI. */
  raw: string
  market: Market | null
  /** Project locale to edit, e.g. `en_ke`. */
  datoLocale: string | null
  /** Path within the market, market prefix stripped, e.g. `/partnerships`. */
  contentPath: string | null
  skipReason: TargetSkipReason | null
  /**
   * True when the market's regional locale is absent from the project and its
   * bare language was used instead. Correct for markets that really are the
   * language (Greece is `el`), wrong for one that shares another region's
   * content (Argentina uses `es-MX`), which only `market_configuration` can
   * express — so it is surfaced rather than silently trusted.
   */
  localeFromLanguage: boolean
}

const withProtocol = (line: string): string =>
  /^https?:\/\//i.test(line) ? line : `https://${line}`

const parseUrl = (line: string): URL | null => {
  try {
    return new URL(withProtocol(line))
  } catch {
    return null
  }
}

/**
 * Turns the pasted "where" list into resolved targets, one per non-empty line.
 *
 * Every line comes back, including the ones that cannot be searched, so the dry
 * run can show *why* a URL was left out rather than silently dropping it. Blog
 * URLs are skipped on purpose: that content lives in WordPress, not here.
 */
export const parseTargets = (
  text: string,
  siteLocales: string[],
  datoLocaleByTld: Record<string, string> = {}
): ParsedTarget[] => {
  const seen = new Set<string>()

  return text
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replaceAll(/^["'`]|["',`]+$/g, '')
        .trim()
    )
    .filter((line) => line.length > 0)
    .map((raw): ParsedTarget => {
      const url = parseUrl(raw)

      if (!url) {
        return {
          raw,
          market: null,
          datoLocale: null,
          contentPath: null,
          skipReason: 'invalid-url',
          localeFromLanguage: false
        }
      }

      if (isBlogPath(url.pathname)) {
        return {
          raw,
          market: null,
          datoLocale: null,
          contentPath: normalizePath(url.pathname),
          skipReason: 'blog',
          localeFromLanguage: false
        }
      }

      const market = resolveMarket(url)

      if (!market) {
        return {
          raw,
          market: null,
          datoLocale: null,
          contentPath: normalizePath(url.pathname),
          skipReason: 'unknown-market',
          localeFromLanguage: false
        }
      }

      const contentPath = contentPathFor(url, market)
      const resolution = resolveDatoLocale(market, siteLocales, datoLocaleByTld)

      if (!resolution) {
        return {
          raw,
          market,
          datoLocale: null,
          contentPath,
          skipReason: 'unknown-locale',
          localeFromLanguage: false
        }
      }

      const datoLocale = resolution.locale

      const identity = `${datoLocale}::${contentPath}`
      const skipReason = seen.has(identity) ? ('duplicate' as const) : null
      seen.add(identity)

      return {
        raw,
        market,
        datoLocale,
        contentPath,
        skipReason,
        localeFromLanguage: resolution.source === 'language'
      }
    })
}

export const SKIP_REASON_LABELS: Record<TargetSkipReason, string> = {
  blog: 'Blog URL — edited in WordPress, skipped',
  'invalid-url': 'Not a valid URL',
  'unknown-market': 'No market matches this domain',
  'unknown-locale': 'Market has no matching locale in this project',
  duplicate: 'Same page as an earlier line'
}

export const searchableTargets = (targets: ParsedTarget[]): ParsedTarget[] =>
  targets.filter((target) => target.skipReason === null)
