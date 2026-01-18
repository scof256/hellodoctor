/**
 * Form Validation Hook
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.6
 * 
 * Provides form validation with:
 * - Real-time validation on blur
 * - Auto-formatting (phone numbers, names)
 * - Clear error messages with icons
 * - Field-level and form-level validation
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  validateAndFormat,
  validatePhone,
  validateEmail,
  validateRequired,
  validateFutureDate,
  validateFileSize,
  validateFileType,
  formatPhone,
  formatName,
  type ValidationResult,
  type FormattedError,
} from '@/app/lib/error-handler';

// ============================================================================
// TYPES
// ============================================================================

export type FieldType = 'phone' | 'email' | 'name' | 'required' | 'date' | 'text';

export interface FieldConfig {
  type: FieldType;
  required?: boolean;
  label?: string;
  validate?: (value: string) => ValidationResult;
  format?: (value: string) => string;
}

export interface FormConfig {
  [fieldName: string]: FieldConfig;
}

export interface FieldState {
  value: string;
  error?: FormattedError;
  touched: boolean;
  dirty: boolean;
}

export interface FormState {
  [fieldName: string]: FieldState;
}

// ============================================================================
// FORM VALIDATION HOOK
// ============================================================================

/**
 * Hook for managing form validation
 * Requirements: 19.1, 19.2, 19.3, 19.4
 * 
 * @example
 * const { fields, handleChange, handleBlur, isValid, errors } = useFormValidation({
 *   phone: { type: 'phone', required: true, label: 'Phone Number' },
 *   email: { type: 'email', required: true, label: 'Email' },
 *   name: { type: 'name', required: true, label: 'Full Name' },
 * });
 */
export function useFormValidation(config: FormConfig, initialValues: Record<string, string> = {}) {
  // Initialize form state
  const [formState, setFormState] = useState<FormState>(() => {
    const state: FormState = {};
    Object.keys(config).forEach((fieldName) => {
      state[fieldName] = {
        value: initialValues[fieldName] || '',
        touched: false,
        dirty: false,
      };
    });
    return state;
  });

  // Track if form has been submitted
  const [submitted, setSubmitted] = useState(false);

  /**
   * Validate a single field
   * Requirements: 19.1 - Real-time validation on blur
   */
  const validateField = useCallback(
    (fieldName: string, value: string): ValidationResult => {
      const fieldConfig = config[fieldName];
      if (!fieldConfig) return { valid: true };

      // Use custom validator if provided
      if (fieldConfig.validate) {
        return fieldConfig.validate(value);
      }

      // Check required
      if (fieldConfig.required) {
        const requiredResult = validateRequired(value, fieldConfig.label);
        if (!requiredResult.valid) return requiredResult;
      }

      // Type-specific validation
      switch (fieldConfig.type) {
        case 'phone':
          return validatePhone(value);
        case 'email':
          return validateEmail(value);
        case 'date':
          try {
            const date = new Date(value);
            return validateFutureDate(date);
          } catch {
            return {
              valid: false,
              error: {
                title: 'Invalid Date',
                message: 'Please enter a valid date 📅',
                icon: '📅',
                severity: 'error',
              },
            };
          }
        case 'name':
        case 'required':
          return validateRequired(value, fieldConfig.label);
        default:
          return { valid: true };
      }
    },
    [config]
  );

  /**
   * Format a field value
   * Requirements: 19.4 - Auto-formatting (phone numbers, names)
   */
  const formatField = useCallback(
    (fieldName: string, value: string): string => {
      const fieldConfig = config[fieldName];
      if (!fieldConfig) return value;

      // Use custom formatter if provided
      if (fieldConfig.format) {
        return fieldConfig.format(value);
      }

      // Type-specific formatting
      switch (fieldConfig.type) {
        case 'phone':
          return formatPhone(value);
        case 'name':
          return formatName(value);
        case 'email':
          return value.trim().toLowerCase();
        default:
          return value;
      }
    },
    [config]
  );

  /**
   * Handle field change
   * Requirements: 19.4 - Auto-formatting as user types
   */
  const handleChange = useCallback(
    (fieldName: string, value: string) => {
      setFormState((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          value,
          dirty: true,
          // Clear error on change if field was previously touched
          error: prev[fieldName]?.touched ? undefined : prev[fieldName]?.error,
        },
      }));
    },
    []
  );

  /**
   * Handle field blur
   * Requirements: 19.1 - Real-time validation on blur
   */
  const handleBlur = useCallback(
    (fieldName: string) => {
      setFormState((prev) => {
        const currentValue = prev[fieldName]?.value || '';
        
        // Format the value
        const formattedValue = formatField(fieldName, currentValue);
        
        // Validate the formatted value
        const validationResult = validateField(fieldName, formattedValue);

        return {
          ...prev,
          [fieldName]: {
            ...prev[fieldName],
            value: formattedValue,
            touched: true,
            error: validationResult.valid ? undefined : validationResult.error,
          },
        };
      });
    },
    [formatField, validateField]
  );

  /**
   * Set field value programmatically
   */
  const setFieldValue = useCallback(
    (fieldName: string, value: string, shouldValidate = false) => {
      const formattedValue = formatField(fieldName, value);
      const validationResult = shouldValidate
        ? validateField(fieldName, formattedValue)
        : { valid: true };

      setFormState((prev) => ({
        ...prev,
        [fieldName]: {
          ...prev[fieldName],
          value: formattedValue,
          dirty: true,
          error: validationResult.valid ? undefined : validationResult.error,
        },
      }));
    },
    [formatField, validateField]
  );

  /**
   * Set field error programmatically
   */
  const setFieldError = useCallback((fieldName: string, error?: FormattedError) => {
    setFormState((prev) => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        error,
        touched: true,
      },
    }));
  }, []);

  /**
   * Validate all fields
   * Requirements: 19.2 - Disable submit until all fields valid
   */
  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newState = { ...formState };

    Object.keys(config).forEach((fieldName) => {
      const value = formState[fieldName]?.value || '';
      const formattedValue = formatField(fieldName, value);
      const validationResult = validateField(fieldName, formattedValue);

      newState[fieldName] = {
        ...newState[fieldName],
        value: formattedValue,
        touched: true,
        error: validationResult.valid ? undefined : validationResult.error,
      };

      if (!validationResult.valid) {
        isValid = false;
      }
    });

    setFormState(newState);
    return isValid;
  }, [config, formState, formatField, validateField]);

  /**
   * Handle form submission
   * Requirements: 19.2 - Disable submit until all fields valid
   */
  const handleSubmit = useCallback(
    (onSubmit: (values: Record<string, string>) => void | Promise<void>) => {
      return async (e?: React.FormEvent) => {
        if (e) {
          e.preventDefault();
        }

        setSubmitted(true);

        // Validate all fields
        const isValid = validateAll();

        if (isValid) {
          // Extract values
          const values: Record<string, string> = {};
          Object.keys(formState).forEach((fieldName) => {
            values[fieldName] = formState[fieldName]?.value || '';
          });

          // Call submit handler
          await onSubmit(values);
        }
      };
    },
    [formState, validateAll]
  );

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    const state: FormState = {};
    Object.keys(config).forEach((fieldName) => {
      state[fieldName] = {
        value: initialValues[fieldName] || '',
        touched: false,
        dirty: false,
      };
    });
    setFormState(state);
    setSubmitted(false);
  }, [config, initialValues]);

  /**
   * Check if form is valid
   */
  const isValid = useCallback((): boolean => {
    return Object.keys(config).every((fieldName) => {
      const fieldState = formState[fieldName];
      if (!fieldState) return false;

      // Validate the current value
      const validationResult = validateField(fieldName, fieldState.value);
      return validationResult.valid;
    });
  }, [config, formState, validateField]);

  /**
   * Get all errors
   */
  const errors = useCallback((): Record<string, FormattedError | undefined> => {
    const allErrors: Record<string, FormattedError | undefined> = {};
    Object.keys(config).forEach((fieldName) => {
      allErrors[fieldName] = formState[fieldName]?.error;
    });
    return allErrors;
  }, [config, formState]);

  /**
   * Get field props for easy integration with inputs
   */
  const getFieldProps = useCallback(
    (fieldName: string) => {
      const fieldState = formState[fieldName] || {
        value: '',
        touched: false,
        dirty: false,
      };

      return {
        value: fieldState.value,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          handleChange(fieldName, e.target.value),
        onBlur: () => handleBlur(fieldName),
        error: fieldState.error,
        'aria-invalid': !!fieldState.error,
        'aria-describedby': fieldState.error ? `${fieldName}-error` : undefined,
      };
    },
    [formState, handleChange, handleBlur]
  );

  return {
    // Field state
    fields: formState,
    
    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setFieldError,
    
    // Validation
    validateField,
    validateAll,
    isValid: isValid(),
    errors: errors(),
    
    // Utilities
    reset,
    getFieldProps,
    
    // Status
    submitted,
  };
}

// ============================================================================
// FILE VALIDATION HOOK
// ============================================================================

export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  onError?: (error: FormattedError) => void;
}

/**
 * Hook for validating file uploads
 * Requirements: 19.6 - File validation
 * 
 * @example
 * const { validateFile, error } = useFileValidation({
 *   maxSizeMB: 8,
 *   allowedTypes: ['image/jpeg', 'image/png'],
 * });
 */
export function useFileValidation(options: FileValidationOptions = {}) {
  const [error, setError] = useState<FormattedError | undefined>();

  const validateFile = useCallback(
    (file: File): boolean => {
      // Validate size
      const sizeResult = validateFileSize(file, options.maxSizeMB);
      if (!sizeResult.valid) {
        setError(sizeResult.error);
        if (options.onError) options.onError(sizeResult.error!);
        return false;
      }

      // Validate type
      if (options.allowedTypes) {
        const typeResult = validateFileType(file, options.allowedTypes);
        if (!typeResult.valid) {
          setError(typeResult.error);
          if (options.onError) options.onError(typeResult.error!);
          return false;
        }
      }

      setError(undefined);
      return true;
    },
    [options]
  );

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    validateFile,
    error,
    clearError,
  };
}
