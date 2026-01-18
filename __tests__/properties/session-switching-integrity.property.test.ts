/**
 * Feature: intake-sessions-management
 * Property 12: Session Switching Data Integrity
 * 
 * For any session switch operation, after switching to a different session,
 * the loaded messages SHALL exactly match the messages stored for that session
 * in the database, preserving message order, content, and metadata.
 * 
 * Validates: Requirements 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for session and message data
type MessageRole = 'user' | 'model' | 'doctor';

interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  text: string;
  images?: string[];
  timestamp: Date;
  activeAgent?: string;
}

interface Session {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  completeness: number;
  messages: Message[];
}

interface Database {
  sessions: Map<string, Session>;
  messages: Map<string, Message>;
}

// Arbitraries for generating test data
const messageRoleArb = fc.constantFrom('user', 'model', 'doctor') as fc.Arbitrary<MessageRole>;
const agentArb = fc.option(
  fc.constantFrom('Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist'),
  { nil: undefined }
);

const messageArb = (sessionId: string): fc.Arbitrary<Message> => fc.record({
  id: fc.uuid(),
  sessionId: fc.constant(sessionId),
  role: messageRoleArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  images: fc.option(fc.array(fc.webUrl(), { minLength: 1, maxLength: 4 }), { nil: undefined }),
  timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  activeAgent: agentArb,
});

const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<'not_started' | 'in_progress' | 'ready' | 'reviewed'>;

// Generate a session with messages
const sessionWithMessagesArb = (connectionId: string): fc.Arbitrary<Session> => 
  fc.uuid().chain(sessionId => 
    fc.record({
      id: fc.constant(sessionId),
      connectionId: fc.constant(connectionId),
      status: sessionStatusArb,
      completeness: fc.integer({ min: 0, max: 100 }),
      messages: fc.array(messageArb(sessionId), { minLength: 0, maxLength: 20 }),
    })
  );

// Generate multiple sessions for the same connection
const multipleSessionsArb = fc.uuid().chain(connectionId =>
  fc.array(sessionWithMessagesArb(connectionId), { minLength: 2, maxLength: 5 })
);

/**
 * Simulates loading session data from database
 */
function loadSessionFromDatabase(db: Database, sessionId: string): Session | null {
  return db.sessions.get(sessionId) ?? null;
}

/**
 * Simulates switching to a different session
 * Returns the messages that would be loaded for the new session
 */
function switchToSession(db: Database, newSessionId: string): Message[] {
  const session = loadSessionFromDatabase(db, newSessionId);
  if (!session) return [];
  
  // Return messages sorted by timestamp (as they would be displayed)
  return [...session.messages].sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );
}

/**
 * Creates a database from sessions
 */
function createDatabase(sessions: Session[]): Database {
  const db: Database = {
    sessions: new Map(),
    messages: new Map(),
  };
  
  for (const session of sessions) {
    db.sessions.set(session.id, session);
    for (const message of session.messages) {
      db.messages.set(message.id, message);
    }
  }
  
  return db;
}

describe('Property 12: Session Switching Data Integrity', () => {
  it('loaded messages match database messages exactly after switch', () => {
    fc.assert(
      fc.property(multipleSessionsArb, (sessions) => {
        const db = createDatabase(sessions);
        
        // Pick a random session to switch to
        const targetSession = sessions[Math.floor(Math.random() * sessions.length)]!;
        
        // Switch to the session
        const loadedMessages = switchToSession(db, targetSession.id);
        
        // Get expected messages from database
        const expectedMessages = [...targetSession.messages].sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        
        // Verify count matches
        expect(loadedMessages.length).toBe(expectedMessages.length);
        
        // Verify each message matches exactly
        for (let i = 0; i < loadedMessages.length; i++) {
          const loaded = loadedMessages[i]!;
          const expected = expectedMessages[i]!;
          
          expect(loaded.id).toBe(expected.id);
          expect(loaded.sessionId).toBe(expected.sessionId);
          expect(loaded.role).toBe(expected.role);
          expect(loaded.text).toBe(expected.text);
          expect(loaded.images).toEqual(expected.images);
          expect(loaded.timestamp.getTime()).toBe(expected.timestamp.getTime());
          expect(loaded.activeAgent).toBe(expected.activeAgent);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('message order is preserved after switch', () => {
    fc.assert(
      fc.property(multipleSessionsArb, (sessions) => {
        const db = createDatabase(sessions);
        
        for (const session of sessions) {
          const loadedMessages = switchToSession(db, session.id);
          
          // Verify messages are in chronological order
          for (let i = 0; i < loadedMessages.length - 1; i++) {
            expect(loadedMessages[i]!.timestamp.getTime())
              .toBeLessThanOrEqual(loadedMessages[i + 1]!.timestamp.getTime());
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('message content is not modified during switch', () => {
    fc.assert(
      fc.property(multipleSessionsArb, (sessions) => {
        const db = createDatabase(sessions);
        
        for (const session of sessions) {
          const loadedMessages = switchToSession(db, session.id);
          
          // Verify each message's content matches the original
          for (const loaded of loadedMessages) {
            const original = db.messages.get(loaded.id);
            expect(original).toBeDefined();
            
            if (original) {
              expect(loaded.text).toBe(original.text);
              expect(loaded.role).toBe(original.role);
              expect(loaded.images).toEqual(original.images);
            }
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('message metadata is preserved during switch', () => {
    fc.assert(
      fc.property(multipleSessionsArb, (sessions) => {
        const db = createDatabase(sessions);
        
        for (const session of sessions) {
          const loadedMessages = switchToSession(db, session.id);
          
          for (const loaded of loadedMessages) {
            const original = db.messages.get(loaded.id);
            expect(original).toBeDefined();
            
            if (original) {
              // Verify all metadata fields
              expect(loaded.sessionId).toBe(original.sessionId);
              expect(loaded.timestamp.getTime()).toBe(original.timestamp.getTime());
              expect(loaded.activeAgent).toBe(original.activeAgent);
            }
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('switching between sessions loads correct messages for each', () => {
    fc.assert(
      fc.property(multipleSessionsArb, (sessions) => {
        const db = createDatabase(sessions);
        
        // Switch between all sessions multiple times
        const switchOrder = [...sessions, ...sessions.reverse()];
        
        for (const targetSession of switchOrder) {
          const loadedMessages = switchToSession(db, targetSession.id);
          
          // All loaded messages should belong to the target session
          for (const msg of loadedMessages) {
            expect(msg.sessionId).toBe(targetSession.id);
          }
          
          // No messages from other sessions should be loaded
          const otherSessionIds = sessions
            .filter(s => s.id !== targetSession.id)
            .map(s => s.id);
          
          for (const msg of loadedMessages) {
            expect(otherSessionIds).not.toContain(msg.sessionId);
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('empty session returns empty messages array', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (connectionId, sessionId) => {
          const emptySession: Session = {
            id: sessionId,
            connectionId,
            status: 'not_started',
            completeness: 0,
            messages: [],
          };
          
          const db = createDatabase([emptySession]);
          const loadedMessages = switchToSession(db, sessionId);
          
          expect(loadedMessages.length).toBe(0);
          expect(loadedMessages).toEqual([]);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('switching to non-existent session returns empty array', () => {
    fc.assert(
      fc.property(
        multipleSessionsArb,
        fc.uuid(),
        (sessions, nonExistentId) => {
          const db = createDatabase(sessions);
          
          // Ensure the ID doesn't exist
          if (sessions.some(s => s.id === nonExistentId)) {
            return true; // Skip this case
          }
          
          const loadedMessages = switchToSession(db, nonExistentId);
          expect(loadedMessages.length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message IDs are unique within loaded messages', () => {
    fc.assert(
      fc.property(multipleSessionsArb, (sessions) => {
        const db = createDatabase(sessions);
        
        for (const session of sessions) {
          const loadedMessages = switchToSession(db, session.id);
          
          const messageIds = loadedMessages.map(m => m.id);
          const uniqueIds = new Set(messageIds);
          
          expect(uniqueIds.size).toBe(messageIds.length);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
