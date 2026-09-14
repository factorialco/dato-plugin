import { buildClient } from "@datocms/cma-client-browser";
import { readParameters } from "../../lib/pluginParameters";

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
  const { demoLandingPageModelId } = readParameters(ctx);

  if (!client) {
    return [];
  }

  return await client.items.list({
    filter: {
      type: demoLandingPageModelId,
    },
  });
};
