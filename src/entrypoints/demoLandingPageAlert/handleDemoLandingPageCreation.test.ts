import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleDemoLandingPageCreation } from './demoLandingPageAlert.utils'
import { getDemoLandingPageInstances } from './demoLandingPageAlert.services'

vi.mock(import('./demoLandingPageAlert.services'), () => ({
  getDemoLandingPageInstances: vi.fn<typeof getDemoLandingPageInstances>()
}))

const lookup = vi.mocked(getDemoLandingPageInstances)
const makeCtx = () => ({ alert: vi.fn<(message: string) => void>() })
const record = (variant: string, id = 'current') => ({
  id,
  attributes: { variant }
})

describe(handleDemoLandingPageCreation, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence the expected warning from the fail-open path.
    })
  })

  it('reports the limit as exceeded and alerts the editor', async () => {
    lookup.mockResolvedValue({
      status: 'ok',
      instances: [{ id: 'abc', variant: 'control' }]
    })
    const ctx = makeCtx()

    const result = await handleDemoLandingPageCreation(ctx, record('control'))

    expect(result.withinLimit).toBeFalsy()
    expect(ctx.alert).toHaveBeenCalledOnce()
  })

  it('passes a record that stays within the limit without alerting', async () => {
    lookup.mockResolvedValue({ status: 'ok', instances: [] })
    const ctx = makeCtx()

    const result = await handleDemoLandingPageCreation(ctx, record('control'))

    expect(result.withinLimit).toBeTruthy()
    expect(ctx.alert).not.toHaveBeenCalled()
  })

  it('fails open when the permission is missing', async () => {
    // Never block publishing because the check itself could not run.
    lookup.mockResolvedValue({
      status: 'unavailable',
      reason: 'the plugin is missing the “currentUserAccessToken” permission'
    })
    const ctx = makeCtx()

    const result = await handleDemoLandingPageCreation(ctx, record('control'))

    expect(result.withinLimit).toBeTruthy()
    expect(ctx.alert).toHaveBeenCalledOnce()
    expect(ctx.alert.mock.calls[0][0]).toContain('could not verify')
  })

  it('fails open when the CMA call errors', async () => {
    lookup.mockResolvedValue({ status: 'unavailable', reason: 'network down' })
    const ctx = makeCtx()

    const result = await handleDemoLandingPageCreation(ctx, record('variant'))

    expect(result.withinLimit).toBeTruthy()
    expect(ctx.alert).toHaveBeenCalledOnce()
  })
})
