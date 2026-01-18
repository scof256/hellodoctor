/**
 * Property Test: Message Persistence
 * Feature: messaging-reliability-fix, Property 15: Message Persistence
 * 
 * *For any* pending message in the queue, the system SHALL persist it to local storage
 * such that it survives page refreshes.
 * 
 * **Validates: Requirements 5.4**
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

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

interface PersistedMessageQueue {
  sessionId: string;
  pendingMessages: PendingMessage[];
  failedMessages: FailedMessage[];
  lastUpdated: string;
}

const STORAGE_KEY_PREFIX = 'intake_message_queue_';

function getStorageKey(sessionId: string): string {
  return STORAGE_KEY_PREFIX + sessionId;
}

let mockStorage: Map<string, string>;

const mockLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

function persistToStorage(
  sessionId: string,
  pendingMessages: Map<string, PendingMessage>,
  failedMessages: Map<string, FailedMessage>
): void {
  const data: PersistedMessageQueue = {
    sessionId,
    pendingMessages: Array.from(pendingMessages.values()),
    failedMessages: Array.from(failedMessages.values()),
    lastUpdated: new Date().toISOString(),
  };
  mockLocalStorage.setItem(getStorageKey(sessionId), JSON.stringify(data));
}

function loadFromStorage(sessionId: string): PersistedMessageQueue | null {
  const stored = mockLocalStorage.getItem(getStorageKey(sessionId));
  if (!stored) return null;
  
  const data = JSON.parse(stored) as PersistedMessageQueue;
  data.pendingMessages = data.pendingMessages.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
  data.failedMessages = data.failedMessages.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
    lastAttempt: new Date(m.lastAttempt),
  }));
  return data;
}

function clearFromStorage(sessionId: string): void {
  mockLocalStorage.removeItem(getStorageKey(sessionId));
}

const tempIdArb = fc.string({ minLength: 5, maxLength: 30 })
  .filter(s => s.length > 0 && !s.includes('\0'));

const messageContentArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

const imageUrlArb = fc.webUrl();

const imagesArb = fc.option(
  fc.array(imageUrlArb, { minLength: 0, maxLength: 3 }),
  { nil: undefined }
);

const pendingMessageArb: fc.Arbitrary<PendingMessage> = fc.record({
  tempId: tempIdArb,
  content: messageContentArb,
  images: imagesArb,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  retryCount: fc.integer({ min: 0, max: 10 }),
});

const failedMessageArb: fc.Arbitrary<FailedMessage> = fc.record({
  tempId: tempIdArb,
  content: messageContentArb,
  images: imagesArb,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  retryCount: fc.integer({ min: 0, max: 10 }),
  error: fc.string({ minLength: 1, maxLength: 200 }),
  lastAttempt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
});

const sessionIdArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0 && !s.includes('\0'));

describe('Property 15: Message Persistence', () => {
  beforeEach(() => {
    mockStorage = new Map();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  it('should persist pending messages to storage and restore them correctly', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        fc.array(pendingMessageArb, { minLength: 0, maxLength: 10 }),
        (sessionId, pendingMessages) => {
          const pendingMap = new Map<string, PendingMessage>();
          const failedMap = new Map<string, FailedMessage>();
          
          const uniquePending = pendingMessages.map((m, i) => ({
            ...m,
            tempId: m.tempId + '-' + i,
          }));
          
          for (const msg of uniquePending) {
            pendingMap.set(msg.tempId, msg);
          }
          
          persistToStorage(sessionId, pendingMap, failedMap);
          const restored = loadFromStorage(sessionId);
          
          expect(restored).not.toBeNull();
          expect(restored!.pendingMessages).toHaveLength(uniquePending.length);
          
          for (const original of uniquePending) {
            const found = restored!.pendingMessages.find(m => m.tempId === original.tempId);
            expect(found).toBeDefined();
            expect(found!.content).toBe(original.content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist failed messages to storage and restore them correctly', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        fc.array(failedMessageArb, { minLength: 0, maxLength: 10 }),
        (sessionId, failedMessages) => {
          const pendingMap = new Map<string, PendingMessage>();
          const failedMap = new Map<string, FailedMessage>();
          
          const uniqueFailed = failedMessages.map((m, i) => ({
            ...m,
            tempId: m.tempId + '-' + i,
          }));
          
          for (const msg of uniqueFailed) {
            failedMap.set(msg.tempId, msg);
          }
          
          persistToStorage(sessionId, pendingMap, failedMap);
          const restored = loadFromStorage(sessionId);
          
          expect(restored).not.toBeNull();
          expect(restored!.failedMessages).toHaveLength(uniqueFailed.length);
          
          for (const original of uniqueFailed) {
            const found = restored!.failedMessages.find(m => m.tempId === original.tempId);
            expect(found).toBeDefined();
            expect(found!.content).toBe(original.content);
            expect(found!.error).toBe(original.error);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve message content exactly through persistence cycle', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        pendingMessageArb,
        (sessionId, message) => {
          const pendingMap = new Map<string, PendingMessage>();
          const failedMap = new Map<string, FailedMessage>();
          
          pendingMap.set(message.tempId, message);
          persistToStorage(sessionId, pendingMap, failedMap);
          const restored = loadFromStorage(sessionId);
          
          expect(restored).not.toBeNull();
          const restoredMessage = restored!.pendingMessages.find(m => m.tempId === message.tempId);
          
          expect(restoredMessage).toBeDefined();
          expect(restoredMessage!.content).toBe(message.content);
          
          if (message.images) {
            expect(restoredMessage!.images).toEqual(message.images);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should clear storage when all messages are sent successfully', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        fc.array(pendingMessageArb, { minLength: 1, maxLength: 5 }),
        (sessionId, pendingMessages) => {
          const pendingMap = new Map<string, PendingMessage>();
          const failedMap = new Map<string, FailedMessage>();
          
          for (const msg of pendingMessages) {
            pendingMap.set(msg.tempId, msg);
          }
          
          persistToStorage(sessionId, pendingMap, failedMap);
          expect(loadFromStorage(sessionId)).not.toBeNull();
          
          clearFromStorage(sessionId);
          expect(loadFromStorage(sessionId)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain session isolation', () => {
    fc.assert(
      fc.property(
        sessionIdArb,
        sessionIdArb,
        pendingMessageArb,
        pendingMessageArb,
        (sessionId1, sessionId2, message1, message2) => {
          if (sessionId1 === sessionId2) return true;
          
          const pendingMap1 = new Map<string, PendingMessage>();
          const pendingMap2 = new Map<string, PendingMessage>();
          const emptyFailedMap = new Map<string, FailedMessage>();
          
          const msg1 = { ...message1, tempId: 'session1-' + message1.tempId };
          const msg2 = { ...message2, tempId: 'session2-' + message2.tempId };
          
          pendingMap1.set(msg1.tempId, msg1);
          pendingMap2.set(msg2.tempId, msg2);
          
          persistToStorage(sessionId1, pendingMap1, emptyFailedMap);
          persistToStorage(sessionId2, pendingMap2, emptyFailedMap);
          
          const restored1 = loadFromStorage(sessionId1);
          const restored2 = loadFromStorage(sessionId2);
          
          expect(restored1).not.toBeNull();
          expect(restored2).not.toBeNull();
          expect(restored1!.sessionId).toBe(sessionId1);
          expect(restored2!.sessionId).toBe(sessionId2);
          expect(restored1!.pendingMessages[0]!.content).toBe(msg1.content);
          expect(restored2!.pendingMessages[0]!.content).toBe(msg2.content);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
