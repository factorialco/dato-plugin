import get from "lodash-es/get";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { remoteValidation } from "./campaignField.services";

const TOAST_DURATION = 5000;

export const handleEmptyValue = ({
  contextValue,
  ctx,
  finishValidation,
}: {
  ctx: RenderFieldExtensionCtx;
  contextValue: string;
  finishValidation: (cleanValue: string) => void;
}) => {
  ctx
    .openConfirm({
      title: "The marketing_form_campaign field should not be empty!",
      content:
        "Please set a valid marketing_form_campaign and try again. This field is extremely important. If its value is not correct, we will lose money.",
      choices: [{ label: "Ok", value: "ok" }],
      cancel: { label: "Close", value: "close" },
    })
    .then(() => {
      finishValidation(contextValue);
    });
};

export const handleDifferentValue = async ({
  ctx,
  contextValue,
  finishValidation,
}: {
  contextValue: string;
  hasValidated: React.MutableRefObject<boolean>;
  finishValidation: (cleanValue: string) => void;
  ctx: RenderFieldExtensionCtx;
}) => {
  ctx.customToast({
    type: "warning",
    message: "Please wait, validating marketing form campaign...",
    dismissAfterTimeout: TOAST_DURATION,
  });

  return remoteValidation(
    contextValue,
    ctx.plugin.attributes.parameters.authorization as string
  ).then((isValid) => {
    if (!isValid) {
      ctx.customToast({
        type: "alert",
        message:
          "Could not ensure that the marketing_form_campaign value is valid!",
        dismissAfterTimeout: TOAST_DURATION,
      });
      ctx
        .openConfirm({
          title: "Could not validate the marketing form campaign!",
          content: `Please ensure that the "${contextValue}" marketing form campaign exists and is correct.
                This field is extremely important. If its value is not correct, we will lose money.`,
          cancel: { label: "Close", value: "cancel" },
          choices: [
            {
              label: "Ok",
              value: "cancel",
              intent: "negative",
            },
          ],
        })
        .then(() => {
          finishValidation(contextValue);
        });
    } else {
      ctx.customToast({
        type: "notice",
        message: "Valid marketing form campaign!",
        dismissAfterTimeout: TOAST_DURATION,
      });

      finishValidation(contextValue);
    }
  });
};

export const getValueFromContext = (ctx: RenderFieldExtensionCtx) => {
  const potentialValue = get(ctx.formValues, ctx.fieldPath);
  if (typeof potentialValue === "string") {
    return potentialValue;
  }
  return "";
};
