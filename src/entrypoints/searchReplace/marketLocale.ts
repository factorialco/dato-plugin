/**
 * URL -> market -> DatoCMS locale resolution.
 *
 * The market table mirrors `webpage/lib/market/locale-map.ts` in the
 * `factorialco/factorial` monorepo, and the resolution order below mirrors that
 * file's `getMarketFromHost`. Keep the two in sync when a market is added,
 * migrated to the consolidated domain, or given a custom public path.
 *
 * What is deliberately NOT mirrored is the market -> Dato locale mapping: it is
 * not derivable from the locale (Greece is `el-GR` in the frontend and `el` in
 * Dato), so it is read at runtime from the `market_configuration` records in
 * the project itself, with normalisation against the project's locale list as a
 * fallback. See `toDatoLocale`.
 */

export type Market = {
  tld: string
  /** Frontend locale, e.g. `en-KE`. Not the Dato locale. */
  locale: string
  isoCountryCode: string
  /** Domain name portion of the host, e.g. `factorial` in factorial.es. */
  domainName: string
  /** Served from a path prefix on a shared domain instead of its own TLD. */
  pathBased?: boolean
  /** Public URL prefix when the country code is not the right label. */
  path?: string
  /** Served from the consolidated domain under its `path` prefix. */
  migrated?: boolean
}

/** Multi-part TLDs must come before single-part ones (`com.br` before `com`). */
export const MARKETS: Market[] = [
  {
    tld: 'com.br',
    locale: 'pt-BR',
    isoCountryCode: 'br',
    domainName: 'factorialhr'
  },
  {
    tld: 'com.ar',
    locale: 'es-AR',
    isoCountryCode: 'ar',
    domainName: 'factorialhr',
    pathBased: true,
    migrated: true
  },
  {
    tld: 'co.uk',
    locale: 'en-GB',
    isoCountryCode: 'gb',
    domainName: 'factorialhr'
  },
  {
    tld: 'co.za',
    locale: 'en-ZA',
    isoCountryCode: 'za',
    domainName: 'factorialhr',
    pathBased: true,
    migrated: true
  },
  {
    tld: 'com',
    locale: 'en-US',
    isoCountryCode: 'us',
    domainName: 'factorialhr'
  },
  { tld: 'es', locale: 'es-ES', isoCountryCode: 'es', domainName: 'factorial' },
  { tld: 'mx', locale: 'es-MX', isoCountryCode: 'mx', domainName: 'factorial' },
  {
    tld: 'co',
    locale: 'es-CO',
    isoCountryCode: 'co',
    domainName: 'factorialhr'
  },
  { tld: 'fr', locale: 'fr-FR', isoCountryCode: 'fr', domainName: 'factorial' },
  {
    tld: 'de',
    locale: 'de-DE',
    isoCountryCode: 'de',
    domainName: 'factorialhr'
  },
  { tld: 'it', locale: 'it-IT', isoCountryCode: 'it', domainName: 'factorial' },
  {
    tld: 'pt',
    locale: 'pt-PT',
    isoCountryCode: 'pt',
    domainName: 'factorialhr'
  },
  {
    tld: 'cl',
    locale: 'es-CL',
    isoCountryCode: 'cl',
    domainName: 'factorialhr'
  },
  { tld: 'pl', locale: 'pl-PL', isoCountryCode: 'pl', domainName: 'factorial' },
  { tld: 'ke', locale: 'en-KE', isoCountryCode: 'ke', domainName: 'factorial' },
  {
    tld: 'gr',
    locale: 'el-GR',
    isoCountryCode: 'gr',
    domainName: 'factorialhr',
    pathBased: true,
    migrated: true
  },
  {
    tld: 'rs',
    locale: 'sr-RS',
    isoCountryCode: 'rs',
    domainName: 'factorialhr',
    pathBased: true,
    migrated: true
  },
  {
    tld: 'ae',
    locale: 'en-AE',
    isoCountryCode: 'ae',
    domainName: 'factorial',
    pathBased: true,
    migrated: true
  }
]

const GLOBAL_MARKET = 'us'
const CONSOLIDATED_DOMAIN = 'factorial.com'

/** Public prefix for a market. Defaults to the country code. */
export const marketPath = (market: Market): string =>
  market.path ?? market.isoCountryCode

/** `/el` and `/el/pricing` match, `/elsewhere` does not. */
const matchesPathPrefix = (pathname: string, prefix: string): boolean =>
  pathname === `/${prefix}` || pathname.startsWith(`/${prefix}/`)

const stripMarketPath = (pathname: string, prefix: string): string =>
  pathname === `/${prefix}` ? '/' : pathname.slice(`/${prefix}`.length)

/**
 * Both spellings are in use for the same market — factorial.co.uk and
 * factorialhr.co.uk both serve Great Britain — so the domain name in the table
 * is only one of them.
 */
const FACTORIAL_DOMAIN_NAMES = ['factorial', 'factorialhr']

/**
 * Whether `hostname` is a market's own site.
 *
 * The frontend gets away with `endsWith('.' + tld)` because it only ever sees
 * its own hosts. This tool is handed arbitrary pasted URLs, where that rule
 * claims anything sharing a TLD: `trust.factorial.co` would resolve as the
 * Colombian market, and a link to it would be rewritten as one of its pages.
 *
 * So the site's own subdomains are excluded — trust., status., app. — while
 * the bare host and its `www.` form still resolve.
 */
const isMarketHost = (hostname: string, market: Market): boolean => {
  if (!hostname.endsWith(`.${market.tld}`)) {
    return false
  }

  const labels = hostname.slice(0, -(market.tld.length + 1)).split('.')
  const domainName = labels.at(-1) ?? ''
  const subdomain = labels.slice(0, -1).join('.')

  return (
    FACTORIAL_DOMAIN_NAMES.includes(domainName) &&
    (subdomain === '' || subdomain === 'www')
  )
}

const hostnameOf = (host: string): string =>
  host.replace(/:\d+$/, '').toLowerCase()

export const isConsolidatedHost = (host: string): boolean => {
  const hostname = hostnameOf(host)

  return (
    hostname === CONSOLIDATED_DOMAIN ||
    hostname.endsWith(`.${CONSOLIDATED_DOMAIN}`)
  )
}

const findMigratedMarket = (pathname: string): Market | null => {
  const market = MARKETS.find(
    (entry) => entry.migrated && matchesPathPrefix(pathname, marketPath(entry))
  )

  return market ? { ...market, pathBased: true } : null
}

/**
 * Market that owns `url`, or null when no market claims it. Mirrors the
 * production resolution order: consolidated domain first (only migrated
 * markets answer there, and only under their prefix), then path-based markets
 * still on the legacy global domain, then plain TLD matching.
 */
export const resolveMarket = (url: URL): Market | null => {
  const hostname = hostnameOf(url.host)
  const pathname = url.pathname

  if (isConsolidatedHost(hostname)) {
    return findMigratedMarket(pathname)
  }

  const fromPublicPath = MARKETS.find(
    (market) =>
      market.pathBased &&
      !market.migrated &&
      matchesPathPrefix(pathname, marketPath(market))
  )

  const hostMarket = MARKETS.find((market) => isMarketHost(hostname, market))

  if (fromPublicPath && hostMarket?.isoCountryCode === GLOBAL_MARKET) {
    return { ...fromPublicPath, pathBased: true }
  }

  return hostMarket ?? null
}

/** `/a/b/` and `a/b` both become `/a/b`; the root stays `/`. */
export const normalizePath = (path: string): string => {
  const rooted = path.startsWith('/') ? path : `/${path}`
  const trimmed = rooted.replace(/\/+$/, '')

  return trimmed === '' ? '/' : trimmed
}

/**
 * The path within the market — the market prefix stripped off for path-based
 * markets, so `factorial.com/el/pricing` and `factorialhr.gr/pricing` both
 * resolve to `/pricing`. Always rooted, never trailing-slashed.
 */
export const contentPathFor = (url: URL, market: Market | null): string => {
  const prefix = market && market.pathBased ? marketPath(market) : null
  const pathname =
    prefix && matchesPathPrefix(url.pathname, prefix)
      ? stripMarketPath(url.pathname, prefix)
      : url.pathname

  return normalizePath(pathname)
}

/** Whether the URL points at the WordPress blog, which this tool never edits. */
export const isBlogPath = (path: string): boolean =>
  /(^|\/)blog(\/|$)/.test(normalizePath(path))

/**
 * The project locale to edit for a market.
 *
 * `datoLocaleByTld` comes from the project's own `market_configuration`
 * records and wins whenever it has an entry. Otherwise the frontend locale is
 * matched case-insensitively against the project's locales, trying the locale
 * as written (`en-KE` -> `en-ke`) and then the underscored form
 * (`en-KE` -> `en_KE`), before falling back to the bare language
 * (`el-GR` -> `el`).
 *
 * Both separators are tried because the convention is per project: this one
 * uses hyphens (`en-GB`, `es-MX`, `en-ke`), others use underscores. Matching
 * only the underscored form sent every regional market to its bare language —
 * a `.mx` URL edited `es` rather than `es-MX`.
 */
export type LocaleResolution = {
  locale: string
  /**
   * How the locale was found.
   *
   * `language` means the market's regional locale is not in this project and
   * the bare language was used. That is right for most markets — Spain is
   * `es`, Greece is `el` — but wrong for one that shares another region's
   * content, and nothing in the locale string distinguishes the two: only a
   * `market_configuration` record can. It is reported so that a market
   * resolved without one can be seen rather than assumed.
   */
  source: 'configured' | 'exact' | 'language'
}

export const resolveDatoLocale = (
  market: Market,
  siteLocales: string[],
  datoLocaleByTld: Record<string, string> = {}
): LocaleResolution | null => {
  const configured = datoLocaleByTld[market.tld]

  if (configured && siteLocales.includes(configured)) {
    return { locale: configured, source: 'configured' }
  }

  const matchInsensitive = (candidate: string) =>
    siteLocales.find(
      (locale) => locale.toLowerCase() === candidate.toLowerCase()
    ) ?? null

  const underscored = market.locale.replace('-', '_')
  const language = market.locale.split('-')[0]
  const exact = matchInsensitive(market.locale) ?? matchInsensitive(underscored)

  if (exact) {
    return { locale: exact, source: 'exact' }
  }

  const byLanguage = matchInsensitive(language)

  return byLanguage ? { locale: byLanguage, source: 'language' } : null
}

export const toDatoLocale = (
  market: Market,
  siteLocales: string[],
  datoLocaleByTld: Record<string, string> = {}
): string | null =>
  resolveDatoLocale(market, siteLocales, datoLocaleByTld)?.locale ?? null
