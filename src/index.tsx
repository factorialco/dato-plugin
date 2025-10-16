import { connect, Field, ItemType, RenderItemFormSidebarCtx } from "datocms-plugin-sdk";
import { render } from "./utils/render";
import ConfigScreen from "./entrypoints/configScreen/ConfigScreen";
import "datocms-react-ui/styles.css";
import { MarketingFormCampaignField } from "./entrypoints/campaignField/CampaignField";
import { FormsPage } from "./entrypoints/formsPage/FormsPage";
import { MARKETING_FORM_CAMPAIGN } from "./constants/marketingFormCampaign";
import PreviewSidebar from "./entrypoints/PreviewSidebar";
import { handleDemoLandingPageCreation } from "./entrypoints/demoLandingPageAlert/demoLandingPageAlert.utils";

const FORMS_PAGE_ID = "forms";
const CAMPAIGN_FIELD_ID = "marketingFormCampaign";
const PREVIEW_SIDEBAR_ID = "sideBySidePreview";

const DEMO_LANDING_PAGE_MODEL_ID = "evL8wHUkSgqfKeJxwaYKxA";

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
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
    if (field.attributes.api_key === MARKETING_FORM_CAMPAIGN) {
      return {
        editor: { id: CAMPAIGN_FIELD_ID },
      };
    }
  },

  renderFieldExtension(fieldExtensionId, ctx) {
    switch (fieldExtensionId) {
      case CAMPAIGN_FIELD_ID:
        return render(<MarketingFormCampaignField ctx={ctx} />);
    }
  },

  mainNavigationTabs(ctx: any) {
    return [
      {
        label: "Forms",
        icon: "toolbox",
        pointsTo: {
          pageId: FORMS_PAGE_ID,
        },
      },
    ];
  },

  renderPage(pageId, ctx) {
    switch (pageId) {
      case FORMS_PAGE_ID:
        return render(<FormsPage ctx={ctx} />);
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
