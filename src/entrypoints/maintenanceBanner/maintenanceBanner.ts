import { Ctx } from "datocms-plugin-sdk";
import {
  buildBannerText,
  getMaintenanceWindow,
  MaintenanceParameters,
} from "./maintenanceBanner.utils";

// Testing-only escape hatch, used by the primary-environment gate below:
// run `window.localStorage.setItem("factorial-maintenance-force-preview", "true")`
// in the browser console of a sandbox environment to preview the dialog
// without needing to be in the primary (main) environment. Not exposed in
// any UI.
const FORCE_PREVIEW_KEY = "factorial-maintenance-force-preview";

// A single fixed key (not one key per window) so dismissals are shared
// across every open tab (localStorage, unlike sessionStorage, is shared
// across tabs of the same origin) and never accumulate: it just gets
// overwritten with the signature of whichever window was last dismissed.
const DISMISSED_KEY = "factorial-maintenance-dismissed";

export const handleMaintenanceBannerBoot = async (
  ctx: Ctx
): Promise<void> => {
  const forcePreview = window.localStorage.getItem(FORCE_PREVIEW_KEY) === "true";

  if (!ctx.isEnvironmentPrimary && !forcePreview) {
    return;
  }

  const parameters = ctx.plugin.attributes.parameters as MaintenanceParameters;
  const maintenanceWindow = getMaintenanceWindow(parameters);

  if (!maintenanceWindow) {
    return;
  }

  // The banner is shown for as long as it stays enabled — there's no
  // start/end window to compare against, the start time is purely
  // informational text baked into the message.
  const signature = `${maintenanceWindow.message}:${maintenanceWindow.startsAt}`;

  if (window.localStorage.getItem(DISMISSED_KEY) === signature) {
    return;
  }

  // Set eagerly (before awaiting) so a second near-simultaneous call — e.g.
  // this handler is also wired into `mainNavigationTabs`, which can fire in
  // quick succession — doesn't race and open two dialogs.
  window.localStorage.setItem(DISMISSED_KEY, signature);

  // A blocking, centered confirm dialog — more attention-grabbing than a
  // corner toast, and requires an explicit interaction before it closes.
  await ctx.openConfirm({
    title: "Scheduled maintenance",
    content: buildBannerText(maintenanceWindow),
    choices: [{ label: "Got it", value: "ack", intent: "positive" }],
    cancel: { label: "Close", value: "closed" },
  });
};
