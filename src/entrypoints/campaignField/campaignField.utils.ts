import get from "lodash-es/get";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { isEqual } from "lodash-es";
import { remoteValidation } from "./campaignField.services";

export const handleEmptyValue = ({
  cleanFormValue,
  isValidating,
  ctx,
  setCleanValue,
}: {
  isValidating: React.MutableRefObject<boolean>;
  ctx: RenderFieldExtensionCtx;
  cleanFormValue: any;
  setCleanValue: (value: any) => void;
}) => {
  if (!isEqual(cleanFormValue, ctx.formValues)) {
    isValidating.current = true;
    ctx
      .openConfirm({
        title: "The marketing_form_campaign field should not be empty!",
        content:
          "Please set a valid marketing_form_campaign and try again. This field is extremely important. If its value is not correct, we will lose money.",
        choices: [{ label: "Ok", value: "ok" }],
        cancel: { label: "Close", value: "close" },
      })
      .then(() => {
        isValidating.current = false;
        setCleanValue("");
      });
  }
};

export const handleDifferentValue = async ({
  isValidating,
  ctx,
  contextValue,
  cleanValue,
  setCleanValue,
  setValue,
}: {
  isValidating: React.MutableRefObject<boolean>;
  contextValue: string;
  cleanValue: string;
  setCleanValue: (value: string) => void;
  setValue: (value: any) => void;
  ctx: RenderFieldExtensionCtx;
}) => {
  isValidating.current = true;
  ctx.customToast({
    type: "warning",
    message: "Please wait, validating marketing form campaign...",
    dismissAfterTimeout: 7000,
  });

  return remoteValidation(
    contextValue,
    ctx.plugin.attributes.parameters.authorization as string
  ).then((isValid) => {
    if (!isValid) {
      ctx.customToast({
        type: "alert",
        message:
          "Could not ensure that the new marketing_form_campaign value is valid!",
        dismissAfterTimeout: 10000,
      });
      ctx
        .openConfirm({
          title: "Are you sure you want to change the marketing form campaign?",
          content: `Please ensure that the "${contextValue}" marketing form campaign exists and is correct.
                This field is extremely important. If its value is not correct, we will lose money.`,
          cancel: { label: "Cancel", value: "cancel" },
          choices: [
            {
              label: "It may be wrong",
              value: "cancel",
              intent: "negative",
            },
            {
              label: "It is correct",
              value: "confirm",
              intent: "positive",
            },
          ],
        })
        .then((userChoice) => {
          if (userChoice === "cancel") {
            setValue(cleanValue);
            ctx.saveCurrentItem();
          } else {
            setCleanValue(contextValue);
          }
          isValidating.current = false;
        });
    } else {
      ctx.customToast({
        type: "notice",
        message: "Valid marketing form campaign!",
        dismissAfterTimeout: 3000,
      });
      setCleanValue(contextValue);
      isValidating.current = false;
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
