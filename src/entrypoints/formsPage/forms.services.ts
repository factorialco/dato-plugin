import { Client } from "@datocms/cma-client";
import { DatoItem } from "./forms.types";

const FORM_MODEL_ID = "lead_generator,hero";
const FORM_CONTENT_INPUT_ID = "layout_content";

export const getAllForms = async (client: Client) => {
  const formsById: Record<string, DatoItem> = {};
  for await (const form of client.items.listPagedIterator({
    filter: {
      type: FORM_MODEL_ID,
    },
    nested: !!FORM_CONTENT_INPUT_ID,
  })) {
    formsById[form.id] = form as unknown as DatoItem;
  }
  return formsById;
};

export const getFormsByCampaign = async (
  client: Client,
  campaign: string
): Promise<DatoItem[]> => {
  const forms = [];

  for await (const form of client.items.listPagedIterator({
    filter: {
      type: FORM_MODEL_ID,
      query: campaign,
    },
    nested: !!FORM_CONTENT_INPUT_ID,
  })) {
    forms.push(form as unknown as DatoItem);
  }
  return forms;
};
