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

const getTotalCounts = (existingInstances: any[], currentInstance: any): { controlCount: number; variantCount: number } => {
  const controlInstances = existingInstances.filter((instance: any) => instance.variant === "control");
  const variantInstances = existingInstances.filter((instance: any) => instance.variant === "variant");

  let controlCount = controlInstances.length;
  let variantCount = variantInstances.length;

  const currentInstanceVariant = currentInstance?.attributes?.variant;

  if (currentInstanceVariant === "control") {
    controlCount += 1;
  } else if (currentInstanceVariant === "variant") {
    variantCount += 1;
  }

  return {
    controlCount,
    variantCount,
  };
};

export const checkDemoLandingPageLimits = (
  existingInstances: any[],
  currentInstance?: any
): { canCreate: boolean; message?: string } => {
  const { controlCount, variantCount } = getTotalCounts(existingInstances, currentInstance);

  const invalidControlCount = controlCount > 1;
  const invalidVariantCount = variantCount > 1;

  if (invalidControlCount || invalidVariantCount) {
    const controlMessage = invalidControlCount ? `Control pages: ${controlCount} (max 1). ` : '';
    const variantMessage = invalidVariantCount ? `Variant pages: ${variantCount} (max 1).` : '';

    return {
      canCreate: false,
      message: `🚨 Demo Landing Page published limit exceeded. ${controlMessage} ${variantMessage}`,
    };
  }

  return {
    canCreate: true,
  };
};
