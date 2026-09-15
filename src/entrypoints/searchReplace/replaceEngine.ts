/**
 * Schema-agnostic search & replace over a DatoCMS record.
 *
 * One traversal serves both phases. The dry run walks with every occurrence
 * disabled and keeps the match list; applying walks the *same* record again
 * with a set of enabled occurrence keys and keeps the rewritten value. Because
 * both phases run identical code over identical input, what the dry run shows
 * is exactly what gets written — the record's `meta.current_version` is what
 * guards against the input having changed in between.
 *
 * Occurrence keys are built from block ids rather than array positions, so a
 * key stays valid even if unrelated blocks are reordered between the two walks.
 */

/** Field types whose values carry editable prose, URLs or slugs. */
const TEXTUAL_FIELD_TYPES = ['string', 'text', 'slug'] as const

export type FieldDef = {
  apiKey: string
  label: string
  fieldType: string
  localized: boolean
  /** For `link` / `links` fields, the models the reference may point at. */
  linkedItemTypeIds?: string[]
}

/** Field definitions keyed by item type id, for models *and* block models. */
export type FieldsByItemType = Record<string, FieldDef[]>

/** Human-readable names keyed by item type id, used in match paths. */
export type NamesByItemType = Record<string, string>

/**
 * One spelling of the thing being searched for, with the replacement in the
 * same spelling.
 *
 * A URL is stored in more than one shape: a link to the pricing page may be
 * written `/pricing` or `https://factorialhr.com/pricing`. Searching for one
 * spelling has to find the other, and — crucially — has to put back the shape
 * it found. Rewriting a stored `/pricing` into an absolute URL would pin a
 * link that currently follows whichever market serves it to a single domain.
 */
export type SearchVariant = {
  find: string
  replace: string
  /**
   * True for a bare-path spelling: the match must sit at a path boundary, so
   * `/pricing` does not match inside `/pricing-calculator`.
   */
  pathBoundary: boolean
}

export type MatchOptions = {
  find: string
  replace: string
  caseSensitive: boolean
  wholeWord: boolean
  /**
   * Spellings to look for. Defaults to the literal `find`/`replace` pair when
   * the search is not for a URL.
   */
  variants?: SearchVariant[]
}

/** Resolves record references to the URL path the site renders them as. */
export type LinkResolver = {
  pathOf: (recordId: string, locale: string) => string | null
  recordAt: (path: string, locale: string) => string | null
}

/** Field names a link block uses to say "internal or external, and where". */
export type LinkConvention = {
  linkTypeApiKey: string
  externalTypeValue: string
  externalUrlApiKey: string
}

/**
 * How to treat links that point at records rather than spelling out a URL.
 *
 * Repointing to another record is preferred: it keeps the link internal, so it
 * keeps following that page if its slug later changes. Only when the
 * replacement matches no record does the link become an external URL, which is
 * the one shape that can express an address outside the project.
 */
export type LinkOptions = {
  /** Path being searched for, e.g. `/pricing`. */
  findPath: string
  /** Path of the replacement, when it is one this project can resolve. */
  replacePath: string | null
  /** The replacement as an absolute URL, for the external fallback. */
  replaceUrl: string
  resolver: LinkResolver
  convention: LinkConvention
}

/** A single occurrence, rendered as prefix + strike(matched) + ins(replacement) + suffix. */
export type Match = {
  /** Stable across dry run and apply. */
  key: string
  recordId: string
  /** Breadcrumb of the value's position, e.g. `Sections › Hero › Body`. */
  path: string
  locale: string | null
  prefix: string
  matched: string
  replacement: string
  suffix: string
  /**
   * False for a match that can be reported but not rewritten — a reference the
   * replacement cannot be expressed as. The dry run shows it and the apply
   * skips it, rather than the occurrence being invisible.
   */
  applicable: boolean
  /** Why, when `applicable` is false. */
  note?: string
}

/**
 * A block the walk could not look inside.
 *
 * Reported rather than skipped in silence: a block that is not searched looks
 * exactly like a block with nothing in it, and the difference is the whole
 * answer when someone can see the text on the page but the scan cannot.
 */
export type UnsearchedBlock = {
  /** Breadcrumb of where it sits. */
  path: string
  reason: 'not-loaded' | 'unknown-type' | 'unrecognised-shape'
}

/** What the walk actually looked at, so "no matches" can be trusted. */
export type ScanReport = {
  /** Blocks opened and walked. */
  blocks: number
  /** Field values examined, at every depth. */
  values: number
  /**
   * Field types that held something but were passed over, and any value in a
   * block-bearing field that did not look like a block.
   *
   * The third way a scan can come up empty without being wrong: not an
   * unloaded block, not an unknown block type, but a value this walk simply
   * does not know how to open. Naming the type is what turns that into a fix.
   */
  skippedFieldTypes: string[]
}

export type TransformResult = {
  matches: Match[]
  /** Blocks that could not be searched, if any. */
  unsearched: UnsearchedBlock[]
  /** Coverage of the walk. */
  report: ScanReport
  /** Only the top-level fields whose value changed. Empty when nothing changed. */
  changedFields: Record<string, unknown>
}

type PathSegment = { key: string; label: string }

type WalkContext = {
  recordId: string
  options: MatchOptions
  /** Locale to restrict localized fields to, or null for every locale. */
  filterLocale: string | null
  /** Locale the value currently being walked belongs to, for display only. */
  locale: string | null
  fieldsByItemType: FieldsByItemType
  namesByItemType: NamesByItemType
  /** Occurrence keys to actually rewrite. `null` means "record only, rewrite nothing". */
  enabledKeys: Set<string> | null
  unsearched: UnsearchedBlock[]
  report: ScanReport
  /** Null when the search is not for a URL, so references cannot match. */
  link: LinkOptions | null
  matches: Match[]
}

type Walked = { value: unknown; changed: boolean }

const SNIPPET_RADIUS = 70

const isWordChar = (char: string | undefined): boolean =>
  char !== undefined && /[\p{L}\p{N}_]/u.test(char)

/** Byte ranges of `find` inside `text`, left to right, non-overlapping. */
/** A path segment continues through these, so `/pricing` !== `/pricing-plans`. */
const isPathChar = (char: string | undefined): boolean =>
  char !== undefined && /[\p{L}\p{N}_-]/u.test(char)

export const variantsOf = (options: MatchOptions): SearchVariant[] =>
  options.variants ?? [
    { find: options.find, replace: options.replace, pathBoundary: false }
  ]

export type Occurrence = { start: number; end: number; replace: string }

const findVariant = (
  text: string,
  variant: SearchVariant,
  { caseSensitive, wholeWord }: MatchOptions
): Occurrence[] => {
  if (!variant.find) {
    return []
  }

  const haystack = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? variant.find : variant.find.toLowerCase()
  const ranges: Occurrence[] = []

  let from = 0

  for (;;) {
    const start = haystack.indexOf(needle, from)

    if (start === -1) {
      break
    }

    const end = start + needle.length
    const boundedLeft = !isWordChar(text[start - 1])
    const boundedRight = !isWordChar(text[end])
    const wordOk = !wholeWord || (boundedLeft && boundedRight)
    // A bare path may follow a host ("...com/pricing") but must not run into
    // a longer segment ("/pricing-calculator").
    const pathOk = !variant.pathBoundary || !isPathChar(text[end])

    if (wordOk && pathOk) {
      ranges.push({ start, end, replace: variant.replace })
    }

    from = end > start ? end : start + 1
  }

  return ranges
}

/**
 * Every occurrence of any spelling, left to right and non-overlapping.
 *
 * Longer spellings win where two overlap, so the absolute-URL form is used in
 * preference to the bare path it contains.
 */
export const findOccurrences = (
  text: string,
  options: MatchOptions
): Occurrence[] => {
  const found = variantsOf(options).flatMap((variant) =>
    findVariant(text, variant, options)
  )

  // Sorting a freshly built array, so nothing shared is mutated. `toSorted`
  // would read better but is ES2023, past this project's target.
  // oxlint-disable-next-line unicorn/no-array-sort
  found.sort((a, b) => a.start - b.start || b.end - a.end)

  const ranges: Occurrence[] = []

  for (const range of found) {
    const previous = ranges.at(-1)

    if (!previous || range.start >= previous.end) {
      ranges.push(range)
    }
  }

  return ranges
}

const buildSnippet = (
  text: string,
  start: number,
  end: number,
  replacement: string
): Pick<Match, 'prefix' | 'matched' | 'replacement' | 'suffix'> => {
  const from = Math.max(0, start - SNIPPET_RADIUS)
  const to = Math.min(text.length, end + SNIPPET_RADIUS)

  return {
    prefix: (from > 0 ? '…' : '') + text.slice(from, start),
    matched: text.slice(start, end),
    replacement,
    suffix: text.slice(end, to) + (to < text.length ? '…' : '')
  }
}

const pathKeyOf = (path: PathSegment[]): string =>
  path.map((segment) => segment.key).join('/')

const pathLabelOf = (path: PathSegment[]): string =>
  path
    .map((segment) => segment.label)
    .filter((label) => label.length > 0)
    .join(' › ')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Rewrites a reference field that points at the page being searched for.
 *
 * Takes the containing item type's other fields because the fallback writes to
 * *siblings*: turning an internal link into an external one sets the type and
 * URL next to the reference it clears. Repointing to another record is
 * preferred — it stays internal, so it keeps following that page if its slug
 * changes later.
 *
 * Only resolves against a known locale: without one there is no single path a
 * reference renders as.
 */
const walkLinkField = (
  attributes: Record<string, unknown>,
  field: FieldDef,
  siblings: FieldDef[],
  path: PathSegment[],
  context: WalkContext
): boolean => {
  const link = context.link
  const locale = context.filterLocale

  if (!link || !locale) {
    return false
  }

  const stored = attributes[field.apiKey]
  const current = field.localized
    ? isRecord(stored)
      ? stored[locale]
      : undefined
    : stored

  if (typeof current !== 'string') {
    return false
  }

  if (link.resolver.pathOf(current, locale) !== link.findPath) {
    return false
  }

  const target = link.replacePath
    ? link.resolver.recordAt(link.replacePath, locale)
    : null

  const linkTypeField = siblings.find(
    (sibling) => sibling.apiKey === link.convention.linkTypeApiKey
  )
  const externalUrlField = siblings.find(
    (sibling) => sibling.apiKey === link.convention.externalUrlApiKey
  )
  const canGoExternal = Boolean(linkTypeField && externalUrlField)
  const applicable = Boolean(target) || canGoExternal

  const fieldPath = [...path, { key: field.apiKey, label: field.label }]
  const key = `${context.recordId}|${pathKeyOf(fieldPath)}|link`

  context.matches.push({
    key,
    recordId: context.recordId,
    path: pathLabelOf(fieldPath),
    locale,
    prefix: '',
    matched: `${link.findPath} (linked page)`,
    replacement: target
      ? `${link.replacePath} (linked page)`
      : `${link.replaceUrl} (external link)`,
    suffix: '',
    applicable,
    note: applicable
      ? undefined
      : `Nothing to point at: no page at ${link.replaceUrl} in ${locale}, and this block has no ${link.convention.externalUrlApiKey} field to hold an external URL.`
  })

  if (!applicable || !(context.enabledKeys?.has(key) ?? false)) {
    return false
  }

  /** Writes a sibling, respecting whether it is localized. */
  const writeSibling = (sibling: FieldDef, value: string): void => {
    if (!sibling.localized) {
      attributes[sibling.apiKey] = value

      return
    }

    const existing = attributes[sibling.apiKey]

    attributes[sibling.apiKey] = {
      ...(isRecord(existing) ? existing : {}),
      [locale]: value
    }
  }

  const writeReference = (value: string | null): void => {
    if (!field.localized) {
      attributes[field.apiKey] = value

      return
    }

    attributes[field.apiKey] = {
      ...(isRecord(stored) ? stored : {}),
      [locale]: value
    }
  }

  if (target) {
    writeReference(target)

    return true
  }

  writeReference(null)

  if (linkTypeField) {
    writeSibling(linkTypeField, link.convention.externalTypeValue)
  }

  if (externalUrlField) {
    writeSibling(externalUrlField, link.replaceUrl)
  }

  return true
}

const walkString = (
  text: string,
  path: PathSegment[],
  context: WalkContext
): Walked => {
  context.report.values += 1

  const occurrences = findOccurrences(text, context.options)

  if (occurrences.length === 0) {
    return { value: text, changed: false }
  }

  const pathKey = pathKeyOf(path)
  const pathLabel = pathLabelOf(path)

  let rewritten = ''
  let cursor = 0
  let changed = false

  occurrences.forEach(({ start, end, replace }, index) => {
    const key = `${context.recordId}|${pathKey}|${index}`

    context.matches.push({
      key,
      recordId: context.recordId,
      path: pathLabel,
      locale: context.locale,
      ...buildSnippet(text, start, end, replace),
      applicable: true
    })

    const enabled = context.enabledKeys?.has(key) ?? false

    rewritten += text.slice(cursor, start)
    rewritten += enabled ? replace : text.slice(start, end)
    cursor = end
    changed ||= enabled
  })

  return { value: rewritten + text.slice(cursor), changed }
}

type NestedBlock = {
  id?: string
  attributes?: Record<string, unknown>
  relationships?: { item_type?: { data?: { id?: string } } }
  __itemTypeId?: string
}

const asNestedBlock = (value: unknown): NestedBlock | null => {
  if (!isRecord(value)) {
    return null
  }

  const block = value as NestedBlock
  const itemTypeId =
    block.__itemTypeId ?? block.relationships?.item_type?.data?.id

  return itemTypeId && isRecord(block.attributes) ? block : null
}

const itemTypeIdOf = (block: NestedBlock): string =>
  (block.__itemTypeId ?? block.relationships?.item_type?.data?.id) as string

/**
 * Walks a nested block. An unchanged block collapses to its id string, which
 * the CMA reads as "keep this block as it is" — it keeps update payloads small
 * on records with dozens of sections.
 */
const walkBlock = (
  value: unknown,
  path: PathSegment[],
  context: WalkContext
): Walked => {
  const block = asNestedBlock(value)

  if (!block) {
    // A block field that came back as an id rather than a payload: the record
    // was read without `nested`, or the API stopped hydrating at this depth.
    // Either way its contents were never seen, so say so.
    if (typeof value === 'string') {
      context.unsearched.push({
        path: pathLabelOf(path),
        reason: 'not-loaded'
      })
    } else if (value !== null && value !== undefined) {
      // An object in a block field that is not shaped like one: the payload
      // came back in a form this walk does not know how to open.
      context.unsearched.push({
        path: pathLabelOf(path),
        reason: 'unrecognised-shape'
      })
    }

    return { value, changed: false }
  }

  const itemTypeId = itemTypeIdOf(block)
  const fields = context.fieldsByItemType[itemTypeId] ?? []
  const blockName = context.namesByItemType[itemTypeId] ?? 'Block'

  if (fields.length === 0) {
    context.unsearched.push({
      path: pathLabelOf([...path, { key: itemTypeId, label: blockName }]),
      reason: 'unknown-type'
    })
  }
  const blockPath = [...path, { key: block.id ?? itemTypeId, label: blockName }]

  context.report.blocks += 1

  const attributes = { ...(block.attributes as Record<string, unknown>) }
  let changed = false

  for (const field of fields) {
    if (field.fieldType === 'link') {
      if (walkLinkField(attributes, field, fields, blockPath, context)) {
        changed = true
      }

      continue
    }

    // `walkField` and `walkBlock` are mutually recursive — a block's fields may
    // themselves hold blocks — so one call has to precede the definition. The
    // hoisted declaration below makes that safe at runtime.
    // oxlint-disable-next-line eslint/no-use-before-define
    const walked = walkField(
      attributes[field.apiKey],
      field,
      blockPath,
      context
    )

    if (walked.changed) {
      attributes[field.apiKey] = walked.value
      changed = true
    }
  }

  if (!changed) {
    return { value: block.id ?? value, changed: false }
  }

  return { value: { ...block, attributes }, changed: true }
}

type DastNode = {
  type: string
  value?: unknown
  url?: unknown
  item?: unknown
  children?: unknown
}

const walkDastNode = (
  node: unknown,
  path: PathSegment[],
  context: WalkContext
): Walked => {
  if (!isRecord(node)) {
    return { value: node, changed: false }
  }

  const dast = node as DastNode
  const next: Record<string, unknown> = { ...dast }
  let changed = false

  if (dast.type === 'span' && typeof dast.value === 'string') {
    const walked = walkString(dast.value, path, context)

    if (walked.changed) {
      next.value = walked.value
      changed = true
    }
  }

  if (dast.type === 'link' && typeof dast.url === 'string') {
    const walked = walkString(
      dast.url,
      [...path, { key: 'url', label: 'link URL' }],
      context
    )

    if (walked.changed) {
      next.url = walked.value
      changed = true
    }
  }

  if ((dast.type === 'block' || dast.type === 'inlineBlock') && dast.item) {
    const walked = walkBlock(dast.item, path, context)

    if (walked.changed) {
      next.item = walked.value
      changed = true
    }
  }

  if (Array.isArray(dast.children)) {
    const children = dast.children.map((child, index) =>
      walkDastNode(child, [...path, { key: String(index), label: '' }], context)
    )

    if (children.some((child) => child.changed)) {
      next.children = children.map((child) => child.value)
      changed = true
    }
  }

  return { value: changed ? next : node, changed }
}

const walkStructuredText = (
  value: unknown,
  path: PathSegment[],
  context: WalkContext
): Walked => {
  if (!isRecord(value) || !isRecord(value.document)) {
    return { value, changed: false }
  }

  const walked = walkDastNode(value.document, path, context)

  return walked.changed
    ? { value: { ...value, document: walked.value }, changed: true }
    : { value, changed: false }
}

/** SEO fields are objects; only the two prose keys are editable text. */
const walkSeo = (
  value: unknown,
  path: PathSegment[],
  context: WalkContext
): Walked => {
  if (!isRecord(value)) {
    return { value, changed: false }
  }

  const next = { ...value }
  let changed = false

  for (const key of ['title', 'description']) {
    if (typeof value[key] !== 'string') {
      continue
    }

    const walked = walkString(
      value[key] as string,
      [...path, { key, label: key }],
      context
    )

    if (walked.changed) {
      next[key] = walked.value
      changed = true
    }
  }

  return changed ? { value: next, changed: true } : { value, changed: false }
}

/** Remembers a field type that was passed over, once each. */
const noteSkipped = (context: WalkContext, fieldType: string): void => {
  if (!context.report.skippedFieldTypes.includes(fieldType)) {
    context.report.skippedFieldTypes.push(fieldType)
  }
}

const walkByFieldType = (
  value: unknown,
  fieldType: string,
  path: PathSegment[],
  context: WalkContext
): Walked => {
  if (value === null || value === undefined) {
    return { value, changed: false }
  }

  if ((TEXTUAL_FIELD_TYPES as readonly string[]).includes(fieldType)) {
    return typeof value === 'string'
      ? walkString(value, path, context)
      : { value, changed: false }
  }

  if (fieldType === 'structured_text') {
    return walkStructuredText(value, path, context)
  }

  if (fieldType === 'seo') {
    return walkSeo(value, path, context)
  }

  if (fieldType === 'single_block') {
    return walkBlock(value, path, context)
  }

  if (fieldType === 'rich_text') {
    if (!Array.isArray(value)) {
      return { value, changed: false }
    }

    const blocks = value.map((block) => walkBlock(block, path, context))

    return blocks.some((block) => block.changed)
      ? { value: blocks.map((block) => block.value), changed: true }
      : { value, changed: false }
  }

  // Everything else — assets, references, numbers, dates, colours, raw JSON —
  // either holds no prose or holds it in a shape we cannot rewrite safely.
  noteSkipped(context, fieldType)

  return { value, changed: false }
}

function walkField(
  value: unknown,
  field: FieldDef,
  path: PathSegment[],
  context: WalkContext
): Walked {
  const fieldPath = [...path, { key: field.apiKey, label: field.label }]

  if (!field.localized) {
    return walkByFieldType(value, field.fieldType, fieldPath, context)
  }

  if (!isRecord(value)) {
    return { value, changed: false }
  }

  const locales = context.filterLocale
    ? [context.filterLocale].filter((locale) => locale in value)
    : Object.keys(value)

  const next = { ...value }
  let changed = false

  for (const locale of locales) {
    const walked = walkByFieldType(
      value[locale],
      field.fieldType,
      [...fieldPath, { key: locale, label: locale }],
      { ...context, locale }
    )

    if (walked.changed) {
      next[locale] = walked.value
      changed = true
    }
  }

  return changed ? { value: next, changed: true } : { value, changed: false }
}

export type TransformInput = {
  /** A record fetched with `nested: true`, fields flattened onto the object. */
  record: Record<string, unknown> & { id: string }
  itemTypeId: string
  fieldsByItemType: FieldsByItemType
  namesByItemType: NamesByItemType
  options: MatchOptions
  /** Restrict localized fields to this locale. Null searches every locale. */
  locale: string | null
  /**
   * Occurrence keys to rewrite. Omit (or pass null) to collect matches without
   * producing an update payload — the dry run.
   */
  enabledKeys?: Set<string> | null
  /**
   * How to treat links stored as record references. Omit when the search is
   * not for a URL, and references are left alone.
   */
  link?: LinkOptions | null
}

/**
 * Collects every occurrence in a record and, when `enabledKeys` is given, the
 * update payload that rewrites exactly those occurrences.
 */
export const transformRecord = ({
  record,
  itemTypeId,
  fieldsByItemType,
  namesByItemType,
  options,
  locale,
  enabledKeys = null,
  link = null
}: TransformInput): TransformResult => {
  const context: WalkContext = {
    recordId: record.id,
    options,
    filterLocale: locale,
    locale: null,
    fieldsByItemType,
    namesByItemType,
    enabledKeys,
    link,
    matches: [],
    unsearched: [],
    report: { blocks: 0, values: 0, skippedFieldTypes: [] }
  }

  const changedFields: Record<string, unknown> = {}
  const fields = fieldsByItemType[itemTypeId] ?? []

  // Reference fields are rewritten against a copy of the record's own
  // attributes, since the external fallback writes to sibling fields too.
  const rootAttributes: Record<string, unknown> = { ...record }

  for (const field of fields) {
    if (field.fieldType === 'link') {
      if (walkLinkField(rootAttributes, field, fields, [], context)) {
        for (const apiKey of [
          field.apiKey,
          link?.convention.linkTypeApiKey,
          link?.convention.externalUrlApiKey
        ]) {
          if (apiKey && apiKey in rootAttributes) {
            changedFields[apiKey] = rootAttributes[apiKey]
          }
        }
      }

      continue
    }

    const walked = walkField(record[field.apiKey], field, [], context)

    if (walked.changed) {
      changedFields[field.apiKey] = walked.value
    }
  }

  return {
    matches: context.matches,
    unsearched: context.unsearched,
    report: context.report,
    changedFields
  }
}
