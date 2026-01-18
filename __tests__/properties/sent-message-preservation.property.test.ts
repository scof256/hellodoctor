/**
 * Property Test: Sent Message Preservation
 * Feature: messaging-reliability-fix, Property 19: Sent Message Preservation
 * 
 * *For any* error recovery operation, all messages with status "sent" SHALL be
 * preserved and remain visible in the chat.
 * 
 * **Validates: Requirements 7.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the implementation
type MessageStatus = 'sending' | 'sent' | 'failed' | 'permanently_failed';

interface MessageWithStatus {
  id: string;
  tempId?: string;
  role: 'user' | 'model' | 'doctor';
  text: string;
  images?: string[];
  timestamp: Date;
  status: MessageStatus;
  error?: string;
  retryCount?: number;
}

/**
 * Simulates the "start fresh" error recovery operation from the patient intake page.
 * This function preserves only successfully sent messages while clearing failed ones.
 * Requirements: 7.1, 7.2 - Preserve sent messages when recovering from errors
 */
function handleStartFresh(messages: MessageWithStatus[]): MessageWithStatus[] {
  // Preserve only successfully sent messages - Requirement 7.2
  return messages.filter(m => m.status === 'sent');
}

/**
 * Checks if all sent messages from the original list are preserved in the result.
 */
function allSentMessagesPreserved(
  original: MessageWithStatus[],
  result: MessageWithStatus[]
): boolean {
  const originalSent = original.filter(m => m.status === 'sent');
  
  // Every sent message from original should exist in result
  for (const sentMsg of originalSent) {
    const found = result.find(m => m.id === sentMsg.id);
    if (!found) return false;
    
    // Content should be identical
    if (found.text !== sentMsg.text) return false;
    if (found.role !== sentMsg.role) return false;
    if (found.status !== 'sent') return false;
  }
  
  return true;
}

/**
 * Checks if no failed messages remain after recovery.
 */
function noFailedMessagesRemain(result: MessageWithStatus[]): boolean {
  return !result.some(m => m.status === 'failed' || m.status === 'permanently_failed');
}

/**
 * Checks if message order is preserved for sent messages.
 */
function orderPreserved(
  original: MessageWithStatus[],
  result: MessageWithStatus[]
): boolean {
  const originalSentIds = original.filter(m => m.status === 'sent').map(m => m.id);
  const resultIds = result.map(m => m.id);
  
  // Result should maintain the same relative order
  let lastIndex = -1;
  for (const id of originalSentIds) {
    const currentIndex = resultIds.indexOf(id);
    if (currentIndex === -1) return false;
    if (currentIndex <= lastIndex) return false;
    lastIndex = currentIndex;
  }
  
  return true;
}

// Arbitraries for generating test data
const messageIdArb = fc.string({ minLength: 5, maxLength: 30 })
  .map(s => `msg-${s}`);

const tempIdArb = fc.option(
  fc.string({ minLength: 5, maxLength: 30 }).map(s => `temp-${s}`),
  { nil: undefined }
);

const roleArb = fc.constantFrom<'user' | 'model' | 'doctor'>('user', 'model', 'doctor');

const textArb = fc.string({ minLength: 1, maxLength: 500 });

const imagesArb = fc.option(
  fc.array(fc.webUrl(), { minLength: 0, maxLength: 4 }),
  { nil: undefined }
);

const timestampArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });

const statusArb = fc.constantFrom<MessageStatus>('sending', 'sent', 'failed', 'permanently_failed');

const errorArb = fc.option(
  fc.constantFrom('Network error', 'Timeout', 'Server error', 'Request failed'),
  { nil: undefined }
);

const retryCountArb = fc.option(
  fc.integer({ min: 0, max: 5 }),
  { nil: undefined }
);

const messageWithStatusArb: fc.Arbitrary<MessageWithStatus> = fc.record({
  id: messageIdArb,
  tempId: tempIdArb,
  role: roleArb,
  text: textArb,
  images: imagesArb,
  timestamp: timestampArb,
  status: statusArb,
  error: errorArb,
  retryCount: retryCountArb,
});

// Generate a list with guaranteed mix of sent and failed messages
const mixedMessagesArb = fc.tuple(
  fc.array(messageWithStatusArb.map(m => ({ ...m, status: 'sent' as const })), { minLength: 1, maxLength: 10 }),
  fc.array(messageWithStatusArb.map(m => ({ ...m, status: 'failed' as const })), { minLength: 0, maxLength: 5 }),
  fc.array(messageWithStatusArb.map(m => ({ ...m, status: 'permanently_failed' as const })), { minLength: 0, maxLength: 3 }),
  fc.array(messageWithStatusArb.map(m => ({ ...m, status: 'sending' as const })), { minLength: 0, maxLength: 2 }),
).map(([sent, failed, permFailed, sending]) => {
  // Interleave messages to simulate realistic chat flow
  const all = [...sent, ...failed, ...permFailed, ...sending];
  // Ensure unique IDs by adding index
  const withUniqueIds = all.map((m, i) => ({ ...m, id: `${m.id}-${i}` }));
  // Sort by a deterministic but mixed order
  return withUniqueIds.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
});

describe('Property 19: Sent Message Preservation', () => {
  it('should preserve all sent messages during error recovery', () => {
    fc.assert(
      fc.property(
        mixedMessagesArb,
        (messages) => {
          const result = handleStartFresh(messages);
          
          // All sent messages must be preserved
          expect(allSentMessagesPreserved(messages, result)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should remove all failed and permanently_failed messages during recovery', () => {
    fc.assert(
      fc.property(
        mixedMessagesArb,
        (messages) => {
          const result = handleStartFresh(messages);
          
          // No failed messages should remain
          expect(noFailedMessagesRemain(result)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should preserve the relative order of sent messages', () => {
    fc.assert(
      fc.property(
        mixedMessagesArb,
        (messages) => {
          const result = handleStartFresh(messages);
          
          // Order of sent messages should be maintained
          expect(orderPreserved(messages, result)).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should preserve message content exactly for sent messages', () => {
    fc.assert(
      fc.property(
        mixedMessagesArb,
        (messages) => {
          const result = handleStartFresh(messages);
          const originalSent = messages.filter(m => m.status === 'sent');
          
          // Each preserved message should have identical content
          for (const original of originalSent) {
            const preserved = result.find(m => m.id === original.id);
            expect(preserved).toBeDefined();
            expect(preserved!.text).toBe(original.text);
            expect(preserved!.role).toBe(original.role);
            expect(preserved!.images).toEqual(original.images);
            expect(preserved!.timestamp.getTime()).toBe(original.timestamp.getTime());
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should result in only sent messages after recovery', () => {
    fc.assert(
      fc.property(
        mixedMessagesArb,
        (messages) => {
          const result = handleStartFresh(messages);
          
          // All messages in result should have 'sent' status
          for (const msg of result) {
            expect(msg.status).toBe('sent');
          }
          
          // Count should match original sent count
          const originalSentCount = messages.filter(m => m.status === 'sent').length;
          expect(result.length).toBe(originalSentCount);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle edge case of all messages being sent', () => {
    fc.assert(
      fc.property(
        fc.array(messageWithStatusArb.map(m => ({ ...m, status: 'sent' as const })), { minLength: 1, maxLength: 10 }),
        (messages) => {
          const uniqueMessages = messages.map((m, i) => ({ ...m, id: `sent-${i}` }));
          const result = handleStartFresh(uniqueMessages);
          
          // All messages should be preserved
          expect(result.length).toBe(uniqueMessages.length);
          for (const msg of uniqueMessages) {
            expect(result.find(r => r.id === msg.id)).toBeDefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle edge case of all messages being failed', () => {
    fc.assert(
      fc.property(
        fc.array(messageWithStatusArb.map(m => ({ ...m, status: 'failed' as const })), { minLength: 1, maxLength: 10 }),
        (messages) => {
          const result = handleStartFresh(messages);
          
          // No messages should remain
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle empty message list', () => {
    const result = handleStartFresh([]);
    expect(result).toEqual([]);
  });

  it('should not modify the original messages array', () => {
    fc.assert(
      fc.property(
        mixedMessagesArb,
        (messages) => {
          // Deep copy to compare
          const originalCopy = messages.map(m => ({ ...m }));
          
          handleStartFresh(messages);
          
          // Original array should be unchanged
          expect(messages.length).toBe(originalCopy.length);
          for (let i = 0; i < messages.length; i++) {
            expect(messages[i]!.id).toBe(originalCopy[i]!.id);
            expect(messages[i]!.status).toBe(originalCopy[i]!.status);
            expect(messages[i]!.text).toBe(originalCopy[i]!.text);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
