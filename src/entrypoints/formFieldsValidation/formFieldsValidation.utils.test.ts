import { describe, expect, it } from 'vitest'
import {
  REQUIRED_FIELD_TYPES_OBJECT,
  checkDuplicateFieldTypes,
  checkFormFieldsValidation
} from './formFieldsValidation.utils'

const allRequiredTypes = Object.keys(REQUIRED_FIELD_TYPES_OBJECT)

describe(checkDuplicateFieldTypes, () => {
  it('reports no duplicates for unique types', () => {
    expect(
      checkDuplicateFieldTypes(['contact_email', 'consent'])
    ).toStrictEqual({
      hasDuplicates: false,
      duplicatedTypes: []
    })
  })

  it('reports each repeated type once', () => {
    expect(
      checkDuplicateFieldTypes([
        'contact_email',
        'contact_email',
        'contact_email',
        'consent'
      ])
    ).toStrictEqual({ hasDuplicates: true, duplicatedTypes: ['contact_email'] })
  })

  it('allows several consent fields', () => {
    expect(
      checkDuplicateFieldTypes(['consent', 'consent', 'contact_email'])
    ).toStrictEqual({ hasDuplicates: false, duplicatedTypes: [] })
  })
})

describe(checkFormFieldsValidation, () => {
  it('passes when every required type is present exactly once', () => {
    expect(checkFormFieldsValidation(allRequiredTypes)).toStrictEqual({
      isValid: true,
      validationErrors: []
    })
  })

  it('lists all required fields when the form is empty', () => {
    const { isValid, validationErrors } = checkFormFieldsValidation([])

    expect(isValid).toBeFalsy()
    expect(validationErrors).toHaveLength(1)
    expect(validationErrors[0]).toContain('Include missing required fields')
  })

  it('reports missing and duplicated fields together', () => {
    const { isValid, validationErrors } = checkFormFieldsValidation([
      'contact_email',
      'contact_email'
    ])

    expect(isValid).toBeFalsy()
    expect(validationErrors).toHaveLength(2)
    expect(validationErrors[0]).toContain(
      'Remove duplicated fields - contact_email'
    )
    expect(validationErrors[1]).toContain('Include required fields')
  })
})
