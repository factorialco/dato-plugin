import {
  connect,
  Field,
  ItemType,
  RenderItemFormSidebarCtx,
} from "datocms-plugin-sdk";
import { render } from "./utils/render";
import "datocms-react-ui/styles.css";
import ConfigScreen from "./entrypoints/ConfigScreen";
import PreviewSidebar from "./entrypoints/PreviewSidebar";
import { handleDemoLandingPageCreation } from "./entrypoints/demoLandingPageAlert/demoLandingPageAlert.utils";
import { FormFieldsValidation } from "./entrypoints/formFieldsValidation/FormFieldsValidation";
import { readParameters } from "./lib/pluginParameters";

const FORM_FIELDS_VALIDATION_ID = "formFieldsValidation";
const PREVIEW_SIDEBAR_ID = "sideBySidePreview";

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
  },

  async onBeforeItemsPublish(items, ctx) {
    const { demoLandingPageModelId } = readParameters(ctx);

    for (const item of items) {
      const modelId = item.relationships.item_type.data.id;

      if (modelId === demoLandingPageModelId) {
        const canCreate = await handleDemoLandingPageCreation(ctx, item);

        if (!canCreate) {
          return true; // For now, allow the save to proceed
        }
      }
    }
    return true;
  },

  overrideFieldExtensions(field: Field, ctx: any) {
    const { formTemplateModelId, formFieldsBlockApiKey } = readParameters(ctx);
    const modelId = ctx.itemType?.id;

    if (
      modelId === formTemplateModelId &&
      field.attributes.api_key === formFieldsBlockApiKey
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
        id: PREVIEW_SIDEBAR_ID,
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
