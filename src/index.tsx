import type {
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
import { AccessDenied } from './entrypoints/searchReplace/components/AccessDenied'
import { SearchReplacePage } from './entrypoints/searchReplace/SearchReplacePage'
import { canAccessSearchReplace } from './lib/access'
import { readParameters } from './lib/pluginParameters'

const FORM_FIELDS_VALIDATION_ID = 'formFieldsValidation'
const PREVIEW_SIDEBAR_ID = 'sideBySidePreview'
const SEARCH_REPLACE_PAGE_ID = 'searchReplace'

connect({
  renderConfigScreen(ctx) {
    return render(<ConfigScreen ctx={ctx} />)
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
