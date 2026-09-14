import { getDemoLandingPageInstances } from './demoLandingPageAlert.services'

export type LimitCheck = {
  /** False only when the limit is confirmed to be exceeded. */
  withinLimit: boolean
  message?: string
}

const getTotalCounts = (
  existingInstances: any[],
  currentInstance?: any
): { controlCount: number; variantCount: number } => {
  // The record being published may already be published, in which case it is
  // in the list too. Drop it so the `+ 1` below does not count it twice.
  const otherInstances = currentInstance?.id
    ? existingInstances.filter(
        (instance: any) => String(instance.id) !== String(currentInstance.id)
      )
    : existingInstances

  let controlCount = otherInstances.filter(
    (instance: any) => instance.variant === 'control'
  ).length
  let variantCount = otherInstances.filter(
    (instance: any) => instance.variant === 'variant'
  ).length

  const currentInstanceVariant = currentInstance?.attributes?.variant

  if (currentInstanceVariant === 'control') {
    controlCount += 1
  } else if (currentInstanceVariant === 'variant') {
    variantCount += 1
  }

  return {
    controlCount,
    variantCount
  }
}

export const checkDemoLandingPageLimits = (
  existingInstances: any[],
  currentInstance?: any
): { canCreate: boolean; message?: string } => {
  const { controlCount, variantCount } = getTotalCounts(
    existingInstances,
    currentInstance
  )

  const invalidControlCount = controlCount > 1
  const invalidVariantCount = variantCount > 1

  if (invalidControlCount || invalidVariantCount) {
    const controlMessage = invalidControlCount
      ? `Control pages: ${controlCount} (max 1). `
      : ''
    const variantMessage = invalidVariantCount
      ? `Variant pages: ${variantCount} (max 1).`
      : ''

    return {
      canCreate: false,
      message: `🚨 Demo Landing Page published limit exceeded. ${controlMessage} ${variantMessage}`
    }
  }

  return {
    canCreate: true
  }
}

/**
 * Checks the record about to be published against the published-page limit.
 *
 * Fails open: if the check itself cannot run (missing permission, CMA error)
 * the record is allowed through with a warning. Publishing should never be
 * blocked because the check broke — only because the limit is really exceeded.
 */
export const handleDemoLandingPageCreation = async (
  ctx: any,
  currentInstance: any
): Promise<LimitCheck> => {
  const lookup = await getDemoLandingPageInstances(ctx)

  if (lookup.status === 'unavailable') {
    console.error('Could not verify demo landing page limit:', lookup.reason)

    ctx.alert(
      `Warning: could not verify the demo landing page limit because ${lookup.reason}. Please check manually.`
    )

    return { withinLimit: true }
  }

  const result = checkDemoLandingPageLimits(lookup.instances, currentInstance)

  if (!result.canCreate) {
    const message =
      result.message ?? 'Demo Landing Page published limit exceeded.'

    ctx.alert(message)
    return { withinLimit: false, message }
  }

  return { withinLimit: true }
}
