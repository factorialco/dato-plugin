import {
  connect,
  Field,
  ItemType,
  RenderItemFormSidebarCtx,
} from "datocms-plugin-sdk";
import { render } from "./utils/render";
import "datocms-react-ui/styles.css";
import PreviewSidebar from "./entrypoints/PreviewSidebar";
import { handleDemoLandingPageCreation } from "./entrypoints/demoLandingPageAlert/demoLandingPageAlert.utils";
import { FormFieldsValidation } from "./entrypoints/formFieldsValidation/FormFieldsValidation";

const FORM_FIELDS_VALIDATION_ID = "formFieldsValidation";
const PREVIEW_SIDEBAR_ID = "sideBySidePreview";

const DEMO_LANDING_PAGE_MODEL_ID = "evL8wHUkSgqfKeJxwaYKxA";
const FORM_TEMPLATE_MODEL_ID = "BZRowM-YRc66pOcGqLT9ng";
const FORM_FIELDS_BLOCK_NAME = "form_fields";

connect({
  async onBeforeItemsPublish(items, ctx) {
    for (const item of items) {
      const modelId = item.relationships.item_type.data.id;

      if (modelId === DEMO_LANDING_PAGE_MODEL_ID) {
        const canCreate = await handleDemoLandingPageCreation(ctx, item);

        if (!canCreate) {
          return true; // For now, allow the save to proceed
        }
      }
    }
    return true;
  },

  overrideFieldExtensions(field: Field, ctx: any) {
    const modelId = ctx.itemType?.id;

    if (
      modelId === FORM_TEMPLATE_MODEL_ID &&
      field.attributes.api_key === FORM_FIELDS_BLOCK_NAME
    ) {
      return {
        addons: [{ id: FORM_FIELDS_VALIDATION_ID }],
      };
    }

    return undefined;
  },

  renderFieldExtension(fieldExtensionId, ctx) {
    switch (fieldExtensionId) {
      case FORM_FIELDS_VALIDATION_ID:
        return render(<FormFieldsValidation ctx={ctx} />);
      default:
        return undefined;
    }
  },

  itemFormSidebars(model: ItemType, ctx: any) {
    return [
      {
        id: "sideBySidePreview",
        label: "Live preview",
        preferredWidth: 900,
        startOpen: true,
      },
    ];
  },

  renderItemFormSidebar(sidebarId, ctx: RenderItemFormSidebarCtx) {
    switch (sidebarId) {
      case PREVIEW_SIDEBAR_ID:
        return render(<PreviewSidebar ctx={ctx as any} />);
    }
  },
});
