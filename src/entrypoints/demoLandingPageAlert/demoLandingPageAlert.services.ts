import { buildClient } from "@datocms/cma-client-browser";

const DEMO_LANDING_PAGE_MODEL_API_KEY = "evL8wHUkSgqfKeJxwaYKxA";

const getClient = (ctx: any) => {
  if (ctx.currentUserAccessToken) {
    return buildClient({
      apiToken: ctx.currentUserAccessToken,
      environment: ctx.environment,
    });
  }
}

export const getDemoLandingPageInstances = async (ctx: any) => {
  const client = getClient(ctx);

  if (!client) {
    return [];
  }

  return await client.items.list({
    filter: {
      type: DEMO_LANDING_PAGE_MODEL_API_KEY,
    },
  });
};
