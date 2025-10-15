import { getDemoLandingPageInstances } from "./demoLandingPageAlert.services";

const DEMO_LANDING_PAGE_MODEL_NAME = "Demo Landing Page";

export const handleDemoLandingPageCreation = async (ctx: any, currentInstance: any): Promise<boolean> => {
  try {
    const existingInstances = await getDemoLandingPageInstances(ctx);
    
    const result = checkDemoLandingPageLimits(existingInstances, currentInstance);

    if (!result.canCreate) {
      ctx.alert(result.message!);
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Error checking demo landing page limit:", error);

    ctx.alert("Warning: Could not verify demo landing page limit. Please check manually.");
    return true;
  }
};

const getTotalCounts = (existingInstances: any[], currentInstance: any): { original: number; variant: number } => {
  const originalInstances = existingInstances.filter((instance: any) => instance.variant === "original");
  const variantInstances = existingInstances.filter((instance: any) => instance.variant === "variant");

  let totalOriginalCount = originalInstances.length;
  let totalVariantCount = variantInstances.length;

  const currentInstanceVariant = currentInstance?.attributes?.variant;

  if (currentInstanceVariant === "original") {
    totalOriginalCount += 1;
  } else if (currentInstanceVariant === "variant") {
    totalVariantCount += 1;
  }

  return {
    original: originalInstances.length,
    variant: variantInstances.length,
  };
};

export const checkDemoLandingPageLimits = (
  existingInstances: any[],
  currentInstance?: any
): { canCreate: boolean; message?: string } => {
  const { original, variant } = getTotalCounts(existingInstances, currentInstance);

  const invalidOriginalCount = original > 1;
  const invalidVariantCount = variant > 1;

  if (invalidOriginalCount || invalidVariantCount) {
    const originalMessage = invalidOriginalCount ? `Original pages: ${original} (max 1). ` : '';
    const variantMessage = invalidVariantCount ? `Variant pages: ${variant} (max 1).` : '';

    return {
      canCreate: false,
      message: `🚨 Demo Landing Page published limit exceeded. ${originalMessage} ${variantMessage}`,
    };
  }

  return {
    canCreate: true,
  };
};
