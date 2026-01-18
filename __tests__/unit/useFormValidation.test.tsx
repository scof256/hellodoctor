/**
 * Unit Tests for Form Validation Hook
 * Requirements: 19.1, 19.2, 19.4
 * 
 * Tests:
 * - Real-time validation on blur
 * - Auto-formatting
 * - Form submission validation
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFormValidation, useFileValidation } from '@/app/hooks/useFormValidation';

// ============================================================================
// FORM VALIDATION HOOK TESTS
// ============================================================================

describe('useFormValidation', () => {
  describe('Initialization', () => {
    it('should initialize with empty values', () => {
      // Requirements: 19.1 - Form initialization
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
          email: { type: 'email', required: true },
        })
      );

      expect(result.current.fields.name.value).toBe('');
      expect(result.current.fields.email.value).toBe('');
      expect(result.current.isValid).toBe(false);
    });

    it('should initialize with provided values', () => {
      const { result } = renderHook(() =>
        useFormValidation(
          {
            name: { type: 'name', required: true },
            email: { type: 'email', required: true },
          },
          {
            name: 'John Doe',
            email: 'john@example.com',
          }
        )
      );

      expect(result.current.fields.name.value).toBe('John Doe');
      expect(result.current.fields.email.value).toBe('john@example.com');
    });
  });

  describe('Field Changes', () => {
    it('should update field value on change', () => {
      // Requirements: 19.1 - Handle field changes
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
        })
      );

      act(() => {
        result.current.handleChange('name', 'John');
      });

      expect(result.current.fields.name.value).toBe('John');
      expect(result.current.fields.name.dirty).toBe(true);
    });

    it('should clear error on change after touch', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          email: { type: 'email', required: true },
        })
      );

      // Blur with invalid value to set error
      act(() => {
        result.current.handleChange('email', 'invalid');
        result.current.handleBlur('email');
      });

      expect(result.current.fields.email.error).toBeDefined();

      // Change should clear error
      act(() => {
        result.current.handleChange('email', 'valid@example.com');
      });

      expect(result.current.fields.email.error).toBeUndefined();
    });
  });

  describe('Field Blur and Validation', () => {
    it('should validate and format on blur', () => {
      // Requirements: 19.1, 19.4 - Validation on blur, auto-formatting
      const { result } = renderHook(() =>
        useFormValidation({
          phone: { type: 'phone', required: true },
        })
      );

      act(() => {
        result.current.handleChange('phone', '0712345678');
        result.current.handleBlur('phone');
      });

      expect(result.current.fields.phone.value).toBe('0712 345 678');
      expect(result.current.fields.phone.touched).toBe(true);
      expect(result.current.fields.phone.error).toBeUndefined();
    });

    it('should show error on blur with invalid value', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          email: { type: 'email', required: true },
        })
      );

      act(() => {
        result.current.handleChange('email', 'invalid');
        result.current.handleBlur('email');
      });

      expect(result.current.fields.email.error).toBeDefined();
      expect(result.current.fields.email.error?.message).toContain('email');
    });

    it('should format name on blur', () => {
      // Requirements: 19.4 - Auto-formatting names
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
        })
      );

      act(() => {
        result.current.handleChange('name', 'john doe');
        result.current.handleBlur('name');
      });

      expect(result.current.fields.name.value).toBe('John Doe');
    });
  });

  describe('Form Validation', () => {
    it('should validate all fields', () => {
      // Requirements: 19.2 - Form-level validation
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
          email: { type: 'email', required: true },
          phone: { type: 'phone', required: true },
        })
      );

      // Initially invalid (all empty)
      expect(result.current.isValid).toBe(false);

      // Fill in valid values
      act(() => {
        result.current.setFieldValue('name', 'John Doe', true);
        result.current.setFieldValue('email', 'john@example.com', true);
        result.current.setFieldValue('phone', '0712345678', true);
      });

      expect(result.current.isValid).toBe(true);
    });

    it('should mark all fields as touched on validateAll', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
          email: { type: 'email', required: true },
        })
      );

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.fields.name.touched).toBe(true);
      expect(result.current.fields.email.touched).toBe(true);
    });

    it('should return false from validateAll if any field invalid', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
          email: { type: 'email', required: true },
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'John Doe');
        // email is empty, so validation should fail
      });

      let isValid: boolean = false;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('should validate before submitting', async () => {
      // Requirements: 19.2 - Disable submit until valid
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
        })
      );

      const submitHandler = result.current.handleSubmit(onSubmit);

      // Submit with empty form
      await act(async () => {
        await submitHandler();
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.fields.name.error).toBeDefined();
    });

    it('should call onSubmit with values when valid', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
          email: { type: 'email', required: true },
        })
      );

      act(() => {
        result.current.setFieldValue('name', 'John Doe');
        result.current.setFieldValue('email', 'john@example.com');
      });

      const submitHandler = result.current.handleSubmit(onSubmit);

      await act(async () => {
        await submitHandler();
      });

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
      });
    });

    it('should mark form as submitted', async () => {
      const onSubmit = vi.fn();
      const { result } = renderHook(() =>
        useFormValidation({
          name: { type: 'name', required: true },
        })
      );

      const submitHandler = result.current.handleSubmit(onSubmit);

      await act(async () => {
        await submitHandler();
      });

      expect(result.current.submitted).toBe(true);
    });
  });

  describe('Field Props Helper', () => {
    it('should return field props for input binding', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          email: { type: 'email', required: true },
        })
      );

      const props = result.current.getFieldProps('email');

      expect(props).toHaveProperty('value');
      expect(props).toHaveProperty('onChange');
      expect(props).toHaveProperty('onBlur');
      expect(props).toHaveProperty('error');
    });

    it('should handle onChange event', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          email: { type: 'email', required: true },
        })
      );

      const props = result.current.getFieldProps('email');

      act(() => {
        props.onChange({
          target: { value: 'test@example.com' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.fields.email.value).toBe('test@example.com');
    });

    it('should set aria attributes when error present', () => {
      const { result } = renderHook(() =>
        useFormValidation({
          email: { type: 'email', required: true },
        })
      );

      act(() => {
        result.current.setFieldError('email', {
          title: 'Error',
          message: 'Invalid',
          severity: 'error',
        });
      });

      const props = result.current.getFieldProps('email');

      expect(props['aria-invalid']).toBe(true);
      expect(props['aria-describedby']).toBe('email-error');
    });
  });

  describe('Custom Validators', () => {
    it('should use custom validator when provided', () => {
      const customValidator = vi.fn().mockReturnValue({
        valid: false,
        error: {
          title: 'Custom Error',
          message: 'Custom validation failed',
          severity: 'error' as const,
        },
      });

      const { result } = renderHook(() =>
        useFormValidation({
          custom: {
            type: 'text',
            required: true,
            validate: customValidator,
          },
        })
      );

      act(() => {
        result.current.handleChange('custom', 'test');
        result.current.handleBlur('custom');
      });

      expect(customValidator).toHaveBeenCalledWith('test');
      expect(result.current.fields.custom.error?.message).toBe('Custom validation failed');
    });
  });

  describe('Reset', () => {
    it('should reset form to initial values', () => {
      const { result } = renderHook(() =>
        useFormValidation(
          {
            name: { type: 'name', required: true },
          },
          { name: 'Initial' }
        )
      );

      act(() => {
        result.current.setFieldValue('name', 'Changed');
        result.current.handleBlur('name');
      });

      expect(result.current.fields.name.value).toBe('Changed');
      expect(result.current.fields.name.touched).toBe(true);

      act(() => {
        result.current.reset();
      });

      expect(result.current.fields.name.value).toBe('Initial');
      expect(result.current.fields.name.touched).toBe(false);
      expect(result.current.submitted).toBe(false);
    });
  });
});

// ============================================================================
// FILE VALIDATION HOOK TESTS
// ============================================================================

describe('useFileValidation', () => {
  it('should validate file size', () => {
    // Requirements: 19.6 - File validation
    const { result } = renderHook(() =>
      useFileValidation({ maxSizeMB: 1 })
    );

    const smallFile = new File(['a'.repeat(500 * 1024)], 'small.jpg', {
      type: 'image/jpeg',
    });

    let isValid: boolean = false;
    act(() => {
      isValid = result.current.validateFile(smallFile);
    });

    expect(isValid).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('should reject files exceeding size limit', () => {
    const { result } = renderHook(() =>
      useFileValidation({ maxSizeMB: 1 })
    );

    const largeFile = new File(['a'.repeat(2 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    let isValid: boolean = false;
    act(() => {
      isValid = result.current.validateFile(largeFile);
    });

    expect(isValid).toBe(false);
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('too big');
  });

  it('should validate file type', () => {
    const { result } = renderHook(() =>
      useFileValidation({
        allowedTypes: ['image/jpeg', 'image/png'],
      })
    );

    const validFile = new File([''], 'test.jpg', { type: 'image/jpeg' });

    let isValid: boolean = false;
    act(() => {
      isValid = result.current.validateFile(validFile);
    });

    expect(isValid).toBe(true);
  });

  it('should reject invalid file types', () => {
    const { result } = renderHook(() =>
      useFileValidation({
        allowedTypes: ['image/jpeg', 'image/png'],
      })
    );

    const invalidFile = new File([''], 'test.pdf', { type: 'application/pdf' });

    let isValid: boolean = false;
    act(() => {
      isValid = result.current.validateFile(invalidFile);
    });

    expect(isValid).toBe(false);
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('photo');
  });

  it('should call onError callback when validation fails', () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useFileValidation({
        maxSizeMB: 1,
        onError,
      })
    );

    const largeFile = new File(['a'.repeat(2 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    act(() => {
      result.current.validateFile(largeFile);
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('too big'),
      })
    );
  });

  it('should clear error', () => {
    const { result } = renderHook(() =>
      useFileValidation({ maxSizeMB: 1 })
    );

    const largeFile = new File(['a'.repeat(2 * 1024 * 1024)], 'large.jpg', {
      type: 'image/jpeg',
    });

    act(() => {
      result.current.validateFile(largeFile);
    });

    expect(result.current.error).toBeDefined();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeUndefined();
  });
});
