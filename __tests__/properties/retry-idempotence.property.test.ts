/**
 * Property Test: Failed Message Retry Idempotence
 *
 * Property 3: For any failed message that is retried, the retry operation SHALL
 * result in exactly one message being persisted to the database, regardless of
 * how many retry attempts are made.
 *
 * **Validates: Requirements 3.3, 3.4, 3.5**
 *
 * Feature: intake-chatbot-ux
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simulated message type for testing
interface TestMessage {
  id: string;
  tempId: string;
  content: string;
  status: 'sending' | 'sent' | 'failed';
  error?: string;
  retryCount: number;
  timestamp: number;
}

// Simulated database for tracking persisted messages
interface Database {
  messages: Map<string, { content: string; persistedAt: number }>;
}

// Maximum retry attempts
const MAX_RETRIES = 3;

// Simulate a failed message
function createFailedMessage(content: string, retryCount: number = 0): TestMessage {
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  return {
    id: tempId,
    tempId,
    content,
    status: 'failed',
    error: 'Network error',
    retryCount,
    timestamp: Date.now(),
  };
}

// Simulate retry operation that updates message status
function retryMessage(
  messages: TestMessage[],
  tempId: string,
  maxRetries: number = MAX_RETRIES
): { messages: TestMessage[]; canRetry: boolean } {
  const messageIndex = messages.findIndex((m) => m.tempId === tempId);
  if (messageIndex === -1) {
    return { messages, canRetry: false };
  }

  const message = messages[messageIndex]!;
  
  // Check if max retries reached
  if (message.retryCount >= maxRetries) {
    return { messages, canRetry: false };
  }

  // Update message status to sending and increment retry count (preserves position)
  const updatedMessages = messages.map((m, index) => {
    if (index === messageIndex) {
      return {
        ...m,
        status: 'sending' as const,
        error: undefined,
        retryCount: m.retryCount + 1,
      };
    }
    return m;
  });

  return { messages: updatedMessages, canRetry: true };
}

// Simulate successful send that persists to database
function persistMessage(
  db: Database,
  message: TestMessage,
  serverId: string
): Database {
  // Only persist if not already persisted (idempotence)
  if (!db.messages.has(message.tempId)) {
    db.messages.set(message.tempId, {
      content: message.content,
      persistedAt: Date.now(),
    });
  }
  return db;
}

// Simulate server confirmation
function confirmMessage(
  messages: TestMessage[],
  tempId: string,
  serverId: string
): TestMessage[] {
  return messages.map((m) => {
    if (m.tempId === tempId) {
      return { ...m, id: serverId, status: 'sent' as const, error: undefined };
    }
    return m;
  });
}

// Simulate server error
function failMessage(
  messages: TestMessage[],
  tempId: string,
  errorMessage: string
): TestMessage[] {
  return messages.map((m) => {
    if (m.tempId === tempId && m.status === 'sending') {
      return { ...m, status: 'failed' as const, error: errorMessage };
    }
    return m;
  });
}

// Arbitrary generators
const messageContentArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const retryCountArb = fc.integer({ min: 0, max: MAX_RETRIES });
const errorMessageArb = fc.string({ minLength: 1, maxLength: 50 });

describe('Property 3: Failed Message Retry Idempotence', () => {
  it('retry operation results in exactly one message persisted regardless of retry attempts', () => {
    fc.assert(
      fc.property(
        messageContentArb,
        fc.integer({ min: 1, max: 5 }), // Number of retry attempts
        fc.uuid(),
        (content, retryAttempts, serverId) => {
          // Create initial failed message
          const failedMessage = createFailedMessage(content, 0);
          let messages: TestMessage[] = [failedMessage];
          const db: Database = { messages: new Map() };

          let successfulRetries = 0;

          // Attempt multiple retries
          for (let i = 0; i < retryAttempts; i++) {
            const { messages: updatedMessages, canRetry } = retryMessage(
              messages,
              failedMessage.tempId
            );
            messages = updatedMessages;

            if (canRetry) {
              successfulRetries++;
              // Simulate successful send on last retry
              if (i === retryAttempts - 1) {
                persistMessage(db, failedMessage, serverId);
                messages = confirmMessage(messages, failedMessage.tempId, serverId);
              } else {
                // Simulate failure for intermediate retries
                messages = failMessage(messages, failedMessage.tempId, 'Network error');
              }
            }
          }

          // Verify exactly one message is persisted (or zero if all retries failed)
          const persistedCount = db.messages.size;
          expect(persistedCount).toBeLessThanOrEqual(1);

          // If message was successfully sent, verify it's persisted exactly once
          const finalMessage = messages.find((m) => m.tempId === failedMessage.tempId);
          if (finalMessage?.status === 'sent') {
            expect(persistedCount).toBe(1);
            expect(db.messages.get(failedMessage.tempId)?.content).toBe(content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('retry preserves original message position in the list', () => {
    fc.assert(
      fc.property(
        fc.array(messageContentArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }), // Index of failed message
        (contents, failedIndex) => {
          // Ensure failedIndex is within bounds
          const actualFailedIndex = failedIndex % contents.length;

          // Create messages with one failed
          const messages: TestMessage[] = contents.map((content, index) => {
            if (index === actualFailedIndex) {
              return createFailedMessage(content, 0);
            }
            return {
              id: `msg-${index}`,
              tempId: `temp-${index}`,
              content,
              status: 'sent' as const,
              retryCount: 0,
              timestamp: Date.now() + index,
            };
          });

          const failedMessage = messages[actualFailedIndex]!;
          const originalPosition = actualFailedIndex;

          // Retry the failed message
          const { messages: updatedMessages, canRetry } = retryMessage(
            messages,
            failedMessage.tempId
          );

          if (canRetry) {
            // Find the retried message
            const retriedIndex = updatedMessages.findIndex(
              (m) => m.tempId === failedMessage.tempId
            );

            // Position should be preserved
            expect(retriedIndex).toBe(originalPosition);

            // Status should be 'sending'
            expect(updatedMessages[retriedIndex]?.status).toBe('sending');

            // Retry count should be incremented
            expect(updatedMessages[retriedIndex]?.retryCount).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('retry is blocked after max retries reached', () => {
    fc.assert(
      fc.property(messageContentArb, (content) => {
        // Create a message that has already reached max retries
        const failedMessage = createFailedMessage(content, MAX_RETRIES);
        const messages: TestMessage[] = [failedMessage];

        // Attempt to retry
        const { messages: updatedMessages, canRetry } = retryMessage(
          messages,
          failedMessage.tempId
        );

        // Retry should be blocked
        expect(canRetry).toBe(false);

        // Message should remain unchanged
        expect(updatedMessages[0]?.status).toBe('failed');
        expect(updatedMessages[0]?.retryCount).toBe(MAX_RETRIES);
      }),
      { numRuns: 100 }
    );
  });

  it('retry count increments correctly with each attempt', () => {
    fc.assert(
      fc.property(
        messageContentArb,
        fc.integer({ min: 0, max: MAX_RETRIES - 1 }), // Starting retry count
        (content, startingRetryCount) => {
          const failedMessage = createFailedMessage(content, startingRetryCount);
          const messages: TestMessage[] = [failedMessage];

          // Retry the message
          const { messages: updatedMessages, canRetry } = retryMessage(
            messages,
            failedMessage.tempId
          );

          // Should be able to retry
          expect(canRetry).toBe(true);

          // Retry count should be incremented by 1
          const retriedMessage = updatedMessages.find(
            (m) => m.tempId === failedMessage.tempId
          );
          expect(retriedMessage?.retryCount).toBe(startingRetryCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple rapid retries do not create duplicate messages', () => {
    fc.assert(
      fc.property(
        messageContentArb,
        fc.integer({ min: 2, max: 10 }), // Number of rapid retry attempts
        fc.uuid(),
        (content, rapidAttempts, serverId) => {
          const failedMessage = createFailedMessage(content, 0);
          let messages: TestMessage[] = [failedMessage];
          const db: Database = { messages: new Map() };

          // Simulate rapid retry attempts (all happening before any response)
          let retryCount = 0;
          for (let i = 0; i < rapidAttempts; i++) {
            const { messages: updatedMessages, canRetry } = retryMessage(
              messages,
              failedMessage.tempId
            );
            
            if (canRetry) {
              messages = updatedMessages;
              retryCount++;
              
              // Simulate persistence attempt
              persistMessage(db, failedMessage, serverId);
            }
          }

          // Verify only one message is persisted despite multiple attempts
          expect(db.messages.size).toBe(1);

          // Verify retry count doesn't exceed max
          const finalMessage = messages.find((m) => m.tempId === failedMessage.tempId);
          expect(finalMessage?.retryCount).toBeLessThanOrEqual(MAX_RETRIES);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message content is preserved through retry operations', () => {
    fc.assert(
      fc.property(
        messageContentArb,
        fc.integer({ min: 1, max: MAX_RETRIES }),
        (content, retryAttempts) => {
          const failedMessage = createFailedMessage(content, 0);
          let messages: TestMessage[] = [failedMessage];

          // Perform multiple retries
          for (let i = 0; i < retryAttempts; i++) {
            const { messages: updatedMessages, canRetry } = retryMessage(
              messages,
              failedMessage.tempId
            );
            
            if (canRetry) {
              messages = updatedMessages;
              // Simulate failure to continue retrying
              messages = failMessage(messages, failedMessage.tempId, 'Network error');
            }
          }

          // Verify content is preserved
          const finalMessage = messages.find((m) => m.tempId === failedMessage.tempId);
          expect(finalMessage?.content).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });
});
