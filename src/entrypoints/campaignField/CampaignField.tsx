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
  const [cleanFormValue, setCleanFormValue] = useState(
    JSON.parse(JSON.stringify(ctx.formValues))
  );
  const [currentValue, setCurrentValue] = useState(() =>
    getValueFromContext(ctx)
  );
  const [cleanValue, setCleanValue] = useState(currentValue);

  const isValidating = useRef(false);
  const contextValue = useMemo(() => getValueFromContext(ctx), [ctx]);

  const setValue = useCallback(
    (newValue: string) => {
      setCurrentValue(newValue);
      ctx.setFieldValue(ctx.fieldPath, newValue);
    },
    [ctx, setCurrentValue]
  );

  const setCleanValueHelper = useCallback(
    (cleanValue: string) => {
      setCleanValue(cleanValue);
      setCleanFormValue(ctx.formValues);
    },
    [ctx.formValues]
  );

  useEffect(() => {
    const validateField = async () => {
      try {
        if (
          !isValidating.current &&
          ctx.itemStatus === "published" &&
          !ctx.isFormDirty
        ) {
          if (!contextValue) {
            handleEmptyValue({
              cleanFormValue,
              ctx,
              isValidating,
              setCleanValue: setCleanValueHelper,
            });
          } else if (cleanValue !== contextValue) {
            await handleDifferentValue({
              isValidating,
              ctx,
              contextValue,
              cleanValue,
              setCleanValue: setCleanValueHelper,
              setValue,
            });
          }
        }
      } catch (e) {
        console.error(e);
        isValidating.current = false;
      }
    };

    validateField();
  }, [
    ctx,
    contextValue,
    cleanValue,
    isValidating,
    cleanFormValue,
    setValue,
    setCleanValueHelper,
  ]);

  return (
    <Canvas ctx={ctx}>
      <TextField
        id={ctx.field.id}
        name={"form_campaign"}
        label={""}
        value={currentValue}
        error={!currentValue && "The field is required."}
        onChange={setValue}
      />
    </Canvas>
  );
};
