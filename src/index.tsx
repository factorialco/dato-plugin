import type {
  Ctx,
  Field,
  ItemType,
  RenderItemFormSidebarCtx
} from 'datocms-plugin-sdk'
import { connect } from 'datocms-plugin-sdk'
import { render } from './utils/render'
import 'datocms-react-ui/styles.css'
import ConfigScreen from './entrypoints/ConfigScreen'
import PreviewSidebar from './entrypoints/PreviewSidebar'
import { handleDemoLandingPageCreation } from './entrypoints/demoLandingPageAlert/demoLandingPageAlert.utils'
import { FormFieldsValidation } from './entrypoints/formFieldsValidation/FormFieldsValidation'
import { handleMaintenanceBannerBoot } from './entrypoints/maintenanceBanner/maintenanceBanner'
import { MaintenanceModal } from './entrypoints/maintenanceBanner/MaintenanceModal'
import { MaintenanceOutlet } from './entrypoints/maintenanceBanner/MaintenanceOutlet'
import {
  MAINTENANCE_MODAL_ID,
  MAINTENANCE_OUTLET_ID
} from './entrypoints/maintenanceBanner/maintenanceBanner.utils'
import { AccessDenied } from './entrypoints/searchReplace/components/AccessDenied'
import { SearchReplacePage } from './entrypoints/searchReplace/SearchReplacePage'
import { canAccessSearchReplace } from './lib/access'
import { readParameters } from './lib/pluginParameters'

const FORM_FIELDS_VALIDATION_ID = 'formFieldsValidation'
const PREVIEW_SIDEBAR_ID = 'sideBySidePreview'
const SEARCH_REPLACE_PAGE_ID = 'searchReplace'

/**
 * Fire-and-forget wrapper: `mainNavigationTabs` is synchronous and must return
 * its tabs regardless, so a failed notice is swallowed rather than allowed to
 * break the navigation.
 */
const showMaintenanceNotice = async (ctx: Ctx): Promise<void> => {
  try {
    await handleMaintenanceBannerBoot(ctx)
  } catch {
    // Nothing actionable, and nothing worth interrupting the editor for.
  }
}

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />)
  },

  onBoot(ctx) {
    // Deliberately not returned or awaited. The notice is a modal, and
    // `ctx.openModal` only resolves once an editor closes it, so returning
    // that promise hands DatoCMS one that stays pending on a human. DatoCMS
    // waits on the promises these hooks return and then reports the plugin as
    // unresponsive — the "operation is taking longer than usual due to some
    // plugins" toast, which blames `onBeforeItemsPublish`. The notice still
    // records its own dismissal when the modal closes.
    showMaintenanceNotice(ctx)
  },

  async onBeforeItemsPublish(items, ctx) {
    const { demoLandingPageModelId, enforceDemoLandingPageLimit } =
      readParameters(ctx)

    let withinLimit = true

    // Every item is checked, so a bulk publish surfaces all the offenders
    // rather than stopping at the first one.
    for (const item of items) {
      const modelId = item.relationships.item_type.data.id

      if (modelId === demoLandingPageModelId) {
        const result = await handleDemoLandingPageCreation(ctx, item)

        if (!result.withinLimit) {
          withinLimit = false
        }
      }
    }

    // Warn-only until an admin turns enforcement on from the config screen.
    return withinLimit || !enforceDemoLandingPageLimit
  },

  overrideFieldExtensions(field: Field, ctx: any) {
    const { formTemplateModelId, formFieldsBlockApiKey } = readParameters(ctx)
    const modelId = ctx.itemType?.id

    if (
      modelId === formTemplateModelId &&
      field.attributes.api_key === formFieldsBlockApiKey
    ) {
      return {
        addons: [{ id: FORM_FIELDS_VALIDATION_ID }]
      }
    }

    return undefined
  },

  renderFieldExtension(fieldExtensionId, ctx) {
    switch (fieldExtensionId) {
      case FORM_FIELDS_VALIDATION_ID: {
        return render(<FormFieldsValidation ctx={ctx} />)
      }
      default: {
        return undefined
      }
    }
  },

  mainNavigationTabs(ctx) {
    // `onBoot` only fires once when the plugin's JS boots (full page load),
    // not on DatoCMS's internal SPA navigation, so a user who never
    // hard-reloads could miss the maintenance notice entirely. This hook is
    // re-invoked by the host on navigation, so we piggyback on it as a
    // second trigger — not its documented purpose, but tested and harmless
    // (handleMaintenanceBannerBoot no-ops once already shown/dismissed).
    // If DatoCMS changes how often this hook is called, this may need
    // revisiting.
    showMaintenanceNotice(ctx)

    if (!canAccessSearchReplace(ctx)) {
      return []
    }

    return [
      {
        label: 'Search & Replace',
        icon: 'magnifying-glass' as const,
        pointsTo: {
          pageId: SEARCH_REPLACE_PAGE_ID
        }
      }
    ]
  },

  itemFormOutlets() {
    // Declared for every model; the outlet renders nothing when no maintenance
    // window is configured.
    return [{ id: MAINTENANCE_OUTLET_ID, initialHeight: 60 }]
  },

  renderItemFormOutlet(outletId, ctx) {
    switch (outletId) {
      case MAINTENANCE_OUTLET_ID: {
        return render(<MaintenanceOutlet ctx={ctx} />)
      }
      default: {
        return undefined
      }
    }
  },

  renderModal(modalId, ctx) {
    switch (modalId) {
      case MAINTENANCE_MODAL_ID: {
        return render(<MaintenanceModal ctx={ctx} />)
      }
      default: {
        return undefined
      }
    }
  },

  renderPage(pageId, ctx) {
    switch (pageId) {
      case SEARCH_REPLACE_PAGE_ID: {
        // Checked again here: hiding the tab does not stop someone navigating
        // straight to the page URL.
        return render(
          canAccessSearchReplace(ctx) ? (
            <SearchReplacePage ctx={ctx} />
          ) : (
            <AccessDenied ctx={ctx} />
          )
        )
      }
      default: {
        return undefined
      }
    }
  },

  itemFormSidebars(model: ItemType, ctx: any) {
    const { previewBaseUrl, previewModelApiKeys } = readParameters(ctx)

    // Without a base URL the sidebar can only render an empty iframe, so do
    // not declare it at all — it would otherwise force a blank 900px panel
    // open on every record.
    if (!previewBaseUrl) {
      return []
    }

    // An empty list means "every model", preserving the previous behaviour.
    if (
      previewModelApiKeys.length > 0 &&
      !previewModelApiKeys.includes(model.attributes.api_key)
    ) {
      return []
    }

    return [
      {
        id: PREVIEW_SIDEBAR_ID,
        label: 'Live preview',
        preferredWidth: 900,
        startOpen: true
      }
    ]
  },

  renderItemFormSidebar(sidebarId, ctx: RenderItemFormSidebarCtx) {
    switch (sidebarId) {
      case PREVIEW_SIDEBAR_ID: {
        return render(<PreviewSidebar ctx={ctx as any} />)
      }
      default: {
        return undefined
      }
    }
  }
})
