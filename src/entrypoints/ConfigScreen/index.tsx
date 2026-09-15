import { useState } from 'react'
import type { RenderConfigScreenCtx } from 'datocms-plugin-sdk'
import {
  Button,
  Canvas,
  FieldGroup,
  Form,
  SwitchField,
  TextField
} from 'datocms-react-ui'
import PluginHeader from './PluginHeader'
import type { PluginParameters } from '../../lib/pluginParameters'
import { DEFAULT_PARAMETERS, readParameters } from '../../lib/pluginParameters'

type Props = {
  ctx: RenderConfigScreenCtx
}

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

const ConfigScreen = ({ ctx }: Props) => {
  const [values, setValues] = useState<PluginParameters>(() =>
    readParameters(ctx)
  )
  const [saving, setSaving] = useState(false)

  const canEdit = ctx.currentRole.meta.final_permissions.can_edit_schema
  const baseUrlError = isValidBaseUrl(values.previewBaseUrl)
    ? undefined
    : 'Enter a full URL, e.g. https://example.com'

  const setValue =
    <K extends keyof PluginParameters>(key: K) =>
    (value: PluginParameters[K]) =>
      setValues((current) => ({ ...current, [key]: value }))

  const handleSubmit = async () => {
    setSaving(true)

    try {
      await ctx.updatePluginParameters(values)
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
            value={values.previewModelApiKeys.join(', ')}
            onChange={(value) =>
              setValues((current) => ({
                ...current,
                previewModelApiKeys: value
                  .split(',')
                  .map((part) => part.trim())
                  .filter((part) => part !== '')
              }))
            }
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
            value={values.searchReplaceAllowedRoleIds.join(', ')}
            onChange={(value) =>
              setValues((current) => ({
                ...current,
                searchReplaceAllowedRoleIds: value
                  .split(',')
                  .map((part) => part.trim())
                  .filter((part) => part !== '')
              }))
            }
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
        </FieldGroup>

        {canEdit ? (
          <Button
            type='submit'
            buttonType='primary'
            buttonSize='l'
            fullWidth
            disabled={saving || Boolean(baseUrlError)}
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
