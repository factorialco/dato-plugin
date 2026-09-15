import { contentPathFor, normalizePath, resolveMarket } from './marketLocale'
import type { LinkConvention, LinkOptions, LinkResolver } from './replaceEngine'

/**
 * The path inside this project that a find/replace value points at, or null
 * when it points outside it.
 *
 * A bare path is taken as-is. A full URL only counts as internal when a market
 * claims its domain — `https://trust.factorial.co/` belongs to no market, so it
 * is an address this project cannot express as a record, and a link pointed
 * there has to become an external one.
 */
export const internalPathOf = (value: string): string | null => {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('/')) {
    return normalizePath(trimmed)
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    )
    const market = resolveMarket(url)

    return market ? contentPathFor(url, market) : null
  } catch {
    return null
  }
}

/**
 * Link handling for one search, or null when the search is not for a URL and
 * references cannot meaningfully match.
 */
export const buildLinkOptions = ({
  find,
  replace,
  resolver,
  convention
}: {
  find: string
  replace: string
  resolver: LinkResolver
  convention: LinkConvention
}): LinkOptions | null => {
  const findPath = internalPathOf(find)

  if (!findPath) {
    return null
  }

  return {
    findPath,
    replacePath: internalPathOf(replace),
    replaceUrl: replace.trim(),
    resolver,
    convention
  }
}
