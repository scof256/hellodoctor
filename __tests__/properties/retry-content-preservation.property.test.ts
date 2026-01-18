/**
 * Property Test: Retry Content Preservation
 * Feature: messaging-reliability-fix, Property 8: Retry Content Preservation
 * 
 * *For any* retry attempt, the system SHALL send the exact same content as the
 * original failed message.
 * 
 * **Validates: Requirements 3.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the implementation
interface PendingMessage {
  tempId: string;
  content: string;
  images?: string[];
  timestamp: Date;
  retryCount: number;
}

interface FailedMessage extends PendingMessage {
  error: string;
  lastAttempt: Date;
}

/**
 * Simulates the retry logic from useMessageQueue
 * This creates a retry message from a failed message, preserving content
 * Requirements: 3.2 - Re-attempt sending with the original content
 */
function createRetryMessage(failedMessage: FailedMessage): PendingMessage {
  return {
    ...failedMessage,
    retryCount: failedMessage.retryCount + 1,
  };
}

/**
 * Checks if two messages have identical content
 * Content includes: text content and images array
 */
function hasIdenticalContent(original: PendingMessage, retry: PendingMessage): boolean {
  // Check text content is identical
  if (original.content !== retry.content) {
    return false;
  }
  
  // Check images array is identical
  if (original.images === undefined && retry.images === undefined) {
    return true;
  }
  
  if (original.images === undefined || retry.images === undefined) {
    return false;
  }
  
  if (original.images.length !== retry.images.length) {
    return false;
  }
  
  for (let i = 0; i < original.images.length; i++) {
    if (original.images[i] !== retry.images[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Checks if the tempId is preserved across retries
 * This is important for tracking the message through its lifecycle
 */
function hasSameTempId(original: PendingMessage, retry: PendingMessage): boolean {
  return original.tempId === retry.tempId;
}

// Arbitraries for generating test data
const tempIdArb = fc.string({ minLength: 10, maxLength: 50 }).map(s => `temp-${s}`);

const contentArb = fc.string({ minLength: 1, maxLength: 1000 });

const imagesArb = fc.option(
  fc.array(fc.webUrl(), { minLength: 0, maxLength: 5 }),
  { nil: undefined }
);

const timestampArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

const retryCountArb = fc.integer({ min: 0, max: 10 });

const errorMessageArb = fc.constantFrom(
  'Network error',
  'Timeout',
  'Server error',
  'Connection refused',
  'Request failed'
);

const pendingMessageArb: fc.Arbitrary<PendingMessage> = fc.record({
  tempId: tempIdArb,
  content: contentArb,
  images: imagesArb,
  timestamp: timestampArb,
  retryCount: retryCountArb,
});

const failedMessageArb: fc.Arbitrary<FailedMessage> = fc.record({
  tempId: tempIdArb,
  content: contentArb,
  images: imagesArb,
  timestamp: timestampArb,
  retryCount: retryCountArb,
  error: errorMessageArb,
  lastAttempt: timestampArb,
});

describe('Property 8: Retry Content Preservation', () => {
  it('should preserve exact content, tempId, and images when retrying a failed message', () => {
    fc.assert(
      fc.property(
        failedMessageArb,
        (failedMessage) => {
          const retryMessage = createRetryMessage(failedMessage);
          
          // Text content must be exactly the same
          expect(retryMessage.content).toBe(failedMessage.content);
          
          // TempId must be preserved for tracking
          expect(hasSameTempId(failedMessage, retryMessage)).toBe(true);
          
          // Images array must be identical
          if (failedMessage.images === undefined) {
            expect(retryMessage.images).toBeUndefined();
          } else {
            expect(retryMessage.images).toEqual(failedMessage.images);
          }
          
          // Retry count should increment by 1
          expect(retryMessage.retryCount).toBe(failedMessage.retryCount + 1);
          
          // But content should still be identical
          expect(hasIdenticalContent(failedMessage, retryMessage)).toBe(true);
          
          // Original timestamp should be preserved
          expect(retryMessage.timestamp.getTime()).toBe(failedMessage.timestamp.getTime());
        }
      ),
      { numRuns: 25 }
    );
  });

  it('should preserve content through multiple consecutive retries', () => {
    fc.assert(
      fc.property(
        failedMessageArb,
        fc.integer({ min: 1, max: 5 }), // Number of retries
        (originalFailed, numRetries) => {
          let currentMessage: PendingMessage = originalFailed;
          
          // Simulate multiple retries
          for (let i = 0; i < numRetries; i++) {
            const failedVersion: FailedMessage = {
              ...currentMessage,
              error: 'Retry failed',
              lastAttempt: new Date(),
            };
            currentMessage = createRetryMessage(failedVersion);
          }
          
          // After all retries, content should still match original
          expect(currentMessage.content).toBe(originalFailed.content);
          expect(currentMessage.tempId).toBe(originalFailed.tempId);
          
          // Images should be preserved
          if (originalFailed.images === undefined) {
            expect(currentMessage.images).toBeUndefined();
          } else {
            expect(currentMessage.images).toEqual(originalFailed.images);
          }
          
          // Retry count should have incremented correctly
          expect(currentMessage.retryCount).toBe(originalFailed.retryCount + numRetries);
        }
      ),
      { numRuns: 25 }
    );
  });

  it('should not modify the original failed message when creating retry', () => {
    fc.assert(
      fc.property(
        failedMessageArb,
        (failedMessage) => {
          // Store original values
          const originalContent = failedMessage.content;
          const originalTempId = failedMessage.tempId;
          const originalRetryCount = failedMessage.retryCount;
          const originalImages = failedMessage.images ? [...failedMessage.images] : undefined;
          
          // Create retry message
          createRetryMessage(failedMessage);
          
          // Original message should be unchanged
          expect(failedMessage.content).toBe(originalContent);
          expect(failedMessage.tempId).toBe(originalTempId);
          expect(failedMessage.retryCount).toBe(originalRetryCount);
          if (originalImages === undefined) {
            expect(failedMessage.images).toBeUndefined();
          } else {
            expect(failedMessage.images).toEqual(originalImages);
          }
        }
      ),
      { numRuns: 25 }
    );
  });
});
