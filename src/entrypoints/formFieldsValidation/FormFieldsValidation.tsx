import { useMemo } from 'react'
import type { RenderFieldExtensionCtx } from 'datocms-plugin-sdk'
import { Canvas } from 'datocms-react-ui'
import get from 'lodash-es/get'
import { checkFormFieldsValidation } from './formFieldsValidation.utils'

type Props = {
  ctx: RenderFieldExtensionCtx
}

const validationStyles = {
  container: {
    padding: '12px',
    borderRadius: '4px',
    marginTop: '8px',
    fontSize: '14px',
    lineHeight: '1.5'
  },
  success: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    color: '#155724'
  },
  error: {
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    color: '#721c24'
  },
  warning: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    color: '#856404'
  }
}

const renderErrorWithBold = (error: string) => {
  const parts = error.split(/(duplicated fields|required fields)/i)
  return parts.map((part, index) => {
    const lowerPart = part.toLowerCase()
    if (lowerPart === 'duplicated fields' || lowerPart === 'required fields') {
      return <strong key={index}>{part}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

export const FormFieldsValidation = ({ ctx }: Props) => {
  const currentFieldTypes = useMemo(() => {
    const formFieldsContent = get(ctx.formValues, ctx.fieldPath) as any[]
    const fieldTypeObjects = formFieldsContent.filter(
      (field: any) => field.field_type && field.field_type !== 'divider'
    )
    return fieldTypeObjects.map((field: any) => field.field_type)
  }, [ctx.formValues, ctx.fieldPath])

  // Validation is synchronous, so it is derived during render rather than
  // pushed into state from an effect.
  const validationState = useMemo(
    () => checkFormFieldsValidation(currentFieldTypes),
    [currentFieldTypes]
  )

  return (
    <Canvas ctx={ctx}>
      {validationState.isValid ? (
        <div
          style={{ ...validationStyles.container, ...validationStyles.success }}
        >
          ✅ This form is valid
        </div>
      ) : (
        <>
          <div
            style={{
              ...validationStyles.container,
              color: '#6c757d',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '8px 12px 0 0'
            }}
          >
            Please fix this before saving:
          </div>
          {validationState.validationErrors.map((error, index) => (
            <div
              key={index}
              style={{
                ...validationStyles.container,
                ...validationStyles.error
              }}
            >
              <div>
                <span style={{ marginRight: '8px' }}>❌</span>{' '}
                {renderErrorWithBold(error)}
              </div>
            </div>
          ))}
        </>
      )}
    </Canvas>
  )
}
