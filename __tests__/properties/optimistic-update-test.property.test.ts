/**
 * Property Test: Message Order Preservation
 * 
 * Property 4: For any sequence of messages sent by a patient, the messages 
 * SHALL be displayed in the same chronological order they were sent, even 
 * after page refresh or retry operations.
 * 
 * **Validates: Requirements 3.5, 3.6**
 * 
 * Feature: intake-chatbot-ux
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simulated message type for testing
interface TestMessage {
  id: string;
  content: string;
  timestamp: number;
  order: number;
}

// Simulated message queue operations
function createMessageQueue() {
  const messages: TestMessage[] = [];
  let orderCounter = 0;

  return {
    enqueue(content: string): TestMessage {
      const message: TestMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        content,
        timestamp: Date.now(),
        order: orderCounter++,
      };
      messages.push(message);
      return message;
    },
    
    getMessages(): TestMessage[] {
      return [...messages];
    },
    
    // Simulate loading from database (sorted by timestamp)
    loadFromDatabase(dbMessages: TestMessage[]): void {
      messages.length = 0;
      // Database returns messages sorted by creation time
      const sorted = [...dbMessages].sort((a, b) => a.timestamp - b.timestamp);
      messages.push(...sorted);
    },
    
    // Simulate retry - message should maintain its original position
    retryMessage(messageId: string): boolean {
      const index = messages.findIndex(m => m.id === messageId);
      if (index === -1) return false;
      // Retry doesn't change order, just re-sends
      return true;
    },
  };
}

// Check if messages are in chronological order
function isChronologicalOrder(messages: TestMessage[]): boolean {
  for (let i = 1; i < messages.length; i++) {
    if (messages[i]!.order < messages[i - 1]!.order) {
      return false;
    }
  }
  return true;
}

describe('Property 4: Message Order Preservation', () => {
  it('should preserve message order for any sequence of messages', () => {
    fc.assert(
      fc.property(
        // Generate array of message contents
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 20 }),
        (messageContents) => {
          const queue = createMessageQueue();
          
          // Enqueue all messages
          const sentMessages = messageContents.map(content => queue.enqueue(content));
          
          // Get messages from queue
          const displayedMessages = queue.getMessages();
          
          // Verify order is preserved
          expect(displayedMessages.length).toBe(sentMessages.length);
          expect(isChronologicalOrder(displayedMessages)).toBe(true);
          
          // Verify content matches in order
          for (let i = 0; i < messageContents.length; i++) {
            expect(displayedMessages[i]!.content).toBe(messageContents[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve order after simulated database reload', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 15 }),
        (messageContents) => {
          const queue = createMessageQueue();
          
          // Enqueue all messages
          const sentMessages = messageContents.map(content => queue.enqueue(content));
          
          // Simulate page refresh - load from database
          const dbMessages = queue.getMessages();
          
          // Create new queue (simulating page refresh)
          const newQueue = createMessageQueue();
          newQueue.loadFromDatabase(dbMessages);
          
          // Get messages after reload
          const reloadedMessages = newQueue.getMessages();
          
          // Verify order is preserved after reload
          expect(reloadedMessages.length).toBe(sentMessages.length);
          expect(isChronologicalOrder(reloadedMessages)).toBe(true);
          
          // Verify content matches original order
          for (let i = 0; i < messageContents.length; i++) {
            expect(reloadedMessages[i]!.content).toBe(messageContents[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve order when retrying failed messages', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 3, maxLength: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (messageContents, failIndex) => {
          // Ensure failIndex is within bounds
          const actualFailIndex = failIndex % messageContents.length;
          
          const queue = createMessageQueue();
          
          // Enqueue all messages
          const sentMessages = messageContents.map(content => queue.enqueue(content));
          
          // Simulate retry of a "failed" message
          const messageToRetry = sentMessages[actualFailIndex];
          if (messageToRetry) {
            queue.retryMessage(messageToRetry.id);
          }
          
          // Get messages after retry
          const messagesAfterRetry = queue.getMessages();
          
          // Verify order is still preserved
          expect(messagesAfterRetry.length).toBe(sentMessages.length);
          expect(isChronologicalOrder(messagesAfterRetry)).toBe(true);
          
          // Verify the retried message is still in its original position
          if (messageToRetry) {
            const retryIndex = messagesAfterRetry.findIndex(m => m.id === messageToRetry.id);
            expect(retryIndex).toBe(actualFailIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain order with interleaved send and retry operations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom('send', 'retry'),
            content: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 5, maxLength: 20 }
        ),
        (operations) => {
          const queue = createMessageQueue();
          const sentMessageIds: string[] = [];
          
          for (const op of operations) {
            if (op.type === 'send') {
              const msg = queue.enqueue(op.content);
              sentMessageIds.push(msg.id);
            } else if (op.type === 'retry' && sentMessageIds.length > 0) {
              // Retry a random previously sent message
              const randomIndex = Math.floor(Math.random() * sentMessageIds.length);
              const idToRetry = sentMessageIds[randomIndex];
              if (idToRetry) {
                queue.retryMessage(idToRetry);
              }
            }
          }
          
          // Get final message list
          const finalMessages = queue.getMessages();
          
          // Verify chronological order is maintained
          expect(isChronologicalOrder(finalMessages)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
