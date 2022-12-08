import { MARKETING_FORM_CAMPAIGN } from "../../constants";
import { ClassifiedFormBlocks, DatoItem } from "./forms.types";

export const mapMarketingFormCampaign = (forms: DatoItem[]) => {
  const classifiedForms: ClassifiedFormBlocks = {};

  forms.forEach((form) => {
    classifiedForms[form.id] = getNestedValues(
      form,
      "attributes",
      MARKETING_FORM_CAMPAIGN
    );
  });

  return classifiedForms;
};

export const getNestedValues = <T>(
  obj: object,
  parentKey: string,
  childrenKey: string
): T[] => {
  let nestedValues: T[] = [];

  Object.entries(obj).forEach(([objectKey, objectValue]) => {
    if (objectKey === parentKey && objectValue[childrenKey] !== undefined) {
      nestedValues.push(objectValue);
    } else if (objectValue && typeof objectValue === "object") {
      nestedValues = [
        ...nestedValues,
        ...getNestedValues<T>(objectValue, parentKey, childrenKey),
      ];
    }
  });

  return nestedValues;
};
