import { buildClient } from "@datocms/cma-client-browser";
import { readParameters } from "../../lib/pluginParameters";

/**
 * The model is capped at one published control and one published variant, so
 * this is vastly more headroom than the limit allows. If it were ever
 * exceeded the limit is already breached and the outcome is the same.
 */
const PAGE_LIMIT = 500;

export type DemoLandingPageLookup =
  | { status: "ok"; instances: any[] }
  /** The check could not run; callers must not treat this as "no instances". */
  | { status: "unavailable"; reason: string };

const getClient = (ctx: any) => {
  if (ctx.currentUserAccessToken) {
    return buildClient({
      apiToken: ctx.currentUserAccessToken,
      environment: ctx.environment,
    });
  }
};

export const getDemoLandingPageInstances = async (
  ctx: any
): Promise<DemoLandingPageLookup> => {
  const client = getClient(ctx);
  const { demoLandingPageModelId } = readParameters(ctx);

  if (!client) {
    return {
      status: "unavailable",
      reason:
        "the plugin is missing the “currentUserAccessToken” permission, so it cannot read existing pages",
    };
  }

  try {
    const instances = await client.items.list({
      filter: { type: demoLandingPageModelId },
      // The limit is about *published* pages, so drafts must not be counted.
      version: "published",
      page: { limit: PAGE_LIMIT },
    });

    return { status: "ok", instances };
  } catch (error) {
    return {
      status: "unavailable",
      reason:
        error instanceof Error ? error.message : "the records could not be read",
    };
  }
};
