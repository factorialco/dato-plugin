import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activeMaintenanceWindow,
  handleMaintenanceBannerBoot,
  isMaintenanceNoticeDismissed
} from './maintenanceBanner'

const WINDOW = {
  maintenanceEnabled: true,
  maintenanceMessage: 'Back soon',
  maintenanceStartsAt: '2026-07-10T08:00:00.000Z'
}

const buildCtx = (
  parameters: Record<string, unknown> = WINDOW,
  { isEnvironmentPrimary = true } = {}
) => ({
  plugin: { attributes: { parameters } },
  isEnvironmentPrimary,
  openModal: vi.fn<() => Promise<undefined>>(() => Promise.resolve(undefined))
})

/** A modal whose close is driven by the test. */
const deferredModal = () => {
  let close: () => void = () => undefined
  // A promise that stays pending until the test closes the modal is exactly
  // what is being simulated here, so `new Promise` is the right tool.
  const openModal = vi.fn<() => Promise<undefined>>(
    () =>
      // oxlint-disable-next-line promise/avoid-new
      new Promise<undefined>((resolve) => {
        close = () => {
          resolve(undefined)
        }
      })
  )

  return { openModal, close: () => close() }
}

/** Narrows away the null the tests have already established is absent. */
const windowOf = (ctx: Parameters<typeof activeMaintenanceWindow>[0]) => {
  const maintenanceWindow = activeMaintenanceWindow(ctx)

  if (!maintenanceWindow) {
    throw new Error('Expected a configured maintenance window')
  }

  return maintenanceWindow
}

describe(activeMaintenanceWindow, () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('announces a configured window in the primary environment', () => {
    expect(activeMaintenanceWindow(buildCtx())).toStrictEqual({
      message: 'Back soon',
      startsAt: '2026-07-10T08:00:00.000Z'
    })
  })

  it('stays silent outside the primary environment', () => {
    expect(
      activeMaintenanceWindow(buildCtx(WINDOW, { isEnvironmentPrimary: false }))
    ).toBeNull()
  })

  it('shows in a sandbox once the project opts in', () => {
    expect(
      activeMaintenanceWindow(
        buildCtx(
          { ...WINDOW, maintenanceShowInSandbox: true },
          { isEnvironmentPrimary: false }
        )
      )
    ).not.toBeNull()
  })

  it('still stays silent in a sandbox that has not opted in', () => {
    expect(
      activeMaintenanceWindow(
        buildCtx(
          { ...WINDOW, maintenanceShowInSandbox: false },
          { isEnvironmentPrimary: false }
        )
      )
    ).toBeNull()
  })

  it('does not need the opt-in in the primary environment', () => {
    expect(
      activeMaintenanceWindow(
        buildCtx({ ...WINDOW, maintenanceShowInSandbox: false })
      )
    ).not.toBeNull()
  })

  it('stays silent when the banner is off', () => {
    expect(
      activeMaintenanceWindow(
        buildCtx({ ...WINDOW, maintenanceEnabled: false })
      )
    ).toBeNull()
  })
})

describe(handleMaintenanceBannerBoot, () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('opens the notice once, then not again', async () => {
    const ctx = buildCtx()

    await handleMaintenanceBannerBoot(ctx)
    await handleMaintenanceBannerBoot(ctx)

    expect(ctx.openModal).toHaveBeenCalledOnce()
  })

  // The bug this replaced: the dismissal was recorded before the modal was
  // awaited, so closing the tab first marked it seen forever.
  it('records the dismissal only once the notice has been closed', async () => {
    const modal = deferredModal()
    const ctx = { ...buildCtx(), ...modal }

    const shown = handleMaintenanceBannerBoot(ctx)

    // Still open: nothing has been read yet, so nothing is dismissed.
    expect(isMaintenanceNoticeDismissed(windowOf(ctx))).toBeFalsy()

    modal.close()
    await shown

    expect(isMaintenanceNoticeDismissed(windowOf(ctx))).toBeTruthy()
  })

  it('does not open a second modal while the first is still open', async () => {
    const modal = deferredModal()
    const ctx = { ...buildCtx(), ...modal }

    const first = handleMaintenanceBannerBoot(ctx)
    const second = handleMaintenanceBannerBoot(ctx)
    await Promise.resolve()

    expect(ctx.openModal).toHaveBeenCalledOnce()

    // Release the guard, which lives for the page rather than the test.
    modal.close()
    await Promise.all([first, second])
  })

  it('re-notifies when the window changes', async () => {
    const ctx = buildCtx()
    await handleMaintenanceBannerBoot(ctx)

    const edited = buildCtx({ ...WINDOW, maintenanceMessage: 'Back later' })
    await handleMaintenanceBannerBoot(edited)

    expect(edited.openModal).toHaveBeenCalledOnce()
  })

  it('stays silent when there is nothing scheduled', async () => {
    const ctx = buildCtx({ maintenanceEnabled: false })

    await handleMaintenanceBannerBoot(ctx)

    expect(ctx.openModal).not.toHaveBeenCalled()
  })
})
