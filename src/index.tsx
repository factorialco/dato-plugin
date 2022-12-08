import {
  connect,
  Field,
  FieldIntentCtx,
  IntentCtx,
  RenderFieldExtensionCtx,
} from "datocms-plugin-sdk";
import { render } from "./utils/render";
import ConfigScreen from "./entrypoints/configScreen/ConfigScreen";
import "datocms-react-ui/styles.css";
import { MarketingFormCampaignField } from "./entrypoints/campaignField/CampaignField";
import { FormsPage } from "./entrypoints/formsPage/FormsPage";
import { CHARGEBEE_SELECTOR, MARKETING_FORM_CAMPAIGN } from "./constants";
import { ChargbeeSelector } from "./entrypoints/chargebeeSelector/ChargebeeSelector";
import { Addon, Plan } from "./entrypoints/chargebeeSelector/types";

const FORMS_PAGE_ID = "forms";
const CAMPAIGN_FIELD_ID = "marketingFormCampaign";
const CHARGEBEE_SELECTOR_FIELD_ID = "chargebeeSelector";

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />);
  },

  overrideFieldExtensions(field: Field, ctx: FieldIntentCtx) {
    if (field.attributes.api_key === MARKETING_FORM_CAMPAIGN) {
      return {
        editor: { id: CAMPAIGN_FIELD_ID },
      };
    } else if (field.attributes.api_key === CHARGEBEE_SELECTOR) {
      return {
        editor: { id: CHARGEBEE_SELECTOR_FIELD_ID },
      };
    }
  },

  renderFieldExtension(fieldExtensionId: string, ctx: RenderFieldExtensionCtx) {
    switch (fieldExtensionId) {
      case CAMPAIGN_FIELD_ID:
        return render(<MarketingFormCampaignField ctx={ctx} />);
      case CHARGEBEE_SELECTOR_FIELD_ID:
        switch (ctx.itemType.attributes.api_key) {
          case "pricing_core_plan":
            return render(
              <ChargbeeSelector<Plan> ctx={ctx} chargebeeElement="core" />
            );
          case "pricing_usage_limit":
            return render(
              <ChargbeeSelector<Addon> ctx={ctx} chargebeeElement="usage" />
            );
          case "pricing_addon":
            return render(
              <ChargbeeSelector<Addon> ctx={ctx} chargebeeElement="addon" />
            );
          case "pricing_bundle":
            return render(
              <ChargbeeSelector<Addon> ctx={ctx} chargebeeElement="bundle" />
            );
          case "pricing_normal_plan":
            return render(
              <ChargbeeSelector<Addon> ctx={ctx} chargebeeElement="plan" />
            );
        }
    }
  },

  mainNavigationTabs(ctx: IntentCtx) {
    return [
      {
        label: "Forms",
        icon: "toolbox",
        placement: ["before", "settings"],
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
});
