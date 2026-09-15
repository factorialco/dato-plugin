import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARAMETERS,
  normalizeParameters,
  readParameters
} from './pluginParameters'

describe(normalizeParameters, () => {
  it('falls back to the previously hardcoded values when unconfigured', () => {
    expect(normalizeParameters({})).toStrictEqual(DEFAULT_PARAMETERS)
    expect(normalizeParameters(null)).toStrictEqual(DEFAULT_PARAMETERS)
    expect(normalizeParameters(undefined)).toStrictEqual(DEFAULT_PARAMETERS)
  })

  it('keeps saved values and fills the gaps of a partial shape', () => {
    expect(
      normalizeParameters({ formTemplateModelId: 'custom-model' })
    ).toStrictEqual({
      ...DEFAULT_PARAMETERS,
      formTemplateModelId: 'custom-model'
    })
  })

  it('ignores values of the wrong type or that are blank', () => {
    expect(
      normalizeParameters({
        demoLandingPageModelId: 42,
        formFieldsBlockApiKey: '   '
      })
    ).toStrictEqual(DEFAULT_PARAMETERS)
  })

  it('trims whitespace and strips trailing slashes from the preview URL', () => {
    expect(
      normalizeParameters({ previewBaseUrl: '  https://example.com//  ' })
        .previewBaseUrl
    ).toBe('https://example.com')
  })

  it('defaults the preview URL to empty, which hides the preview', () => {
    expect(normalizeParameters({}).previewBaseUrl).toBe('')
  })
})

describe(readParameters, () => {
  it('reads the parameters off a hook ctx', () => {
    const ctx = {
      plugin: {
        attributes: { parameters: { previewBaseUrl: 'https://a.dev' } }
      }
    }

    expect(readParameters(ctx).previewBaseUrl).toBe('https://a.dev')
  })
})

describe('enforceDemoLandingPageLimit', () => {
  it('defaults to warn-only', () => {
    expect(normalizeParameters({}).enforceDemoLandingPageLimit).toBeFalsy()
  })

  it('is honoured when explicitly enabled', () => {
    expect(
      normalizeParameters({ enforceDemoLandingPageLimit: true })
        .enforceDemoLandingPageLimit
    ).toBeTruthy()
  })

  it('ignores non-boolean values', () => {
    expect(
      normalizeParameters({ enforceDemoLandingPageLimit: 'true' })
        .enforceDemoLandingPageLimit
    ).toBeFalsy()
  })
})

describe('previewModelApiKeys', () => {
  it('defaults to every model', () => {
    expect(normalizeParameters({}).previewModelApiKeys).toStrictEqual([])
  })

  it('parses the comma-separated string the config screen saves', () => {
    expect(
      normalizeParameters({ previewModelApiKeys: 'landing_page, blog_post ' })
        .previewModelApiKeys
    ).toStrictEqual(['landing_page', 'blog_post'])
  })

  // The config screen keeps this field as raw text and parses it once on save,
  // so whatever half-finished string the user was typing has to survive.
  it.each([
    ['landing_page,', ['landing_page']],
    ['landing_page, ', ['landing_page']],
    ['landing_page, blog_post', ['landing_page', 'blog_post']],
    ['  landing_page ,  blog_post  ', ['landing_page', 'blog_post']],
    ['landing_page,,blog_post', ['landing_page', 'blog_post']],
    [',', []],
    ['', []]
  ])('parses %o as typed into %o', (typed, expected) => {
    expect(
      normalizeParameters({ previewModelApiKeys: typed }).previewModelApiKeys
    ).toStrictEqual(expected)
  })

  it('accepts a real array and drops blank entries', () => {
    expect(
      normalizeParameters({ previewModelApiKeys: ['a', '', '  ', 'b'] })
        .previewModelApiKeys
    ).toStrictEqual(['a', 'b'])
  })
})
