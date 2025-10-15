import { getDemoLandingPageInstances } from "./demoLandingPageAlert.services";

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

const getTotalCounts = (existingInstances: any[], currentInstance: any): { originalCount: number; variantCount: number } => {
  const originalInstances = existingInstances.filter((instance: any) => instance.variant === "original");
  const variantInstances = existingInstances.filter((instance: any) => instance.variant === "variant");

  let originalCount = originalInstances.length;
  let variantCount = variantInstances.length;

  const currentInstanceVariant = currentInstance?.attributes?.variant;

  if (currentInstanceVariant === "original") {
    originalCount += 1;
  } else if (currentInstanceVariant === "variant") {
    variantCount += 1;
  }

  return {
    originalCount,
    variantCount,
  };
};

export const checkDemoLandingPageLimits = (
  existingInstances: any[],
  currentInstance?: any
): { canCreate: boolean; message?: string } => {
  const { originalCount, variantCount } = getTotalCounts(existingInstances, currentInstance);

  const invalidOriginalCount = originalCount > 1;
  const invalidVariantCount = variantCount > 1;

  if (invalidOriginalCount || invalidVariantCount) {
    const originalMessage = invalidOriginalCount ? `Original pages: ${originalCount} (max 1). ` : '';
    const variantMessage = invalidVariantCount ? `Variant pages: ${variantCount} (max 1).` : '';

    return {
      canCreate: false,
      message: `🚨 Demo Landing Page published limit exceeded. ${originalMessage} ${variantMessage}`,
    };
  }

  return {
    canCreate: true,
  };
};
