import { connect, Field, ItemType, RenderItemFormSidebarCtx } from "datocms-plugin-sdk";
import { render } from "./utils/render";
import ConfigScreen from "./entrypoints/configScreen/ConfigScreen";
import "datocms-react-ui/styles.css";
import { MarketingFormCampaignField } from "./entrypoints/campaignField/CampaignField";
import { FormsPage } from "./entrypoints/formsPage/FormsPage";
import { MARKETING_FORM_CAMPAIGN } from "./constants/marketingFormCampaign";
import PreviewSidebar from "./entrypoints/PreviewSidebar";
import { handleDemoLandingPageCreation } from "./entrypoints/demoLandingPageAlert/demoLandingPageAlert.utils";
import { FormFieldsValidation } from "./entrypoints/formFieldsValidation/FormFieldsValidation";
import { handleMaintenanceBannerBoot } from "./entrypoints/maintenanceBanner/maintenanceBanner";
import { MaintenancePage } from "./entrypoints/maintenanceBanner/MaintenancePage";

const FORMS_PAGE_ID = "forms";
const MAINTENANCE_PAGE_ID = "maintenance";
const CAMPAIGN_FIELD_ID = "marketingFormCampaign";
const FORM_FIELDS_VALIDATION_ID = "formFieldsValidation";
const PREVIEW_SIDEBAR_ID = "sideBySidePreview";

const DEMO_LANDING_PAGE_MODEL_ID = "evL8wHUkSgqfKeJxwaYKxA";
const FORM_TEMPLATE_MODEL_ID = "BZRowM-YRc66pOcGqLT9ng";
const FORM_FIELDS_BLOCK_NAME = "form_fields"

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
  },

  onBoot(ctx) {
    return handleMaintenanceBannerBoot(ctx);
  },

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
    
    if (field.attributes.api_key === MARKETING_FORM_CAMPAIGN) {
      return {
        editor: { id: CAMPAIGN_FIELD_ID },
      };
    }

    if (modelId === FORM_TEMPLATE_MODEL_ID && field.attributes.api_key === FORM_FIELDS_BLOCK_NAME) {
      return {
        addons: [{ id: FORM_FIELDS_VALIDATION_ID }],
      };
    }
    
    return undefined;
  },

  renderFieldExtension(fieldExtensionId, ctx) {
    switch (fieldExtensionId) {
      case CAMPAIGN_FIELD_ID:
        return render(<MarketingFormCampaignField ctx={ctx} />);
      case FORM_FIELDS_VALIDATION_ID:
        return render(<FormFieldsValidation ctx={ctx} />);
      default:
        return undefined;
    }
  },

  mainNavigationTabs(ctx: any) {
    // `onBoot` only fires once when the plugin's JS boots (full page load),
    // not on DatoCMS's internal SPA navigation, so a user who never
    // hard-reloads could miss the maintenance notice entirely. This hook is
    // re-invoked by the host on navigation, so we piggyback on it as a
    // second trigger — not its documented purpose, but tested and harmless
    // (handleMaintenanceBannerBoot no-ops once already shown/dismissed).
    // If DatoCMS changes how often this hook is called, this may need
    // revisiting.
    handleMaintenanceBannerBoot(ctx).catch(() => {});

    return [
      {
        label: "Forms",
        icon: "toolbox",
        pointsTo: {
          pageId: FORMS_PAGE_ID,
        },
      },
      {
        label: "Maintenance",
        icon: "triangle-exclamation",
        pointsTo: {
          pageId: MAINTENANCE_PAGE_ID,
        },
      },
    ];
  },

  renderPage(pageId, ctx) {
    switch (pageId) {
      case FORMS_PAGE_ID:
        return render(<FormsPage ctx={ctx} />);
      case MAINTENANCE_PAGE_ID:
        return render(<MaintenancePage ctx={ctx} />);
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
