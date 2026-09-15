import type { Ctx } from 'datocms-plugin-sdk'
import { readParameters } from '../../lib/pluginParameters'
import type { MaintenanceWindow } from './maintenanceBanner.utils'
import {
  MAINTENANCE_MODAL_ID,
  buildBannerText,
  getMaintenanceWindow
} from './maintenanceBanner.utils'

// Testing-only escape hatch, used by the primary-environment gate below:
// run `window.localStorage.setItem("factorial-maintenance-force-preview", "true")`
// in the browser console of a sandbox environment to preview the notice
// without needing to be in the primary (main) environment. Not exposed in
// any UI.
const FORCE_PREVIEW_KEY = 'factorial-maintenance-force-preview'

// A single fixed key (not one key per window) so dismissals are shared
// across every open tab (localStorage, unlike sessionStorage, is shared
// across tabs of the same origin) and never accumulate: it just gets
// overwritten with the signature of whichever window was last dismissed.
const DISMISSED_KEY = 'factorial-maintenance-dismissed'

/**
 * Reads and writes to `localStorage` are wrapped because it is not always
 * reachable: the plugin runs in a cross-origin iframe, and a browser
 * partitioning or blocking third-party storage throws `SecurityError` on
 * access rather than returning null. Failing closed here would take the whole
 * notice down; failing open means it shows again next load, which is the right
 * way to err for something people are meant to read.
 */
const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // See readStorage: nothing to do but let the notice show again.
  }
}

/**
 * Guards against two near-simultaneous calls opening two modals — `onBoot` and
 * `mainNavigationTabs` can fire in quick succession.
 *
 * Deliberately in memory rather than in localStorage: this only needs to
 * outlive the open modal, whereas a persisted flag would also survive the user
 * closing the tab before reading anything, which is how the notice used to be
 * marked seen without ever having been seen.
 */
let noticeOpen = false

/**
 * The parts of `ctx` these helpers need, so they work from any hook — the bare
 * `Ctx` is the empty-extras variant and does not accept a render context.
 */
export type MaintenanceCtx = {
  plugin: { attributes: { parameters: Record<string, unknown> } }
  isEnvironmentPrimary: boolean
}

export type NoticeCtx = MaintenanceCtx & Pick<Ctx, 'openModal'>

/** Identifies a window, so editing either half re-notifies everyone. */
const signatureOf = (maintenanceWindow: MaintenanceWindow): string =>
  `${maintenanceWindow.message}:${maintenanceWindow.startsAt}`

/** The window to announce here, or null when there is nothing to show. */
export const activeMaintenanceWindow = (
  ctx: MaintenanceCtx
): MaintenanceWindow | null => {
  const forcePreview = readStorage(FORCE_PREVIEW_KEY) === 'true'

  if (!ctx.isEnvironmentPrimary && !forcePreview) {
    return null
  }

  return getMaintenanceWindow(readParameters(ctx))
}

export const isMaintenanceNoticeDismissed = (
  maintenanceWindow: MaintenanceWindow
): boolean => readStorage(DISMISSED_KEY) === signatureOf(maintenanceWindow)

/**
 * Opens the notice and waits for the reader to close it.
 *
 * A blocking, centered modal — more attention-grabbing than a corner toast,
 * and requires an explicit interaction before it closes. A modal rather than
 * `openConfirm` because the message runs to several paragraphs, which that
 * dialog's plain-string `content` cannot lay out.
 */
export const openMaintenanceNotice = async (
  ctx: NoticeCtx,
  maintenanceWindow: MaintenanceWindow
): Promise<void> => {
  await ctx.openModal({
    id: MAINTENANCE_MODAL_ID,
    title: 'Scheduled maintenance',
    width: 'm',
    parameters: { text: buildBannerText(maintenanceWindow) }
  })
}

/**
 * Shows the notice once per maintenance window, unattended.
 *
 * The dismissal is recorded only after the modal has actually been closed. It
 * used to be written before opening, to stop a second call racing in — but
 * that also marked the notice seen for anyone who closed the tab or navigated
 * away first, so the people least likely to have read it were the ones it
 * never showed again. The race is now handled by `noticeOpen`, which does not
 * outlive the page.
 */
export const handleMaintenanceBannerBoot = async (
  ctx: NoticeCtx
): Promise<void> => {
  const maintenanceWindow = activeMaintenanceWindow(ctx)

  if (!maintenanceWindow || noticeOpen) {
    return
  }

  if (isMaintenanceNoticeDismissed(maintenanceWindow)) {
    return
  }

  noticeOpen = true

  try {
    await openMaintenanceNotice(ctx, maintenanceWindow)
    writeStorage(DISMISSED_KEY, signatureOf(maintenanceWindow))
  } finally {
    noticeOpen = false
  }
}
