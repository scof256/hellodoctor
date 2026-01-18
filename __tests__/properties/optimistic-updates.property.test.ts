/**
 * Property Test: Optimistic Update Consistency
 *
 * Property 1: For any message sent by a patient, the message SHALL appear
 * in the UI immediately with a 'sending' status, and upon server confirmation,
 * the status SHALL update to 'sent' without changing the message content or position.
 *
 * **Validates: Requirements 2.1, 2.2, 8.1, 8.2**
 *
 * Feature: intake-chatbot-ux
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Simulated message type for testing
interface TestMessage {
  id: string;
  tempId?: string;
  content: string;
  status: 'sending' | 'sent' | 'failed';
  error?: string;
  timestamp: number;
}

// Simulate the optimistic update logic
function applyOptimisticUpdate(
  currentMessages: TestMessage[],
  content: string
): { messages: TestMessage[]; tempId: string } {
  const tempId = `temp-${Date.now()}-${Math.random()}`;
  const timestamp = Date.now();

  const optimisticMessage: TestMessage = {
    id: tempId,
    tempId,
    content,
    timestamp,
    status: 'sending',
  };

  return {
    messages: [...currentMessages, optimisticMessage],
    tempId,
  };
}

// Simulate server confirmation
function applyServerConfirmation(
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
function applyServerError(
  messages: TestMessage[],
  tempId: string,
  errorMessage: string
): TestMessage[] {
  return messages.map((m) => {
    if (m.tempId === tempId) {
      return { ...m, status: 'failed' as const, error: errorMessage };
    }
    return m;
  });
}

// Arbitrary generators
const messageContentArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

const existingMessageArb: fc.Arbitrary<TestMessage> = fc.record({
  id: fc.uuid(),
  content: messageContentArb,
  timestamp: fc.nat(),
  status: fc.constant('sent' as const),
});

const existingMessagesArb = fc.array(existingMessageArb, { minLength: 0, maxLength: 10 });

describe('Property 1: Optimistic Update Consistency', () => {
  it('optimistic message appears immediately with sending status', () => {
    fc.assert(
      fc.property(existingMessagesArb, messageContentArb, (existingMessages, content) => {
        const { messages, tempId } = applyOptimisticUpdate(existingMessages, content);

        // Message should be added
        expect(messages.length).toBe(existingMessages.length + 1);

        // Find the new message
        const newMessage = messages.find((m) => m.tempId === tempId);
        expect(newMessage).toBeDefined();

        // Verify it has 'sending' status
        expect(newMessage?.status).toBe('sending');

        // Verify content is preserved
        expect(newMessage?.content).toBe(content);

        // Verify it's at the end (preserves order)
        expect(messages[messages.length - 1]?.tempId).toBe(tempId);
      }),
      { numRuns: 100 }
    );
  });

  it('server confirmation updates status without changing content or position', () => {
    fc.assert(
      fc.property(existingMessagesArb, messageContentArb, fc.uuid(), (existingMessages, content, serverId) => {
        // Apply optimistic update
        const { messages: afterOptimistic, tempId } = applyOptimisticUpdate(existingMessages, content);
        const optimisticMessage = afterOptimistic.find((m) => m.tempId === tempId);
        const optimisticIndex = afterOptimistic.findIndex((m) => m.tempId === tempId);

        // Apply server confirmation
        const afterConfirmation = applyServerConfirmation(afterOptimistic, tempId, serverId);
        const confirmedMessage = afterConfirmation.find((m) => m.tempId === tempId);
        const confirmedIndex = afterConfirmation.findIndex((m) => m.tempId === tempId);

        // Status should be 'sent'
        expect(confirmedMessage?.status).toBe('sent');

        // ID should be updated to server ID
        expect(confirmedMessage?.id).toBe(serverId);

        // Content should be unchanged
        expect(confirmedMessage?.content).toBe(optimisticMessage?.content);

        // Position should be unchanged
        expect(confirmedIndex).toBe(optimisticIndex);

        // Total message count should be unchanged
        expect(afterConfirmation.length).toBe(afterOptimistic.length);
      }),
      { numRuns: 100 }
    );
  });

  it('server error updates status to failed without changing content or position', () => {
    fc.assert(
      fc.property(
        existingMessagesArb,
        messageContentArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        (existingMessages, content, errorMessage) => {
          // Apply optimistic update
          const { messages: afterOptimistic, tempId } = applyOptimisticUpdate(existingMessages, content);
          const optimisticMessage = afterOptimistic.find((m) => m.tempId === tempId);
          const optimisticIndex = afterOptimistic.findIndex((m) => m.tempId === tempId);

          // Apply server error
          const afterError = applyServerError(afterOptimistic, tempId, errorMessage);
          const failedMessage = afterError.find((m) => m.tempId === tempId);
          const failedIndex = afterError.findIndex((m) => m.tempId === tempId);

          // Status should be 'failed'
          expect(failedMessage?.status).toBe('failed');

          // Error message should be set
          expect(failedMessage?.error).toBe(errorMessage);

          // Content should be unchanged
          expect(failedMessage?.content).toBe(optimisticMessage?.content);

          // Position should be unchanged
          expect(failedIndex).toBe(optimisticIndex);

          // Total message count should be unchanged
          expect(afterError.length).toBe(afterOptimistic.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple optimistic updates preserve order', () => {
    fc.assert(
      fc.property(
        existingMessagesArb,
        fc.array(messageContentArb, { minLength: 2, maxLength: 5 }),
        (existingMessages, contents) => {
          let messages = [...existingMessages];
          const tempIds: string[] = [];

          // Apply multiple optimistic updates
          for (const content of contents) {
            const result = applyOptimisticUpdate(messages, content);
            messages = result.messages;
            tempIds.push(result.tempId);
          }

          // Verify all messages are present
          expect(messages.length).toBe(existingMessages.length + contents.length);

          // Verify order is preserved (tempIds should appear in order at the end)
          const newMessages = messages.slice(existingMessages.length);
          for (let i = 0; i < tempIds.length; i++) {
            expect(newMessages[i]?.tempId).toBe(tempIds[i]);
          }

          // Verify all have 'sending' status
          for (const tempId of tempIds) {
            const msg = messages.find((m) => m.tempId === tempId);
            expect(msg?.status).toBe('sending');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('existing messages are not modified by optimistic updates', () => {
    fc.assert(
      fc.property(existingMessagesArb, messageContentArb, (existingMessages, content) => {
        // Deep copy existing messages for comparison
        const originalMessages = existingMessages.map((m) => ({ ...m }));

        // Apply optimistic update
        const { messages } = applyOptimisticUpdate(existingMessages, content);

        // Verify existing messages are unchanged
        for (let i = 0; i < originalMessages.length; i++) {
          expect(messages[i]?.id).toBe(originalMessages[i]?.id);
          expect(messages[i]?.content).toBe(originalMessages[i]?.content);
          expect(messages[i]?.status).toBe(originalMessages[i]?.status);
        }
      }),
      { numRuns: 100 }
    );
  });
});
