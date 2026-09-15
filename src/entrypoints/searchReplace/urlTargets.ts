import type { Market } from './marketLocale'
import {
  contentPathFor,
  isBlogPath,
  normalizePath,
  resolveMarket,
  toDatoLocale
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
          skipReason: 'invalid-url'
        }
      }

      if (isBlogPath(url.pathname)) {
        return {
          raw,
          market: null,
          datoLocale: null,
          contentPath: normalizePath(url.pathname),
          skipReason: 'blog'
        }
      }

      const market = resolveMarket(url)

      if (!market) {
        return {
          raw,
          market: null,
          datoLocale: null,
          contentPath: normalizePath(url.pathname),
          skipReason: 'unknown-market'
        }
      }

      const contentPath = contentPathFor(url, market)
      const datoLocale = toDatoLocale(market, siteLocales, datoLocaleByTld)

      if (!datoLocale) {
        return {
          raw,
          market,
          datoLocale: null,
          contentPath,
          skipReason: 'unknown-locale'
        }
      }

      const identity = `${datoLocale}::${contentPath}`
      const skipReason = seen.has(identity) ? ('duplicate' as const) : null
      seen.add(identity)

      return { raw, market, datoLocale, contentPath, skipReason }
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
