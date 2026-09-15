import type { SchemaTypes } from '@datocms/cma-client-browser'
import { readParameters } from './pluginParameters'

/** The subset of `ctx` an access check needs, so it works in any entry point. */
export type AccessCtx = {
  plugin: SchemaTypes.Plugin
  currentRole: SchemaTypes.Role
  currentUser:
    | SchemaTypes.User
    | SchemaTypes.SsoUser
    | SchemaTypes.Account
    | SchemaTypes.Organization
}

/**
 * The project owner has no project role to put on an allow-list — an account or
 * organization login is not a collaborator — so it is recognised separately.
 */
const isProjectOwner = (currentUser: AccessCtx['currentUser']): boolean =>
  currentUser.type === 'account' || currentUser.type === 'organization'

/**
 * Whether the user may configure this plugin.
 *
 * `can_edit_schema` is DatoCMS's own permission for creating and editing
 * plugins, so it is the same boundary that decides who can reach the plugin's
 * settings screen in the first place — rather than a second, plugin-invented
 * notion of "admin" that could disagree with it.
 */
export const canConfigurePlugin = (ctx: AccessCtx): boolean =>
  isProjectOwner(ctx.currentUser) ||
  Boolean(ctx.currentRole.meta?.final_permissions?.can_edit_schema)

/**
 * Whether the current user may use Search & Replace.
 *
 * An empty allow-list means "everyone", so installing the plugin does not
 * silently hide the tool from a project that never configured it. Anyone who
 * can configure the plugin keeps access regardless of the list, so nobody can
 * lock the administrators out of a tool they are responsible for.
 *
 * This gates the plugin's UI, not the API: a user who can already edit records
 * can still change them by other means. Use DatoCMS role permissions for
 * enforcement — this setting is for keeping a sharp bulk-editing tool out of
 * the hands of people who have no reason to reach for it.
 */
export const canAccessSearchReplace = (ctx: AccessCtx): boolean => {
  const { searchReplaceAllowedRoleIds } = readParameters(ctx)

  if (searchReplaceAllowedRoleIds.length === 0) {
    return true
  }

  if (canConfigurePlugin(ctx)) {
    return true
  }

  return searchReplaceAllowedRoleIds.includes(ctx.currentRole.id)
}
