import { internalPathOf } from './linkTargets'
import type { SearchVariant } from './replaceEngine'

/**
 * The spellings a URL search should look for.
 *
 * Links are stored in more than one shape. A link to the pricing page may be
 * written `/pricing` or `https://factorialhr.com/pricing`, and which one is
 * used is an authoring detail nobody remembers — so searching for the URL a
 * page actually shows has to find both.
 *
 * Each spelling carries the replacement in the *same* shape, which matters
 * more than it looks: rewriting a stored `/pricing` into an absolute URL would
 * pin a link that currently follows whichever market serves it to one domain,
 * quietly sending Kenyan and Mexican readers to factorialhr.com.
 *
 * Returns null when the search is not for a URL, and the literal text is the
 * only sensible thing to look for.
 */
export const urlSearchVariants = (
  find: string,
  replace: string
): SearchVariant[] | null => {
  const findPath = internalPathOf(find)

  if (!findPath || findPath === '/') {
    return null
  }

  const trimmedFind = find.trim()
  const trimmedReplace = replace.trim()

  // Only a market URL has a path form worth substituting; anything else (a
  // trust centre, say) can only be written out in full.
  const replacePath = internalPathOf(trimmedReplace)

  const variants: SearchVariant[] = []

  // The absolute spelling first, so it wins over the path it contains. It ends
  // at a path segment just as the bare form does, so it needs the same
  // boundary: without it, searching for .../pricing matches inside
  // .../pricing-plans — including a URL a previous run had already replaced,
  // which a second run would extend to /pricing-plans-plans.
  if (trimmedFind !== findPath) {
    variants.push({
      find: trimmedFind,
      replace: trimmedReplace,
      pathBoundary: true
    })
  }

  variants.push({
    find: findPath,
    replace: replacePath ?? trimmedReplace,
    pathBoundary: true
  })

  return variants
}
