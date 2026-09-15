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

// Native <input type="date"> / <input type="time"> always report values in
// "YYYY-MM-DD" / "HH:mm" regardless of locale, so this round-trips cleanly
// with the "YYYY-MM-DDTHH:mm:00.000Z" (UTC) strings stored in plugin params.
const splitIsoDateTime = (iso: string): { date: string; time: string } => {
  if (!iso) {
    return { date: '', time: '' }
  }

  const [date, time] = iso.replace(/Z$/, '').split('T')

  return { date: date ?? '', time: (time ?? '').slice(0, 5) }
}

const combineToIso = (date: string, time: string): string =>
  date && time ? `${date}T${time}:00.000Z` : ''

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

  const maintenanceStart = splitIsoDateTime(values.maintenanceStartsAt)

  // Only blocks saving when the banner is switched on: an incomplete window
  // left behind after it is switched off is harmless.
  const maintenanceError =
    values.maintenanceEnabled &&
    !(values.maintenanceMessage && values.maintenanceStartsAt)
      ? 'Add a message and a start date/time, or turn the banner off.'
      : undefined

  const setMaintenanceStart = (part: 'date' | 'time') => (value: string) =>
    setValues((current) => {
      const { date, time } = splitIsoDateTime(current.maintenanceStartsAt)

      return {
        ...current,
        maintenanceStartsAt:
          part === 'date'
            ? combineToIso(value, time)
            : combineToIso(date, value)
      }
    })

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

          <TextareaField
            id='maintenanceMessage'
            name='maintenanceMessage'
            label='Maintenance message'
            hint='The start time is inserted automatically — appended at the end, or in place of {startsAt} if you include it in the text.'
            value={values.maintenanceMessage}
            onChange={setValue('maintenanceMessage')}
            error={maintenanceError}
            textareaInputProps={{ disabled: !canEdit }}
          />

          <TextField
            id='maintenanceStartDate'
            name='maintenanceStartDate'
            label='Maintenance starts — date (UTC)'
            value={maintenanceStart.date}
            onChange={setMaintenanceStart('date')}
            textInputProps={{ type: 'date', disabled: !canEdit }}
          />

          <TextField
            id='maintenanceStartTime'
            name='maintenanceStartTime'
            label='Maintenance starts — time (UTC)'
            value={maintenanceStart.time}
            onChange={setMaintenanceStart('time')}
            textInputProps={{ type: 'time', disabled: !canEdit }}
          />
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
