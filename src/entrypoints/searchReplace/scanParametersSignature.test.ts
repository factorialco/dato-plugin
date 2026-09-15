import { describe, expect, it } from 'vitest'
import type { MatchOptions } from './replaceEngine'
import { scanParametersSignature } from './useSearchReplace'
import { parseTargets } from './urlTargets'

const LOCALES = ['en', 'es', 'en-ke', 'es-MX']
const OPTIONS: MatchOptions = {
  find: 'https://factorial.ke/privacy',
  replace: 'https://trust.factorial.co/',
  caseSensitive: false,
  wholeWord: false
}

const sign = (
  modelId: string | null,
  options: MatchOptions,
  urls: string
): string =>
  scanParametersSignature(modelId, options, parseTargets(urls, LOCALES, {}))

const BASE = sign('page', OPTIONS, 'https://factorial.ke/partnerships')

describe(scanParametersSignature, () => {
  it('is stable for the same parameters', () => {
    expect(sign('page', OPTIONS, 'https://factorial.ke/partnerships')).toBe(
      BASE
    )
  })

  it.each([
    ['find', { ...OPTIONS, find: 'something else' }],
    ['replace', { ...OPTIONS, replace: 'something else' }],
    ['caseSensitive', { ...OPTIONS, caseSensitive: true }],
    ['wholeWord', { ...OPTIONS, wholeWord: true }]
  ])('changes when %s changes', (_label, options) => {
    expect(sign('page', options, 'https://factorial.ke/partnerships')).not.toBe(
      BASE
    )
  })

  it('changes when the model changes', () => {
    expect(
      sign('other', OPTIONS, 'https://factorial.ke/partnerships')
    ).not.toBe(BASE)
  })

  it('changes when the pages change', () => {
    expect(sign('page', OPTIONS, 'https://factorial.ke/payroll')).not.toBe(BASE)
  })

  // Blank lines and ordering noise must not invalidate a scan the operator
  // has already reviewed.
  it('ignores surrounding whitespace in the URL list', () => {
    expect(
      sign('page', OPTIONS, '  https://factorial.ke/partnerships  \n\n')
    ).toBe(BASE)
  })
})
