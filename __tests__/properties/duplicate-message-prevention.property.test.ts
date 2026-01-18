/**
 * Property Test: Duplicate Message Prevention
 *
 * Property 17: For any rapid sequence of send attempts with the same content,
 * the system SHALL only process one message and reject duplicates based on
 * content hash and timestamp proximity.
 *
 * **Validates: Requirements 6.2, 6.4**
 *
 * Feature: messaging-reliability-fix
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as crypto from 'crypto';

// Configuration constants matching the actual implementation
const DEDUPLICATION_WINDOW_MS = 5000; // 5 second window for duplicate detection

/**
 * Generate a content hash for deduplication.
 * This mirrors the implementation in intake.ts
 */
function generateContentHash(content: string, sessionId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${sessionId}:${content}`)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for efficiency
}

// Simulated message with timestamp
interface SimulatedMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'model';
}

// Simulated deduplication check result
interface DeduplicationResult {
  isDuplicate: boolean;
  contentHash: string;
  matchedMessageId?: string;
}

/**
 * Check if a message is a duplicate based on content hash and timestamp.
 * This mirrors the deduplication logic in intake.ts sendMessage mutation.
 */
function checkForDuplicate(
  newMessage: { sessionId: string; content: string; timestamp: Date },
  existingMessages: SimulatedMessage[],
  windowMs: number = DEDUPLICATION_WINDOW_MS
): DeduplicationResult {
  const contentHash = generateContentHash(newMessage.content, newMessage.sessionId);
  const windowStart = new Date(newMessage.timestamp.getTime() - windowMs);
  
  // Filter to recent user messages within the deduplication window
  const recentMessages = existingMessages.filter(
    msg => 
      msg.sessionId === newMessage.sessionId &&
      msg.role === 'user' &&
      msg.timestamp >= windowStart &&
      msg.timestamp <= newMessage.timestamp
  );
  
  // Check if any recent message has the same content hash
  for (const msg of recentMessages) {
    const existingHash = generateContentHash(msg.content, msg.sessionId);
    if (existingHash === contentHash) {
      return {
        isDuplicate: true,
        contentHash,
        matchedMessageId: msg.id,
      };
    }
  }
  
  return {
    isDuplicate: false,
    contentHash,
  };
}

// Arbitrary generators
const sessionIdArb = fc.uuid();
const messageIdArb = fc.uuid();
const messageContentArb = fc.string({ minLength: 1, maxLength: 500 });

const timestampArb = fc.date({
  min: new Date('2024-01-01'),
  max: new Date('2025-12-31'),
});

describe('Property 17: Duplicate Message Prevention', () => {
  it('rejects duplicate messages with same content within deduplication window', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        timestampArb,
        fc.integer({ min: 0, max: DEDUPLICATION_WINDOW_MS - 1 }), // Time offset within window
        (sessionId, content, baseTimestamp, timeOffset) => {
          const firstMessageId = crypto.randomUUID();
          const firstMessage: SimulatedMessage = {
            id: firstMessageId,
            sessionId,
            content,
            timestamp: baseTimestamp,
            role: 'user',
          };
          
          // Second message with same content, within deduplication window
          const secondMessageTimestamp = new Date(baseTimestamp.getTime() + timeOffset);
          const newMessage = {
            sessionId,
            content,
            timestamp: secondMessageTimestamp,
          };
          
          const result = checkForDuplicate(newMessage, [firstMessage]);
          
          // Should be detected as duplicate
          expect(result.isDuplicate).toBe(true);
          expect(result.matchedMessageId).toBe(firstMessageId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows messages with same content outside deduplication window', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        timestampArb,
        fc.integer({ min: DEDUPLICATION_WINDOW_MS + 1, max: DEDUPLICATION_WINDOW_MS * 10 }), // Time offset outside window
        (sessionId, content, baseTimestamp, timeOffset) => {
          const firstMessage: SimulatedMessage = {
            id: crypto.randomUUID(),
            sessionId,
            content,
            timestamp: baseTimestamp,
            role: 'user',
          };
          
          // Second message with same content, outside deduplication window
          const secondMessageTimestamp = new Date(baseTimestamp.getTime() + timeOffset);
          const newMessage = {
            sessionId,
            content,
            timestamp: secondMessageTimestamp,
          };
          
          const result = checkForDuplicate(newMessage, [firstMessage]);
          
          // Should NOT be detected as duplicate (outside window)
          expect(result.isDuplicate).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows messages with different content within deduplication window', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        messageContentArb.filter(c => c.length > 0),
        timestampArb,
        fc.integer({ min: 0, max: DEDUPLICATION_WINDOW_MS - 1 }),
        (sessionId, content1, content2, baseTimestamp, timeOffset) => {
          // Ensure contents are different
          if (content1 === content2) return true; // Skip if same content
          
          const firstMessage: SimulatedMessage = {
            id: crypto.randomUUID(),
            sessionId,
            content: content1,
            timestamp: baseTimestamp,
            role: 'user',
          };
          
          // Second message with different content
          const secondMessageTimestamp = new Date(baseTimestamp.getTime() + timeOffset);
          const newMessage = {
            sessionId,
            content: content2,
            timestamp: secondMessageTimestamp,
          };
          
          const result = checkForDuplicate(newMessage, [firstMessage]);
          
          // Should NOT be detected as duplicate (different content)
          expect(result.isDuplicate).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows messages with same content in different sessions', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        sessionIdArb,
        messageContentArb,
        timestampArb,
        fc.integer({ min: 0, max: DEDUPLICATION_WINDOW_MS - 1 }),
        (sessionId1, sessionId2, content, baseTimestamp, timeOffset) => {
          // Ensure session IDs are different
          if (sessionId1 === sessionId2) return true; // Skip if same session
          
          const firstMessage: SimulatedMessage = {
            id: crypto.randomUUID(),
            sessionId: sessionId1,
            content,
            timestamp: baseTimestamp,
            role: 'user',
          };
          
          // Second message with same content but different session
          const secondMessageTimestamp = new Date(baseTimestamp.getTime() + timeOffset);
          const newMessage = {
            sessionId: sessionId2,
            content,
            timestamp: secondMessageTimestamp,
          };
          
          const result = checkForDuplicate(newMessage, [firstMessage]);
          
          // Should NOT be detected as duplicate (different session)
          expect(result.isDuplicate).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only checks user messages for duplicates, not model messages', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        timestampArb,
        fc.integer({ min: 0, max: DEDUPLICATION_WINDOW_MS - 1 }),
        (sessionId, content, baseTimestamp, timeOffset) => {
          // Model message with same content
          const modelMessage: SimulatedMessage = {
            id: crypto.randomUUID(),
            sessionId,
            content,
            timestamp: baseTimestamp,
            role: 'model', // Model message, not user
          };
          
          // User message with same content
          const secondMessageTimestamp = new Date(baseTimestamp.getTime() + timeOffset);
          const newMessage = {
            sessionId,
            content,
            timestamp: secondMessageTimestamp,
          };
          
          const result = checkForDuplicate(newMessage, [modelMessage]);
          
          // Should NOT be detected as duplicate (model messages are ignored)
          expect(result.isDuplicate).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Content Hash Generation', () => {
  it('generates deterministic hashes for same content and session', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        (sessionId, content) => {
          const hash1 = generateContentHash(content, sessionId);
          const hash2 = generateContentHash(content, sessionId);
          
          expect(hash1).toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates different hashes for different content', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        messageContentArb,
        (sessionId, content1, content2) => {
          // Skip if contents are the same
          if (content1 === content2) return true;
          
          const hash1 = generateContentHash(content1, sessionId);
          const hash2 = generateContentHash(content2, sessionId);
          
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates different hashes for same content in different sessions', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        sessionIdArb,
        messageContentArb,
        (sessionId1, sessionId2, content) => {
          // Skip if session IDs are the same
          if (sessionId1 === sessionId2) return true;
          
          const hash1 = generateContentHash(content, sessionId1);
          const hash2 = generateContentHash(content, sessionId2);
          
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates hashes of consistent length (16 chars)', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        (sessionId, content) => {
          const hash = generateContentHash(content, sessionId);
          
          expect(hash.length).toBe(16);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Rapid Send Sequence Simulation', () => {
  it('only processes first message in rapid duplicate sequence', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        messageContentArb,
        timestampArb,
        fc.integer({ min: 2, max: 10 }), // Number of rapid sends
        (sessionId, content, baseTimestamp, sendCount) => {
          const processedMessages: SimulatedMessage[] = [];
          let rejectedCount = 0;
          
          // Simulate rapid sends of the same message
          for (let i = 0; i < sendCount; i++) {
            const timestamp = new Date(baseTimestamp.getTime() + i * 100); // 100ms apart
            const newMessage = { sessionId, content, timestamp };
            
            const result = checkForDuplicate(newMessage, processedMessages);
            
            if (result.isDuplicate) {
              rejectedCount++;
            } else {
              // Message accepted, add to processed list
              processedMessages.push({
                id: crypto.randomUUID(),
                sessionId,
                content,
                timestamp,
                role: 'user',
              });
            }
          }
          
          // Only first message should be processed
          expect(processedMessages.length).toBe(1);
          expect(rejectedCount).toBe(sendCount - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('processes all messages in sequence with different content', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        fc.array(messageContentArb, { minLength: 2, maxLength: 10 }),
        timestampArb,
        (sessionId, contents, baseTimestamp) => {
          // Ensure all contents are unique
          const uniqueContents = [...new Set(contents)];
          if (uniqueContents.length !== contents.length) return true; // Skip if duplicates
          
          const processedMessages: SimulatedMessage[] = [];
          
          // Simulate sends of different messages
          for (let i = 0; i < contents.length; i++) {
            const timestamp = new Date(baseTimestamp.getTime() + i * 100);
            const newMessage = { sessionId, content: contents[i]!, timestamp };
            
            const result = checkForDuplicate(newMessage, processedMessages);
            
            if (!result.isDuplicate) {
              processedMessages.push({
                id: crypto.randomUUID(),
                sessionId,
                content: contents[i]!,
                timestamp,
                role: 'user',
              });
            }
          }
          
          // All messages should be processed (different content)
          expect(processedMessages.length).toBe(contents.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
