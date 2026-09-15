/**
 * Global plugin parameters, edited from the plugin's config screen and
 * available in every hook as `ctx.plugin.attributes.parameters`.
 *
 * @see https://www.datocms.com/docs/plugin-sdk/config-screen
 */
export type PluginParameters = {
  /** Base URL of the front-end that renders the "Live preview" sidebar. */
  previewBaseUrl: string
  /** Models the preview sidebar is offered on. Empty means every model. */
  previewModelApiKeys: string[]
  /** Model ID whose published control/variant pages are capped at one each. */
  demoLandingPageModelId: string
  /** Model ID that gets the form fields validation addon. */
  formTemplateModelId: string
  /** API key of the field on that model to attach the addon to. */
  formFieldsBlockApiKey: string
  /**
   * When true, exceeding the demo landing page limit blocks publishing.
   * When false (the default) the editor is only warned.
   */
  enforceDemoLandingPageLimit: boolean
  /**
   * Role IDs allowed to use Search & Replace. Empty means every role, so the
   * tool does not disappear from a project that never configured it.
   */
  searchReplaceAllowedRoleIds: string[]
}

/**
 * Values the plugin used before these settings were configurable. They keep
 * existing installations working until someone saves the config screen.
 */
export const DEFAULT_PARAMETERS: PluginParameters = {
  previewBaseUrl: '',
  previewModelApiKeys: [],
  demoLandingPageModelId: 'evL8wHUkSgqfKeJxwaYKxA',
  formTemplateModelId: 'BZRowM-YRc66pOcGqLT9ng',
  formFieldsBlockApiKey: 'form_fields',
  // Warn-only by default: this check could never run before the plugin
  // declared the currentUserAccessToken permission, so blocking must be
  // turned on deliberately once the warnings look right.
  enforceDemoLandingPageLimit: false,
  searchReplaceAllowedRoleIds: []
}

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback

/** Accepts either a real array or the comma-separated string the form saves. */
const asStringList = (value: unknown): string[] => {
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  return parts
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

/**
 * Reads plugin parameters into a well-typed object, tolerating the empty,
 * partial and legacy shapes DatoCMS may hand back.
 */
export const normalizeParameters = (
  raw: Record<string, unknown> | null | undefined
): PluginParameters => ({
  previewBaseUrl: asString(
    raw?.previewBaseUrl,
    DEFAULT_PARAMETERS.previewBaseUrl
  ).replace(/\/+$/, ''),
  previewModelApiKeys: asStringList(raw?.previewModelApiKeys),
  demoLandingPageModelId: asString(
    raw?.demoLandingPageModelId,
    DEFAULT_PARAMETERS.demoLandingPageModelId
  ),
  formTemplateModelId: asString(
    raw?.formTemplateModelId,
    DEFAULT_PARAMETERS.formTemplateModelId
  ),
  formFieldsBlockApiKey: asString(
    raw?.formFieldsBlockApiKey,
    DEFAULT_PARAMETERS.formFieldsBlockApiKey
  ),
  enforceDemoLandingPageLimit:
    typeof raw?.enforceDemoLandingPageLimit === 'boolean'
      ? raw.enforceDemoLandingPageLimit
      : DEFAULT_PARAMETERS.enforceDemoLandingPageLimit,
  searchReplaceAllowedRoleIds: asStringList(raw?.searchReplaceAllowedRoleIds)
})

/** Reads the normalized parameters off any hook's `ctx`. */
export const readParameters = (ctx: {
  plugin: { attributes: { parameters: Record<string, unknown> } }
}): PluginParameters => normalizeParameters(ctx.plugin.attributes.parameters)
