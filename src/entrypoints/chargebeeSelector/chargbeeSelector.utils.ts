import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { get } from "lodash-es";
import { Plan } from "./types";

export const getValueFromContext = (ctx: RenderFieldExtensionCtx) => {
  const potentialValue = get(ctx.formValues, ctx.fieldPath);

  return potentialValue
    ? (JSON.parse(potentialValue as string) as Plan)?.["name"]
    : "";
};
