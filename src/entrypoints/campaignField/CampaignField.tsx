import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import { Canvas, TextField } from "datocms-react-ui";
import {
  getValueFromContext,
  handleDifferentValue,
  handleEmptyValue,
} from "./campaignField.utils";

type Props = {
  ctx: RenderFieldExtensionCtx;
};

export const MarketingFormCampaignField = ({ ctx }: Props) => {
  const [currentValue, setCurrentValue] = useState(() =>
    getValueFromContext(ctx)
  );
  const [cleanValue, setCleanValue] = useState(currentValue);

  const hasValidated = useRef(false);
  const isValidating = useRef(false);

  const contextValue = useMemo(() => getValueFromContext(ctx), [ctx]);

  const setValue = useCallback(
    (newValue: string) => {
      setCurrentValue(newValue);
      ctx.setFieldValue(ctx.fieldPath, newValue);
    },
    [ctx, setCurrentValue]
  );

  const finishValidation = useCallback(
    (cleanValue: string) => {
      hasValidated.current = true;
      isValidating.current = false;
      setCleanValue(cleanValue);
    },
    [setCleanValue, hasValidated, isValidating]
  );

  useEffect(() => {
    const validateField = async () => {
      try {
        if (
          !isValidating.current &&
          !hasValidated.current &&
          !ctx.isFormDirty &&
          ctx.itemStatus === "published"
        ) {
          isValidating.current = true;
          if (!contextValue) {
            handleEmptyValue({
              ctx,
              finishValidation,
              contextValue,
            });
          } else {
            await handleDifferentValue({
              ctx,
              contextValue,
              finishValidation,
              hasValidated,
            });
          }
        }
      } catch (e) {
        console.error(e);
        finishValidation(contextValue);
      }
    };

    validateField();
  }, [
    ctx,
    setValue,
    contextValue,
    cleanValue,
    isValidating,
    hasValidated,
    finishValidation,
  ]);

  return (
    <Canvas ctx={ctx}>
      <TextField
        id={ctx.field.id}
        name={"form_campaign"}
        label={""}
        value={currentValue}
        error={!currentValue && "The field is required."}
        onChange={(newValue) => {
          hasValidated.current = cleanValue === newValue;
          setValue(newValue);
        }}
      />
    </Canvas>
  );
};
