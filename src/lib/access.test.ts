import { describe, expect, it } from 'vitest'
import type { AccessCtx } from './access'
import { canAccessSearchReplace, canConfigurePlugin } from './access'

const buildCtx = (
  allowedRoleIds: unknown,
  roleId: string,
  userType = 'user',
  canEditSchema = false
): AccessCtx =>
  ({
    plugin: {
      attributes: {
        parameters: { searchReplaceAllowedRoleIds: allowedRoleIds }
      }
    },
    currentRole: {
      id: roleId,
      meta: { final_permissions: { can_edit_schema: canEditSchema } }
    },
    currentUser: { type: userType }
  }) as unknown as AccessCtx

describe(canAccessSearchReplace, () => {
  it('allows everyone when no roles are configured', () => {
    expect(canAccessSearchReplace(buildCtx([], 'editor'))).toBeTruthy()
    expect(canAccessSearchReplace(buildCtx(undefined, 'editor'))).toBeTruthy()
  })

  it('allows a role on the list and blocks one that is not', () => {
    expect(
      canAccessSearchReplace(buildCtx(['seo', 'admin'], 'seo'))
    ).toBeTruthy()
    expect(
      canAccessSearchReplace(buildCtx(['seo', 'admin'], 'editor'))
    ).toBeFalsy()
  })

  it.each(['account', 'organization'])(
    'never locks out the project owner (%s)',
    (userType) =>
      expect(
        canAccessSearchReplace(buildCtx(['seo'], 'whatever', userType))
      ).toBeTruthy()
  )

  it('blocks SSO users whose role is not on the list', () => {
    expect(
      canAccessSearchReplace(buildCtx(['seo'], 'editor', 'sso_user'))
    ).toBeFalsy()
  })

  it('never locks out a role that can edit models and plugins', () => {
    expect(
      canAccessSearchReplace(buildCtx(['seo'], 'admin', 'user', true))
    ).toBeTruthy()
  })

  it('treats a comma-separated string setting as a list, like the other settings', () => {
    expect(canAccessSearchReplace(buildCtx('seo', 'editor'))).toBeFalsy()
    expect(canAccessSearchReplace(buildCtx('seo', 'seo'))).toBeTruthy()
  })
})

describe(canConfigurePlugin, () => {
  it('allows roles that can edit models and plugins', () => {
    expect(canConfigurePlugin(buildCtx([], 'admin', 'user', true))).toBeTruthy()
  })

  it('blocks roles that cannot', () => {
    expect(
      canConfigurePlugin(buildCtx([], 'editor', 'user', false))
    ).toBeFalsy()
    expect(
      canConfigurePlugin(buildCtx([], 'editor', 'sso_user', false))
    ).toBeFalsy()
  })

  it.each(['account', 'organization'])(
    'allows the project owner (%s)',
    (userType) =>
      expect(
        canConfigurePlugin(buildCtx([], 'whatever', userType))
      ).toBeTruthy()
  )

  it('does not throw when the role carries no permissions', () => {
    const ctx = {
      plugin: { attributes: { parameters: {} } },
      currentRole: {},
      currentUser: { type: 'user' }
    }

    expect(canConfigurePlugin(ctx as unknown as AccessCtx)).toBeFalsy()
  })
})
