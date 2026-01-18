/**
 * Unit Tests for Error Handler
 * Requirements: 10.4, 19.1, 19.2, 19.3
 * 
 * Tests:
 * - Retry logic with exponential backoff
 * - Error message formatting
 * - Form validation utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRetryDelay,
  retryWithBackoff,
  formatError,
  isRetryableError,
  isNetworkError,
  validatePhone,
  validateEmail,
  validateRequired,
  validateFutureDate,
  validateFileSize,
  validateFileType,
  formatPhone,
  formatName,
  validateAndFormat,
} from '@/app/lib/error-handler';

// ============================================================================
// RETRY LOGIC TESTS
// ============================================================================

describe('Retry Logic', () => {
  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      // Requirements: 10.4 - Exponential backoff
      expect(calculateRetryDelay(0)).toBeGreaterThanOrEqual(900); // ~1000ms with jitter
      expect(calculateRetryDelay(0)).toBeLessThanOrEqual(1100);
      
      expect(calculateRetryDelay(1)).toBeGreaterThanOrEqual(1800); // ~2000ms with jitter
      expect(calculateRetryDelay(1)).toBeLessThanOrEqual(2200);
      
      expect(calculateRetryDelay(2)).toBeGreaterThanOrEqual(3600); // ~4000ms with jitter
      expect(calculateRetryDelay(2)).toBeLessThanOrEqual(4400);
    });

    it('should cap delay at maxDelayMs', () => {
      // Requirements: 10.4 - Max delay of 30s
      const delay = calculateRetryDelay(10, { maxDelayMs: 30000 });
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('should respect custom base delay', () => {
      const delay = calculateRetryDelay(0, { baseDelayMs: 500 });
      expect(delay).toBeGreaterThanOrEqual(450);
      expect(delay).toBeLessThanOrEqual(550);
    });

    it('should respect custom backoff multiplier', () => {
      const delay = calculateRetryDelay(1, { baseDelayMs: 1000, backoffMultiplier: 3 });
      expect(delay).toBeGreaterThanOrEqual(2700); // ~3000ms with jitter
      expect(delay).toBeLessThanOrEqual(3300);
    });
  });

  describe('retryWithBackoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should succeed on first attempt if operation succeeds', async () => {
      // Requirements: 10.4 - Retry logic
      const operation = vi.fn().mockResolvedValue('success');
      
      const promise = retryWithBackoff(operation, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure up to maxRetries', async () => {
      // Requirements: 10.4 - Retry logic with max retries
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');
      
      const promise = retryWithBackoff(operation, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw error after exhausting retries', async () => {
      // Requirements: 10.4 - Retry exhaustion
      const error = new Error('persistent failure');
      const operation = vi.fn().mockRejectedValue(error);
      
      const promise = retryWithBackoff(operation, { maxRetries: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('persistent failure');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should call onRetry callback on each retry', async () => {
      // Requirements: 10.4 - Retry callback
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      const onRetry = vi.fn();
      
      const promise = retryWithBackoff(operation, { maxRetries: 2, onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      );
    });

    it('should respect shouldRetry predicate', async () => {
      // Requirements: 10.4 - Conditional retry
      const operation = vi.fn().mockRejectedValue(new Error('non-retryable'));
      const shouldRetry = vi.fn().mockReturnValue(false);
      
      const promise = retryWithBackoff(operation, { maxRetries: 3, shouldRetry });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('non-retryable');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// ERROR FORMATTING TESTS
// ============================================================================

describe('Error Formatting', () => {
  describe('formatError', () => {
    it('should format network errors', () => {
      // Requirements: 10.4 - User-friendly error messages
      const error = new Error('Network request failed');
      const formatted = formatError(error);

      expect(formatted.title).toBe('Connection Problem');
      expect(formatted.message).toContain('internet');
      expect(formatted.icon).toBe('📡');
      expect(formatted.severity).toBe('error');
    });

    it('should format validation errors', () => {
      // Requirements: 19.3 - Clear error messages
      const error = new Error('Phone number is invalid');
      const formatted = formatError(error);

      expect(formatted.message.toLowerCase()).toContain('phone');
      expect(formatted.icon).toBe('📱');
    });

    it('should format upload errors', () => {
      // Requirements: 19.6 - File validation errors
      const error = new Error('File too large');
      const formatted = formatError(error);

      expect(formatted.title).toBe('File Too Big');
      expect(formatted.icon).toBe('📸');
    });

    it('should handle string error codes', () => {
      const formatted = formatError('NETWORK_ERROR');

      expect(formatted.title).toBe('Connection Problem');
      expect(formatted.icon).toBe('📡');
    });

    it('should handle unknown errors with fallback', () => {
      const formatted = formatError('some random error');

      expect(formatted.title).toBe('Oops!');
      expect(formatted.severity).toBe('error');
    });

    it('should include retry action for retryable errors', () => {
      const error = new Error('Network error');
      const formatted = formatError(error);

      expect(formatted.action?.type).toBe('retry');
      expect(formatted.action?.label).toBe('Try Again');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(new Error('Network error'))).toBe(true);
      expect(isRetryableError(new Error('Timeout'))).toBe(true);
      expect(isRetryableError(new Error('Server error'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(new Error('Session expired'))).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should identify network errors', () => {
      expect(isNetworkError(new Error('Network request failed'))).toBe(true);
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('offline'))).toBe(true);
      expect(isNetworkError('NETWORK_ERROR')).toBe(true);
    });

    it('should not identify non-network errors', () => {
      expect(isNetworkError(new Error('Validation failed'))).toBe(false);
      expect(isNetworkError('INVALID_INPUT')).toBe(false);
    });
  });
});

// ============================================================================
// FORM VALIDATION TESTS
// ============================================================================

describe('Form Validation', () => {
  describe('validatePhone', () => {
    it('should validate Ugandan phone numbers (10 digits)', () => {
      // Requirements: 19.4 - Phone number validation
      expect(validatePhone('0712345678').valid).toBe(true);
      expect(validatePhone('0782345678').valid).toBe(true);
    });

    it('should validate international format (12 digits)', () => {
      expect(validatePhone('256712345678').valid).toBe(true);
      expect(validatePhone('+256712345678').valid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('123').valid).toBe(false);
      expect(validatePhone('abcdefghij').valid).toBe(false);
      expect(validatePhone('').valid).toBe(false);
    });

    it('should return error message for invalid phones', () => {
      const result = validatePhone('123');
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('10 digits');
      expect(result.error?.icon).toBe('📱');
    });
  });

  describe('formatPhone', () => {
    it('should format 10-digit phone numbers', () => {
      // Requirements: 19.4 - Auto-formatting
      expect(formatPhone('0712345678')).toBe('0712 345 678');
    });

    it('should format 12-digit phone numbers', () => {
      expect(formatPhone('256712345678')).toBe('+256 712 345 678');
    });

    it('should handle already formatted numbers', () => {
      expect(formatPhone('0712 345 678')).toBe('0712 345 678');
    });

    it('should return original for invalid formats', () => {
      expect(formatPhone('123')).toBe('123');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      // Requirements: 19.1 - Email validation
      expect(validateEmail('test@example.com').valid).toBe(true);
      expect(validateEmail('user.name@domain.co.uk').valid).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid').valid).toBe(false);
      expect(validateEmail('test@').valid).toBe(false);
      expect(validateEmail('@example.com').valid).toBe(false);
      expect(validateEmail('').valid).toBe(false);
    });

    it('should return error message for invalid emails', () => {
      const result = validateEmail('invalid');
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('email');
      expect(result.error?.icon).toBe('📧');
    });
  });

  describe('validateRequired', () => {
    it('should validate non-empty values', () => {
      // Requirements: 19.1 - Required field validation
      expect(validateRequired('some value').valid).toBe(true);
      expect(validateRequired('a').valid).toBe(true);
    });

    it('should reject empty values', () => {
      expect(validateRequired('').valid).toBe(false);
      expect(validateRequired('   ').valid).toBe(false);
    });

    it('should include field name in error message', () => {
      const result = validateRequired('', 'name');
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('name');
    });
  });

  describe('validateFutureDate', () => {
    it('should validate future dates', () => {
      // Requirements: 19.3 - Date validation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      expect(validateFutureDate(tomorrow).valid).toBe(true);
    });

    it('should reject past dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = validateFutureDate(yesterday);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('future');
    });

    it('should accept today', () => {
      const today = new Date();
      expect(validateFutureDate(today).valid).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('should validate files within size limit', () => {
      // Requirements: 19.6 - File size validation
      const file = new File(['a'.repeat(1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
      expect(validateFileSize(file, 8).valid).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      const file = new File(['a'.repeat(10 * 1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
      const result = validateFileSize(file, 8);
      
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('too big');
    });
  });

  describe('validateFileType', () => {
    it('should validate allowed file types', () => {
      // Requirements: 19.6 - File type validation
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      expect(validateFileType(file, ['image/jpeg', 'image/png']).valid).toBe(true);
    });

    it('should reject disallowed file types', () => {
      const file = new File([''], 'test.pdf', { type: 'application/pdf' });
      const result = validateFileType(file, ['image/jpeg', 'image/png']);
      
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('photo');
    });
  });

  describe('formatName', () => {
    it('should capitalize first letter of each word', () => {
      // Requirements: 19.4 - Auto-formatting names
      expect(formatName('john doe')).toBe('John Doe');
      expect(formatName('MARY SMITH')).toBe('Mary Smith');
      expect(formatName('alice bob charlie')).toBe('Alice Bob Charlie');
    });

    it('should handle extra whitespace', () => {
      expect(formatName('  john   doe  ')).toBe('John Doe');
    });

    it('should handle single names', () => {
      expect(formatName('john')).toBe('John');
    });
  });

  describe('validateAndFormat', () => {
    it('should validate and format phone numbers', () => {
      // Requirements: 19.1, 19.4 - Validation and formatting
      const { value, result } = validateAndFormat('0712345678', 'phone');
      
      expect(result.valid).toBe(true);
      expect(value).toBe('0712 345 678');
    });

    it('should validate and format emails', () => {
      const { value, result } = validateAndFormat('Test@Example.COM', 'email');
      
      expect(result.valid).toBe(true);
      expect(value).toBe('test@example.com');
    });

    it('should validate and format names', () => {
      const { value, result } = validateAndFormat('john doe', 'name');
      
      expect(result.valid).toBe(true);
      expect(value).toBe('John Doe');
    });

    it('should return original value if validation fails', () => {
      const { value, result } = validateAndFormat('invalid', 'phone');
      
      expect(result.valid).toBe(false);
      expect(value).toBe('invalid');
    });
  });
});
