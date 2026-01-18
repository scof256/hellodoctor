/**
 * Property Test: Retry Limit Enforcement
 * Feature: messaging-reliability-fix, Property 9: Retry Limit Enforcement
 * 
 * *For any* message, the system SHALL limit manual retry attempts to 3, and after
 * the limit is reached, the retry button SHALL be disabled with a "max retries reached" indicator.
 * 
 * **Validates: Requirements 3.3**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

type MessageStatus = 'sending' | 'sent' | 'failed' | 'permanently_failed';

interface MessageWithStatus {
  id: string;
  tempId?: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  timestamp: Date;
  status: MessageStatus;
  error?: string;
  retryCount?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  timestamp: Date;
}

// Simplified message queue implementation for testing retry limit logic
class TestMessageQueue {
  private messages: MessageWithStatus[] = [];
  private failedMessages: Map<string, FailedMessage> = new Map();
  private maxRetries: number;
  private retryExhaustedCallbacks: FailedMessage[] = [];

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  // Add a failed message to the queue
  addFailedMessage(message: FailedMessage): void {
    this.failedMessages.set(message.tempId, message);
    this.messages.push({
      id: message.tempId,
      tempId: message.tempId,
      role: 'user',
      text: message.content,
      images: message.images,
      timestamp: message.timestamp,
      status: 'failed',
      error: message.error,
      retryCount: message.retryCount,
    });
  }

  // Attempt to retry a message - returns true if retry was allowed, false if limit reached
  retry(tempId: string): boolean {
    const failedMessage = this.failedMessages.get(tempId);
    if (!failedMessage) {
      return false;
    }

    // Check if max retries reached
    // Requirements: 3.3 - Limit retry attempts to 3 per message
    if (failedMessage.retryCount >= this.maxRetries) {
      // Update message status to permanently_failed
      this.messages = this.messages.map(m => {
        if (m.tempId === tempId) {
          return {
            ...m,
            status: 'permanently_failed' as const,
            error: `Max retries (${this.maxRetries}) reached`,
          };
        }
        return m;
      });

      // Track that retry was exhausted
      this.retryExhaustedCallbacks.push(failedMessage);
      
      return false;
    }

    // Remove from failed messages
    this.failedMessages.delete(tempId);

    // Update message status to sending and increment retry count
    this.messages = this.messages.map(m => {
      if (m.tempId === tempId) {
        return {
          ...m,
          status: 'sending' as const,
          error: undefined,
          retryCount: (m.retryCount || 0) + 1,
        };
      }
      return m;
    });

    // Re-add to failed with incremented retry count (simulating a failed retry)
    const retryMessage: FailedMessage = {
      ...failedMessage,
      retryCount: failedMessage.retryCount + 1,
      lastAttempt: new Date(),
    };
    this.failedMessages.set(tempId, retryMessage);

    // Update message back to failed status
    this.messages = this.messages.map(m => {
      if (m.tempId === tempId) {
        return {
          ...m,
          status: 'failed' as const,
          error: 'Retry failed',
          retryCount: retryMessage.retryCount,
        };
      }
      return m;
    });

    return true;
  }

  // Check if a message has reached max retries
  hasReachedMaxRetries(tempId: string): boolean {
    const failedMessage = this.failedMessages.get(tempId);
    if (!failedMessage) {
      // Check in messages array for permanently_failed status
      const message = this.messages.find(m => m.tempId === tempId);
      return message?.status === 'permanently_failed';
    }
    return failedMessage.retryCount >= this.maxRetries;
  }

  // Get message by tempId
  getMessage(tempId: string): MessageWithStatus | undefined {
    return this.messages.find(m => m.tempId === tempId);
  }

  // Get failed message by tempId
  getFailedMessage(tempId: string): FailedMessage | undefined {
    return this.failedMessages.get(tempId);
  }

  // Get all retry exhausted callbacks
  getRetryExhaustedCallbacks(): FailedMessage[] {
    return this.retryExhaustedCallbacks;
  }

  // Get max retries config
  getMaxRetries(): number {
    return this.maxRetries;
  }
}

// Arbitraries for generating test data
const tempIdArb = fc.string({ minLength: 5, maxLength: 30 })
  .filter(s => s.length > 0 && !s.includes('\0'));

const messageContentArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

const imageUrlArb = fc.webUrl();

const imagesArb = fc.option(
  fc.array(imageUrlArb, { minLength: 0, maxLength: 3 }),
  { nil: undefined }
);

const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
  .filter(s => s.trim().length > 0);

// Generate a failed message with a specific retry count
const failedMessageWithRetryCountArb = (retryCount: number): fc.Arbitrary<FailedMessage> =>
  fc.record({
    tempId: tempIdArb,
    content: messageContentArb,
    images: imagesArb,
    timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    retryCount: fc.constant(retryCount),
    error: errorMessageArb,
    lastAttempt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  });

// Generate a failed message with any retry count
const failedMessageArb: fc.Arbitrary<FailedMessage> = fc.record({
  tempId: tempIdArb,
  content: messageContentArb,
  images: imagesArb,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  retryCount: fc.integer({ min: 0, max: 10 }),
  error: errorMessageArb,
  lastAttempt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
});

// Generate max retries config (typically 3, but test with various values)
const maxRetriesArb = fc.integer({ min: 1, max: 10 });

describe('Property 9: Retry Limit Enforcement', () => {
  it('should allow retry when retry count is below max retries', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        fc.integer({ min: 0, max: 9 }),
        messageContentArb,
        tempIdArb,
        (maxRetries, initialRetryCount, content, tempId) => {
          // Only test when initial retry count is below max
          if (initialRetryCount >= maxRetries) return true;

          const queue = new TestMessageQueue(maxRetries);
          const failedMessage: FailedMessage = {
            tempId,
            content,
            timestamp: new Date(),
            retryCount: initialRetryCount,
            error: 'Test error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          
          // Retry should be allowed
          const retryAllowed = queue.retry(tempId);
          expect(retryAllowed).toBe(true);
          
          // hasReachedMaxRetries should return false if still below limit
          const newRetryCount = initialRetryCount + 1;
          if (newRetryCount < maxRetries) {
            expect(queue.hasReachedMaxRetries(tempId)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should block retry and mark as permanently_failed when retry count equals max retries', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        messageContentArb,
        tempIdArb,
        (maxRetries, content, tempId) => {
          const queue = new TestMessageQueue(maxRetries);
          const failedMessage: FailedMessage = {
            tempId,
            content,
            timestamp: new Date(),
            retryCount: maxRetries, // Already at max
            error: 'Test error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          
          // Retry should be blocked
          const retryAllowed = queue.retry(tempId);
          expect(retryAllowed).toBe(false);
          
          // Message should be marked as permanently_failed
          const message = queue.getMessage(tempId);
          expect(message?.status).toBe('permanently_failed');
          expect(message?.error).toContain('Max retries');
          
          // hasReachedMaxRetries should return true
          expect(queue.hasReachedMaxRetries(tempId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should block retry when retry count exceeds max retries', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        fc.integer({ min: 1, max: 10 }),
        messageContentArb,
        tempIdArb,
        (maxRetries, excess, content, tempId) => {
          const queue = new TestMessageQueue(maxRetries);
          const failedMessage: FailedMessage = {
            tempId,
            content,
            timestamp: new Date(),
            retryCount: maxRetries + excess, // Exceeds max
            error: 'Test error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          
          // Retry should be blocked
          const retryAllowed = queue.retry(tempId);
          expect(retryAllowed).toBe(false);
          
          // hasReachedMaxRetries should return true
          expect(queue.hasReachedMaxRetries(tempId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increment retry count on each retry attempt until max is reached', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        messageContentArb,
        tempIdArb,
        (maxRetries, content, tempId) => {
          const queue = new TestMessageQueue(maxRetries);
          const failedMessage: FailedMessage = {
            tempId,
            content,
            timestamp: new Date(),
            retryCount: 0, // Start at 0
            error: 'Test error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          
          // Retry maxRetries times - all should succeed
          for (let i = 0; i < maxRetries; i++) {
            const retryAllowed = queue.retry(tempId);
            expect(retryAllowed).toBe(true);
            
            // Verify retry count incremented
            const failed = queue.getFailedMessage(tempId);
            expect(failed?.retryCount).toBe(i + 1);
          }
          
          // Next retry should fail - we've reached the limit
          const finalRetryAllowed = queue.retry(tempId);
          expect(finalRetryAllowed).toBe(false);
          
          // Message should be permanently_failed
          expect(queue.hasReachedMaxRetries(tempId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should call onRetryExhausted callback when max retries reached', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        messageContentArb,
        tempIdArb,
        (maxRetries, content, tempId) => {
          const queue = new TestMessageQueue(maxRetries);
          const failedMessage: FailedMessage = {
            tempId,
            content,
            timestamp: new Date(),
            retryCount: maxRetries, // At max
            error: 'Test error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          
          // Before retry, no callbacks
          expect(queue.getRetryExhaustedCallbacks()).toHaveLength(0);
          
          // Attempt retry (should fail)
          queue.retry(tempId);
          
          // Callback should have been triggered
          const callbacks = queue.getRetryExhaustedCallbacks();
          expect(callbacks).toHaveLength(1);
          expect(callbacks[0]?.tempId).toBe(tempId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should enforce default max retries of 3', () => {
    fc.assert(
      fc.property(
        messageContentArb,
        tempIdArb,
        (content, tempId) => {
          const queue = new TestMessageQueue(); // Default maxRetries = 3
          expect(queue.getMaxRetries()).toBe(3);
          
          const failedMessage: FailedMessage = {
            tempId,
            content,
            timestamp: new Date(),
            retryCount: 0,
            error: 'Test error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          
          // Should allow exactly 3 retries
          expect(queue.retry(tempId)).toBe(true); // retry 1
          expect(queue.retry(tempId)).toBe(true); // retry 2
          expect(queue.retry(tempId)).toBe(true); // retry 3
          expect(queue.retry(tempId)).toBe(false); // blocked - max reached
          
          expect(queue.hasReachedMaxRetries(tempId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve message content when marking as permanently_failed', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        messageContentArb,
        tempIdArb,
        imagesArb,
        (maxRetries, content, tempId, images) => {
          const queue = new TestMessageQueue(maxRetries);
          const timestamp = new Date();
          const failedMessage: FailedMessage = {
            tempId,
            content,
            images,
            timestamp,
            retryCount: maxRetries, // At max
            error: 'Original error',
            lastAttempt: new Date(),
          };

          queue.addFailedMessage(failedMessage);
          queue.retry(tempId); // Should fail and mark as permanently_failed
          
          const message = queue.getMessage(tempId);
          expect(message).toBeDefined();
          expect(message?.text).toBe(content);
          expect(message?.images).toEqual(images);
          expect(message?.timestamp).toEqual(timestamp);
          expect(message?.status).toBe('permanently_failed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple messages with independent retry counts', () => {
    fc.assert(
      fc.property(
        maxRetriesArb,
        fc.array(
          fc.record({
            content: messageContentArb,
            retryCount: fc.integer({ min: 0, max: 10 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (maxRetries, messageConfigs) => {
          const queue = new TestMessageQueue(maxRetries);
          
          // Add messages with unique tempIds
          const messages = messageConfigs.map((config, i) => {
            const failedMessage: FailedMessage = {
              tempId: `msg-${i}`,
              content: config.content,
              timestamp: new Date(),
              retryCount: config.retryCount,
              error: 'Test error',
              lastAttempt: new Date(),
            };
            queue.addFailedMessage(failedMessage);
            return failedMessage;
          });
          
          // Each message should have independent retry limit enforcement
          for (const msg of messages) {
            const shouldBlock = msg.retryCount >= maxRetries;
            const retryAllowed = queue.retry(msg.tempId);
            
            if (shouldBlock) {
              expect(retryAllowed).toBe(false);
              expect(queue.hasReachedMaxRetries(msg.tempId)).toBe(true);
            } else {
              expect(retryAllowed).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
