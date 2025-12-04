/**
 * Required field types that must be present in the form
 * Add or remove field types from this array to configure validation
 */
export const REQUIRED_FIELD_TYPES_OBJECT = {
  "contact_email": "Email",
  "contact_first_name": "First Name",
  "contact_last_name": "Last Name",
  "company_phone": "Phone",
  "company_name": "Company Name",
  "company_form_number_of_employees": "Number of Employees",
  "contact_jobtitle": "Job Title",
  "consent": "Consent Text",
};

/**
 * Checks form_fields validation and returns the result
 * Returns validation state without showing alerts
 */
export const checkFormFieldsValidation = async (
  formFieldTypes: string[]
): Promise<{ isValid: boolean; validationErrors: string[] }> => {
  try {
    const validationErrors: string[] = [];

    const duplicateCheck = checkDuplicateFieldTypes(formFieldTypes);
    if (duplicateCheck.hasDuplicates) {
      validationErrors.push(`Remove duplicated fields - ${duplicateCheck.duplicatedTypes.join(", ")}`);
    }

    if (formFieldTypes.length === 0) {
      validationErrors.push(
        `Include missing required fields - ${Object.values(REQUIRED_FIELD_TYPES_OBJECT).join(", ")}`
      );
    } else {
      const missingFields = Object.keys(REQUIRED_FIELD_TYPES_OBJECT).filter(
        (requiredType) => !formFieldTypes.includes(requiredType)
      );

      if (missingFields.length > 0) {
        validationErrors.push(`Include required fields - ${missingFields.map((field) => REQUIRED_FIELD_TYPES_OBJECT[field as keyof typeof REQUIRED_FIELD_TYPES_OBJECT]).join(", ")}`);
      }
    }

    return {
      isValid: validationErrors.length === 0,
      validationErrors,
    };
  } catch (error) {
    return {
      isValid: false,
      validationErrors: ["Error validating fields. Please verify manually."],
    };
  }
};

/**
 * Checks if there are duplicate field types in the form
 * Returns an object with hasDuplicates flag and the list of duplicated types
 */
export const checkDuplicateFieldTypes = (
  formFieldTypes: string[]
): { hasDuplicates: boolean; duplicatedTypes: string[] } => {
  const typeCount: Record<string, number> = {};
  const duplicatedTypes: string[] = [];

  formFieldTypes.forEach((type) => {
    typeCount[type] = (typeCount[type] || 0) + 1;
  });

  Object.keys(typeCount).forEach((type) => {
    if (typeCount[type] >= 2) {
      duplicatedTypes.push(type);
    }
  });

  return {
    hasDuplicates: duplicatedTypes.length > 0,
    duplicatedTypes,
  };
};

