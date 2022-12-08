import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { get } from "lodash-es";
import { Addon } from "./types";

export const getValueFromContext = (ctx: RenderFieldExtensionCtx) => {
  const potentialValue = get(ctx.formValues, ctx.fieldPath);

  return potentialValue ? (potentialValue as Addon)?.["name"] : "";
};
