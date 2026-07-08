import { connect, ItemType, RenderItemFormSidebarCtx } from "datocms-plugin-sdk";
import { render } from "./utils/render";
import "datocms-react-ui/styles.css";
import PreviewSidebar from "./entrypoints/PreviewSidebar";
import { handleDemoLandingPageCreation } from "./entrypoints/demoLandingPageAlert/demoLandingPageAlert.utils";

const PREVIEW_SIDEBAR_ID = "sideBySidePreview";

const DEMO_LANDING_PAGE_MODEL_ID = "evL8wHUkSgqfKeJxwaYKxA";

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
