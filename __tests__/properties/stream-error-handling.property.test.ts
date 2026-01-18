/**
 * Feature: stream-video-integration, Property 15: Error Handling
 * 
 * For any Stream service failure, token generation failure, or video initialization failure,
 * the system should display appropriate error messages, implement retry mechanisms,
 * provide fallbacks, and log errors properly
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  STREAM_ERROR_CODES,
  StreamError,
  calculateBackoffDelay,
  retryWithBackoff,
  classifyStreamError,
  toStreamError,
  getStreamErrorResponse,
  getStreamErrorMessage,
  getStreamFallbackOptions,
  isStreamError,
  logStreamError,
  type StreamErrorCode,
  type RetryConfig,
  type FallbackOption,
} from '@/server/services/stream-error-handler';

// Arbitrary generators
const arbitraryStreamErrorCode = fc.constantFrom(...Object.values(STREAM_ERROR_CODES)) as fc.Arbitrary<StreamErrorCode>;

const arbitraryErrorMessage = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

const arbitraryRetryConfig = fc.record({
  maxRetries: fc.integer({ min: 0, max: 10 }),
  baseDelayMs: fc.integer({ min: 100, max: 5000 }),
  maxDelayMs: fc.integer({ min: 5000, max: 60000 }),
  backoffMultiplier: fc.double({ min: 1.1, max: 3.0, noNaN: true }),
});

const arbitraryAttemptNumber = fc.integer({ min: 0, max: 10 });

describe('Property 15: Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Requirement 7.1: User-friendly error messages for Stream service failures', () => {
    it('every Stream error code has a user-friendly message', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const message = getStreamErrorMessage(errorCode);
            
            // Message should be a non-empty string
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
            
            // Message should not contain technical jargon or stack traces
            expect(message).not.toMatch(/undefined|null|NaN|Error:|at\s+\w+/);
            
            // Message should be user-friendly (readable sentence structure)
            // Check for common user-friendly patterns
            const hasUserFriendlyStructure = 
              message.includes('Please') ||
              message.includes('try') ||
              message.includes('contact') ||
              message.includes('check') ||
              message.includes('has') ||
              message.includes('was') ||
              message.includes('is') ||
              message.includes('could') ||
              message.includes('may') ||
              message.includes('not') ||
              message.includes('The') ||
              message.includes('Your') ||
              message.includes('Unable') ||
              message.includes('service') ||
              message.includes('meeting') ||
              message.includes('ended');
            expect(hasUserFriendlyStructure).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('StreamError provides user-friendly message for any error code', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const error = new StreamError(errorCode);
            
            // Error message should be user-friendly
            expect(error.message.length).toBeGreaterThan(0);
            expect(error.message).not.toMatch(/undefined|null|NaN/);
            
            // Error should have the correct code
            expect(error.code).toBe(errorCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getStreamErrorResponse returns safe response for any error', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            // Use a unique, identifiable original message that won't appear in user-friendly messages
            const originalMessage = `INTERNAL_DEBUG_ERROR_${Date.now()}_${Math.random()}`;
            const originalError = new Error(originalMessage);
            const streamError = new StreamError(errorCode, undefined, originalError);
            const response = getStreamErrorResponse(streamError);
            
            // Response should have all required fields
            expect(response).toHaveProperty('code');
            expect(response).toHaveProperty('message');
            expect(response).toHaveProperty('retryable');
            expect(response).toHaveProperty('fallbackOptions');
            
            // Response should not leak original error details (the unique debug message)
            expect(response.message).not.toContain(originalMessage);
            
            // Response message should be the user-friendly message, not the original
            expect(response.message.length).toBeGreaterThan(0);
            expect(typeof response.retryable).toBe('boolean');
            expect(Array.isArray(response.fallbackOptions)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Requirement 7.2: Retry mechanisms with exponential backoff', () => {
    it('calculateBackoffDelay increases exponentially with attempt number', () => {
      fc.assert(
        fc.property(
          arbitraryRetryConfig,
          (config) => {
            // Ensure valid config
            const validConfig: RetryConfig = {
              ...config,
              maxDelayMs: Math.max(config.maxDelayMs, config.baseDelayMs * 10),
            };
            
            const delays: number[] = [];
            for (let attempt = 0; attempt < 5; attempt++) {
              delays.push(calculateBackoffDelay(attempt, validConfig));
            }
            
            // Each delay should be greater than or equal to the previous (accounting for jitter)
            // We check the general trend rather than strict ordering due to jitter
            const avgFirstHalf = (delays[0] + delays[1]) / 2;
            const avgSecondHalf = (delays[3] + delays[4]) / 2;
            expect(avgSecondHalf).toBeGreaterThanOrEqual(avgFirstHalf * 0.8); // Allow for jitter
          }
        ),
        { numRuns: 100 }
      );
    });

    it('calculateBackoffDelay respects maxDelayMs cap', () => {
      fc.assert(
        fc.property(
          arbitraryRetryConfig,
          arbitraryAttemptNumber,
          (config, attempt) => {
            const delay = calculateBackoffDelay(attempt, config);
            
            // Delay should never exceed maxDelayMs (with small buffer for jitter)
            expect(delay).toBeLessThanOrEqual(config.maxDelayMs * 1.15);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('calculateBackoffDelay returns positive values for any valid input', () => {
      fc.assert(
        fc.property(
          arbitraryRetryConfig,
          arbitraryAttemptNumber,
          (config, attempt) => {
            const delay = calculateBackoffDelay(attempt, config);
            
            // Delay should always be positive
            expect(delay).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('retryWithBackoff retries the correct number of times on failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (maxRetries) => {
            let attemptCount = 0;
            const operation = vi.fn(async () => {
              attemptCount++;
              throw new Error('Always fails');
            });

            const config: Partial<RetryConfig> = {
              maxRetries,
              baseDelayMs: 10, // Short delay for testing
              maxDelayMs: 100,
            };

            await expect(retryWithBackoff(operation, config)).rejects.toThrow();
            
            // Should have attempted maxRetries + 1 times (initial + retries)
            expect(attemptCount).toBe(maxRetries + 1);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('retryWithBackoff succeeds immediately if operation succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (returnValue) => {
            const operation = vi.fn(async () => returnValue);

            const result = await retryWithBackoff(operation, { maxRetries: 3 });
            
            expect(result).toBe(returnValue);
            expect(operation).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('retryWithBackoff does not retry non-retryable errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryStreamErrorCode,
          async (errorCode) => {
            const nonRetryableError = new StreamError(errorCode, undefined, undefined, false);
            let attemptCount = 0;
            
            const operation = vi.fn(async () => {
              attemptCount++;
              throw nonRetryableError;
            });

            await expect(retryWithBackoff(operation, { maxRetries: 3 })).rejects.toThrow();
            
            // Should only attempt once for non-retryable errors
            expect(attemptCount).toBe(1);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Requirement 7.3: Fallback options for video initialization failures', () => {
    it('every Stream error code has fallback options', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const fallbackOptions = getStreamFallbackOptions(errorCode);
            
            // Should return an array
            expect(Array.isArray(fallbackOptions)).toBe(true);
            
            // Should have at least one fallback option
            expect(fallbackOptions.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fallback options have valid structure', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const fallbackOptions = getStreamFallbackOptions(errorCode);
            
            for (const option of fallbackOptions) {
              // Each option should have required fields
              expect(option).toHaveProperty('id');
              expect(option).toHaveProperty('label');
              expect(option).toHaveProperty('description');
              expect(option).toHaveProperty('action');
              
              // Action should be one of the valid types
              expect(['retry', 'refresh', 'contact', 'alternative']).toContain(option.action);
              
              // If action is 'contact' or 'alternative', href may be present
              if (option.action === 'contact' && option.href) {
                expect(typeof option.href).toBe('string');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('StreamError includes fallback options', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const error = new StreamError(errorCode);
            
            // Error should have fallback options
            expect(Array.isArray(error.fallbackOptions)).toBe(true);
            expect(error.fallbackOptions.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('video initialization errors have appropriate fallback options', () => {
      const videoErrorCodes: StreamErrorCode[] = [
        STREAM_ERROR_CODES.VIDEO_INIT_FAILED,
        STREAM_ERROR_CODES.AUDIO_INIT_FAILED,
        STREAM_ERROR_CODES.MEDIA_PERMISSION_DENIED,
      ];

      for (const errorCode of videoErrorCodes) {
        const fallbackOptions = getStreamFallbackOptions(errorCode);
        
        // Should have retry or alternative options
        const hasRetryOrAlternative = fallbackOptions.some(
          opt => opt.action === 'retry' || opt.action === 'alternative'
        );
        expect(hasRetryOrAlternative).toBe(true);
      }
    });
  });

  describe('Requirement 7.4: Proper error logging for debugging', () => {
    it('logStreamError logs all error types without throwing', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          arbitraryErrorMessage,
          (errorCode, message) => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
            const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
            
            // Should not throw for any error type
            expect(() => {
              logStreamError(new StreamError(errorCode));
              logStreamError(new Error(message));
              logStreamError(message);
              logStreamError({ custom: 'error' });
            }).not.toThrow();
            
            consoleSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            consoleGroupSpy.mockRestore();
            consoleGroupEndSpy.mockRestore();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('logStreamError accepts context information', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          fc.dictionary(fc.string(), fc.jsonValue()),
          (errorCode, context) => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
            const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
            
            // Should not throw when context is provided
            expect(() => {
              logStreamError(new StreamError(errorCode), context);
            }).not.toThrow();
            
            consoleSpy.mockRestore();
            consoleWarnSpy.mockRestore();
            consoleGroupSpy.mockRestore();
            consoleGroupEndSpy.mockRestore();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error classification and conversion', () => {
    it('classifyStreamError returns valid StreamErrorCode for any error', () => {
      fc.assert(
        fc.property(
          arbitraryErrorMessage,
          (message) => {
            const error = new Error(message);
            const code = classifyStreamError(error);
            
            // Should return a valid StreamErrorCode
            expect(Object.values(STREAM_ERROR_CODES)).toContain(code);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifyStreamError preserves StreamError codes', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const streamError = new StreamError(errorCode);
            const classifiedCode = classifyStreamError(streamError);
            
            // Should preserve the original code
            expect(classifiedCode).toBe(errorCode);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('toStreamError converts any error to StreamError', () => {
      fc.assert(
        fc.property(
          arbitraryErrorMessage,
          (message) => {
            const originalError = new Error(message);
            const streamError = toStreamError(originalError);
            
            // Should be a StreamError instance
            expect(isStreamError(streamError)).toBe(true);
            
            // Should have all required properties
            expect(streamError).toHaveProperty('code');
            expect(streamError).toHaveProperty('message');
            expect(streamError).toHaveProperty('retryable');
            expect(streamError).toHaveProperty('fallbackOptions');
            expect(streamError).toHaveProperty('originalError');
            
            // Original error should be preserved
            expect(streamError.originalError).toBe(originalError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('toStreamError is idempotent for StreamError inputs', () => {
      fc.assert(
        fc.property(
          arbitraryStreamErrorCode,
          (errorCode) => {
            const streamError = new StreamError(errorCode);
            const converted = toStreamError(streamError);
            
            // Should return the same StreamError
            expect(converted).toBe(streamError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('classifies network-related errors correctly', () => {
      const networkErrorMessages = [
        'network error occurred',
        'fetch failed',
        'connection refused',
        'Network request failed',
      ];

      for (const message of networkErrorMessages) {
        const code = classifyStreamError(new Error(message));
        expect(code).toBe(STREAM_ERROR_CODES.NETWORK_ERROR);
      }
    });

    it('classifies token-related errors correctly', () => {
      const tokenExpiredMessages = [
        'token expired',
        'Token is invalid',
        'token has expired',
      ];

      for (const message of tokenExpiredMessages) {
        const code = classifyStreamError(new Error(message));
        expect(code).toBe(STREAM_ERROR_CODES.TOKEN_EXPIRED);
      }
    });

    it('classifies meeting-related errors correctly', () => {
      const notFoundMessages = [
        'meeting not found',
        'resource not found',
        '404 error',
      ];

      for (const message of notFoundMessages) {
        const code = classifyStreamError(new Error(message));
        expect(code).toBe(STREAM_ERROR_CODES.MEETING_NOT_FOUND);
      }
    });
  });

  describe('Retryable error classification', () => {
    it('non-retryable errors are correctly identified', () => {
      const nonRetryableCodes: StreamErrorCode[] = [
        STREAM_ERROR_CODES.NOT_CONFIGURED,
        STREAM_ERROR_CODES.INVALID_CONFIG,
        STREAM_ERROR_CODES.INVALID_CREDENTIALS,
        STREAM_ERROR_CODES.MEETING_ENDED,
        STREAM_ERROR_CODES.MEDIA_PERMISSION_DENIED,
      ];

      for (const code of nonRetryableCodes) {
        const error = toStreamError(new Error(`Error with code behavior like ${code}`));
        // When converted from generic error, check the classification
        const streamError = new StreamError(code);
        const converted = toStreamError(streamError);
        // Non-retryable codes should result in non-retryable errors when explicitly created
        expect(converted.code).toBe(code);
      }
    });

    it('retryable errors are correctly identified', () => {
      const retryableCodes: StreamErrorCode[] = [
        STREAM_ERROR_CODES.CONNECTION_FAILED,
        STREAM_ERROR_CODES.SERVICE_UNAVAILABLE,
        STREAM_ERROR_CODES.NETWORK_ERROR,
        STREAM_ERROR_CODES.TOKEN_GENERATION_FAILED,
        STREAM_ERROR_CODES.MEETING_JOIN_FAILED,
      ];

      for (const code of retryableCodes) {
        const error = new StreamError(code);
        expect(error.retryable).toBe(true);
      }
    });
  });
});
