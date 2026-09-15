import { useState } from 'react'
import type { RenderConfigScreenCtx } from 'datocms-plugin-sdk'
import {
  Button,
  Canvas,
  FieldGroup,
  Form,
  SwitchField,
  TextareaField,
  TextField
} from 'datocms-react-ui'
import PluginHeader from './PluginHeader'
import type { PluginParameters } from '../../lib/pluginParameters'
import {
  fromDateTimeInput,
  toDateTimeInput
} from '../maintenanceBanner/maintenanceBanner.utils'
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  DEFAULT_PARAMETERS,
  normalizeParameters,
  readParameters
} from '../../lib/pluginParameters'

type Props = {
  ctx: RenderConfigScreenCtx
}

/**
 * Every comma-separated field is held as raw text while editing. Parsing on every
 * keystroke deleted the separator as it was typed: "a" + "," split to
 * ["a", ""], the empty part was filtered out, and the field rendered back as
 * "a" — so a second entry could never be reached. It is parsed once, on save.
 */
type ListParameterKey = {
  [K in keyof PluginParameters]: PluginParameters[K] extends string[]
    ? K
    : never
}[keyof PluginParameters]

type FormValues = Omit<PluginParameters, ListParameterKey> &
  Record<ListParameterKey, string>

const isValidBaseUrl = (value: string) => {
  if (!value) {
    return true
  }

  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

// `datetime-local` is a standard input type that datocms-react-ui's `type`
// union predates. The library passes the prop straight through to the <input>,
// which handles it natively, so the assertion is about the union being
// incomplete rather than about the value being wrong.
const DATETIME_LOCAL_TYPE = 'datetime-local' as 'date'

const ConfigScreen = ({ ctx }: Props) => {
  const [values, setValues] = useState<FormValues>(() => {
    const saved = readParameters(ctx)

    return {
      ...saved,
      previewModelApiKeys: saved.previewModelApiKeys.join(', '),
      searchReplaceAllowedRoleIds: saved.searchReplaceAllowedRoleIds.join(', ')
    }
  })
  const [saving, setSaving] = useState(false)

  const canEdit = ctx.currentRole.meta.final_permissions.can_edit_schema
  const baseUrlError = isValidBaseUrl(values.previewBaseUrl)
    ? undefined
    : 'Enter a full URL, e.g. https://example.com'

  // Only blocks saving when the banner is switched on: an incomplete window
  // left behind after it is switched off is harmless. Reported per field, so
  // the message does not get flagged for a missing start time.
  const maintenanceMessageError =
    values.maintenanceEnabled && !values.maintenanceMessage.trim()
      ? 'Add a message, or turn the banner off.'
      : undefined

  const maintenanceStartError =
    values.maintenanceEnabled && !values.maintenanceStartsAt
      ? 'Pick when maintenance starts, or turn the banner off.'
      : undefined

  const maintenanceError = maintenanceMessageError ?? maintenanceStartError

  const setValue =
    <K extends keyof FormValues>(key: K) =>
    (value: FormValues[K]) =>
      setValues((current) => ({ ...current, [key]: value }))

  const handleSubmit = async () => {
    setSaving(true)

    try {
      // Normalizing here is what turns the raw models text into a list, and
      // also trims the other fields before they are stored.
      await ctx.updatePluginParameters(normalizeParameters(values))
      ctx.notice('Settings saved successfully!')
    } catch (error) {
      ctx.alert(
        error instanceof Error ? error.message : 'Could not save the settings.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Canvas ctx={ctx}>
      <PluginHeader />

      <Form
        onSubmit={(event) => {
          event?.preventDefault()
          handleSubmit()
        }}
      >
        <FieldGroup>
          <TextField
            id='previewBaseUrl'
            name='previewBaseUrl'
            label='Live preview base URL'
            hint='Front-end that renders the “Live preview” sidebar. Leave empty to hide the preview.'
            placeholder='https://example.com'
            value={values.previewBaseUrl}
            onChange={setValue('previewBaseUrl')}
            error={baseUrlError}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='previewModelApiKeys'
            name='previewModelApiKeys'
            label='Live preview models'
            hint='Comma-separated model API keys to offer the preview on. Leave empty for every model.'
            placeholder='landing_page, blog_post'
            value={values.previewModelApiKeys}
            onChange={setValue('previewModelApiKeys')}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='demoLandingPageModelId'
            name='demoLandingPageModelId'
            label='Demo landing page model ID'
            hint='Publishing is limited to one control and one variant page for this model.'
            placeholder={DEFAULT_PARAMETERS.demoLandingPageModelId}
            value={values.demoLandingPageModelId}
            onChange={setValue('demoLandingPageModelId')}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='formTemplateModelId'
            name='formTemplateModelId'
            label='Form template model ID'
            hint='Model that gets the form fields validation addon.'
            placeholder={DEFAULT_PARAMETERS.formTemplateModelId}
            value={values.formTemplateModelId}
            onChange={setValue('formTemplateModelId')}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='formFieldsBlockApiKey'
            name='formFieldsBlockApiKey'
            label='Form fields field API key'
            hint='Field on the model above that the validation addon attaches to.'
            placeholder={DEFAULT_PARAMETERS.formFieldsBlockApiKey}
            value={values.formFieldsBlockApiKey}
            onChange={setValue('formFieldsBlockApiKey')}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='searchReplaceAllowedRoleIds'
            name='searchReplaceAllowedRoleIds'
            label='Search & Replace roles'
            hint='Comma-separated role IDs allowed to use Search & Replace. Leave empty for every role. Anyone who can edit the schema keeps access either way, so the admins who own this setting cannot be locked out. This hides the tool — it does not restrict the API, which is what DatoCMS role permissions are for.'
            placeholder='Every role'
            value={values.searchReplaceAllowedRoleIds}
            onChange={setValue('searchReplaceAllowedRoleIds')}
            textInputProps={{ disabled: !canEdit }}
          />

          <SwitchField
            id='enforceDemoLandingPageLimit'
            name='enforceDemoLandingPageLimit'
            label='Block publishing when the demo landing page limit is exceeded'
            hint='Off: editors are only warned. On: publishing is refused. The plugin always lets the record through if the limit cannot be verified.'
            value={values.enforceDemoLandingPageLimit}
            onChange={setValue('enforceDemoLandingPageLimit')}
            // SwitchInputProps is not partial, so name/value must be repeated.
            switchInputProps={{
              name: 'enforceDemoLandingPageLimit',
              value: values.enforceDemoLandingPageLimit,
              disabled: !canEdit
            }}
          />
          <SwitchField
            id='maintenanceEnabled'
            name='maintenanceEnabled'
            label='Enable maintenance banner'
            hint='While enabled, editors in the primary environment see a notice until they dismiss it. Turn it off manually once maintenance is over.'
            value={values.maintenanceEnabled}
            onChange={setValue('maintenanceEnabled')}
            // SwitchInputProps is not partial, so name/value must be repeated.
            switchInputProps={{
              name: 'maintenanceEnabled',
              value: values.maintenanceEnabled,
              disabled: !canEdit
            }}
          />

          <TextField
            id='linkTypeFieldApiKey'
            name='linkTypeFieldApiKey'
            label='Link type field'
            hint='On link blocks, the field saying whether a link is internal or external. Search & Replace sets it when a link that pointed at a page has to become an external URL.'
            placeholder={DEFAULT_PARAMETERS.linkTypeFieldApiKey}
            value={values.linkTypeFieldApiKey}
            onChange={setValue('linkTypeFieldApiKey')}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='linkExternalTypeValue'
            name='linkExternalTypeValue'
            label='Link type value for external links'
            placeholder={DEFAULT_PARAMETERS.linkExternalTypeValue}
            value={values.linkExternalTypeValue}
            onChange={setValue('linkExternalTypeValue')}
            textInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='linkExternalUrlFieldApiKey'
            name='linkExternalUrlFieldApiKey'
            label='External URL field'
            hint='The field on those blocks that holds the URL.'
            placeholder={DEFAULT_PARAMETERS.linkExternalUrlFieldApiKey}
            value={values.linkExternalUrlFieldApiKey}
            onChange={setValue('linkExternalUrlFieldApiKey')}
            textInputProps={{ disabled: !canEdit }}
          />

          <SwitchField
            id='maintenanceShowInSandbox'
            name='maintenanceShowInSandbox'
            label='Also show the notice in sandbox environments'
            hint='Off: only the primary environment sees it, so a window announced for production does not reach people working in a fork. On: turn this on in a sandbox to rehearse the notice before announcing it for real.'
            value={values.maintenanceShowInSandbox}
            onChange={setValue('maintenanceShowInSandbox')}
            // SwitchInputProps is not partial, so name/value must be repeated.
            switchInputProps={{
              name: 'maintenanceShowInSandbox',
              value: values.maintenanceShowInSandbox,
              disabled: !canEdit
            }}
          />

          <TextField
            id='maintenanceStartsAt'
            name='maintenanceStartsAt'
            label='Maintenance starts (Madrid time)'
            hint='Spanish time (CET/CEST). Every editor is shown this same time, labelled, whichever timezone they are in.'
            value={toDateTimeInput(values.maintenanceStartsAt)}
            onChange={(value) =>
              setValue('maintenanceStartsAt')(fromDateTimeInput(value))
            }
            error={maintenanceStartError}
            textInputProps={{ type: DATETIME_LOCAL_TYPE, disabled: !canEdit }}
          />

          <TextareaField
            id='maintenanceMessage'
            name='maintenanceMessage'
            label='Maintenance message'
            hint='The start time is inserted where you put {startsAt}, or appended at the end if you leave it out. Blank lines start a new paragraph.'
            value={values.maintenanceMessage}
            onChange={setValue('maintenanceMessage')}
            error={maintenanceMessageError}
            textareaInputProps={{ disabled: !canEdit, rows: 12 }}
          />

          {canEdit &&
            values.maintenanceMessage !== DEFAULT_MAINTENANCE_MESSAGE && (
              <Button
                type='button'
                buttonSize='xs'
                onClick={() =>
                  setValue('maintenanceMessage')(DEFAULT_MAINTENANCE_MESSAGE)
                }
              >
                Restore default message
              </Button>
            )}
        </FieldGroup>

        {canEdit ? (
          <Button
            type='submit'
            buttonType='primary'
            buttonSize='l'
            fullWidth
            disabled={saving || Boolean(baseUrlError ?? maintenanceError)}
          >
            {saving ? 'Saving...' : 'Save settings'}
          </Button>
        ) : (
          <p>You need schema edit permissions to change these settings.</p>
        )}
      </Form>
    </Canvas>
  )
}

export default ConfigScreen
