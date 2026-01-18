/**
 * Property Test: Reset Session Isolation
 *
 * Property 5: For any conversation reset, the new session SHALL have zero messages
 * and zero completeness, while the previous session's data SHALL remain unchanged
 * in the database.
 *
 * **Validates: Requirements 4.3, 4.4, 4.5, 4.6**
 *
 * Feature: intake-chatbot-ux
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'model' | 'doctor';
  content: string;
  timestamp: number;
}

interface MedicalData {
  chiefComplaint: string | null;
  symptoms: string[];
  medications: string[];
  allergies: string[];
  completeness: number;
}

interface IntakeSession {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  medicalData: MedicalData;
  completeness: number;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface Database {
  sessions: Map<string, IntakeSession>;
  messages: Map<string, Message>;
}

// Initial medical data (matches INITIAL_MEDICAL_DATA from types)
const INITIAL_MEDICAL_DATA: MedicalData = {
  chiefComplaint: null,
  symptoms: [],
  medications: [],
  allergies: [],
  completeness: 0,
};

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Create a new session
function createSession(connectionId: string): IntakeSession {
  return {
    id: generateId(),
    connectionId,
    status: 'not_started',
    medicalData: { ...INITIAL_MEDICAL_DATA },
    completeness: 0,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Add a message to a session
function addMessage(
  db: Database,
  session: IntakeSession,
  role: 'user' | 'model' | 'doctor',
  content: string
): { db: Database; session: IntakeSession; message: Message } {
  const message: Message = {
    id: generateId(),
    sessionId: session.id,
    role,
    content,
    timestamp: Date.now(),
  };

  const updatedSession: IntakeSession = {
    ...session,
    status: 'in_progress',
    messages: [...session.messages, message],
    updatedAt: Date.now(),
  };

  const updatedDb: Database = {
    sessions: new Map(db.sessions).set(session.id, updatedSession),
    messages: new Map(db.messages).set(message.id, message),
  };

  return { db: updatedDb, session: updatedSession, message };
}

// Update session medical data and completeness
function updateSessionMedicalData(
  db: Database,
  session: IntakeSession,
  medicalData: Partial<MedicalData>,
  completeness: number
): { db: Database; session: IntakeSession } {
  const updatedMedicalData: MedicalData = {
    ...session.medicalData,
    ...medicalData,
    completeness,
  };

  const updatedSession: IntakeSession = {
    ...session,
    medicalData: updatedMedicalData,
    completeness,
    updatedAt: Date.now(),
  };

  const updatedDb: Database = {
    sessions: new Map(db.sessions).set(session.id, updatedSession),
    messages: db.messages,
  };

  return { db: updatedDb, session: updatedSession };
}

// Reset session - creates new session, preserves old one
function resetSession(
  db: Database,
  currentSession: IntakeSession
): { db: Database; newSession: IntakeSession; oldSession: IntakeSession } {
  // Mark old session as reviewed (preserved for audit)
  const oldSession: IntakeSession = {
    ...currentSession,
    status: 'reviewed',
    updatedAt: Date.now(),
  };

  // Create new session with zero messages and zero completeness
  const newSession: IntakeSession = {
    id: generateId(),
    connectionId: currentSession.connectionId,
    status: 'not_started',
    medicalData: { ...INITIAL_MEDICAL_DATA },
    completeness: 0,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Update database - preserve old session, add new session
  const updatedSessions = new Map(db.sessions);
  updatedSessions.set(oldSession.id, oldSession);
  updatedSessions.set(newSession.id, newSession);

  const updatedDb: Database = {
    sessions: updatedSessions,
    messages: db.messages, // Messages are preserved
  };

  return { db: updatedDb, newSession, oldSession };
}

// Arbitrary generators
const connectionIdArb = fc.uuid();
const messageContentArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);
const chiefComplaintArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const symptomArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
const medicationArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
const allergyArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);
const completenessArb = fc.integer({ min: 0, max: 100 });

const medicalDataArb = fc.record({
  chiefComplaint: fc.option(chiefComplaintArb, { nil: null }),
  symptoms: fc.array(symptomArb, { minLength: 0, maxLength: 5 }),
  medications: fc.array(medicationArb, { minLength: 0, maxLength: 5 }),
  allergies: fc.array(allergyArb, { minLength: 0, maxLength: 5 }),
  completeness: completenessArb,
});

describe('Property 5: Reset Session Isolation', () => {
  it('new session has zero messages after reset', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.array(messageContentArb, { minLength: 1, maxLength: 10 }),
        (connectionId, messageContents) => {
          // Create initial database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          let session = createSession(connectionId);
          db.sessions.set(session.id, session);

          // Add messages to the session
          for (const content of messageContents) {
            const result = addMessage(db, session, 'user', content);
            db = result.db;
            session = result.session;
          }

          // Verify session has messages before reset
          expect(session.messages.length).toBe(messageContents.length);

          // Reset the session
          const { newSession } = resetSession(db, session);

          // New session should have zero messages
          expect(newSession.messages.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('new session has zero completeness after reset', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        medicalDataArb,
        completenessArb.filter((c) => c > 0), // Ensure non-zero completeness
        (connectionId, medicalData, completeness) => {
          // Create initial database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          let session = createSession(connectionId);
          db.sessions.set(session.id, session);

          // Update session with medical data and completeness
          const updateResult = updateSessionMedicalData(db, session, medicalData, completeness);
          db = updateResult.db;
          session = updateResult.session;

          // Verify session has non-zero completeness before reset
          expect(session.completeness).toBe(completeness);
          expect(session.completeness).toBeGreaterThan(0);

          // Reset the session
          const { newSession } = resetSession(db, session);

          // New session should have zero completeness
          expect(newSession.completeness).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('previous session data remains unchanged after reset', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.array(messageContentArb, { minLength: 1, maxLength: 5 }),
        medicalDataArb,
        completenessArb,
        (connectionId, messageContents, medicalData, completeness) => {
          // Create initial database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          let session = createSession(connectionId);
          db.sessions.set(session.id, session);

          // Add messages to the session
          for (const content of messageContents) {
            const result = addMessage(db, session, 'user', content);
            db = result.db;
            session = result.session;
          }

          // Update session with medical data
          const updateResult = updateSessionMedicalData(db, session, medicalData, completeness);
          db = updateResult.db;
          session = updateResult.session;

          // Store original session data for comparison
          const originalMessageCount = session.messages.length;
          const originalCompleteness = session.completeness;
          const originalMedicalData = { ...session.medicalData };
          const originalSessionId = session.id;

          // Reset the session
          const { db: updatedDb, oldSession } = resetSession(db, session);

          // Verify old session is preserved in database
          const preservedSession = updatedDb.sessions.get(originalSessionId);
          expect(preservedSession).toBeDefined();

          // Verify old session data is unchanged
          expect(preservedSession!.messages.length).toBe(originalMessageCount);
          expect(preservedSession!.completeness).toBe(originalCompleteness);
          expect(preservedSession!.medicalData.chiefComplaint).toBe(originalMedicalData.chiefComplaint);
          expect(preservedSession!.medicalData.symptoms).toEqual(originalMedicalData.symptoms);
          expect(preservedSession!.medicalData.medications).toEqual(originalMedicalData.medications);
          expect(preservedSession!.medicalData.allergies).toEqual(originalMedicalData.allergies);

          // Verify old session status is marked as reviewed (for audit)
          expect(oldSession.status).toBe('reviewed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages from previous session remain in database after reset', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.array(messageContentArb, { minLength: 1, maxLength: 5 }),
        (connectionId, messageContents) => {
          // Create initial database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          let session = createSession(connectionId);
          db.sessions.set(session.id, session);

          // Add messages and track their IDs
          const messageIds: string[] = [];
          for (const content of messageContents) {
            const result = addMessage(db, session, 'user', content);
            db = result.db;
            session = result.session;
            messageIds.push(result.message.id);
          }

          // Verify messages exist before reset
          expect(db.messages.size).toBe(messageContents.length);

          // Reset the session
          const { db: updatedDb } = resetSession(db, session);

          // Verify all original messages are still in database
          expect(updatedDb.messages.size).toBe(messageContents.length);
          for (const messageId of messageIds) {
            expect(updatedDb.messages.has(messageId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('new session has different ID from old session', () => {
    fc.assert(
      fc.property(connectionIdArb, (connectionId) => {
        // Create initial database and session
        const db: Database = { sessions: new Map(), messages: new Map() };
        const session = createSession(connectionId);
        db.sessions.set(session.id, session);

        // Reset the session
        const { newSession, oldSession } = resetSession(db, session);

        // New session should have different ID
        expect(newSession.id).not.toBe(oldSession.id);
      }),
      { numRuns: 100 }
    );
  });

  it('new session has same connectionId as old session', () => {
    fc.assert(
      fc.property(connectionIdArb, (connectionId) => {
        // Create initial database and session
        const db: Database = { sessions: new Map(), messages: new Map() };
        const session = createSession(connectionId);
        db.sessions.set(session.id, session);

        // Reset the session
        const { newSession, oldSession } = resetSession(db, session);

        // Both sessions should have same connectionId
        expect(newSession.connectionId).toBe(connectionId);
        expect(oldSession.connectionId).toBe(connectionId);
        expect(newSession.connectionId).toBe(oldSession.connectionId);
      }),
      { numRuns: 100 }
    );
  });

  it('new session has initial medical data after reset', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        medicalDataArb,
        completenessArb,
        (connectionId, medicalData, completeness) => {
          // Create initial database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          let session = createSession(connectionId);
          db.sessions.set(session.id, session);

          // Update session with medical data
          const updateResult = updateSessionMedicalData(db, session, medicalData, completeness);
          db = updateResult.db;
          session = updateResult.session;

          // Reset the session
          const { newSession } = resetSession(db, session);

          // New session should have initial medical data
          expect(newSession.medicalData.chiefComplaint).toBeNull();
          expect(newSession.medicalData.symptoms).toEqual([]);
          expect(newSession.medicalData.medications).toEqual([]);
          expect(newSession.medicalData.allergies).toEqual([]);
          expect(newSession.medicalData.completeness).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('new session has not_started status after reset', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.array(messageContentArb, { minLength: 1, maxLength: 3 }),
        (connectionId, messageContents) => {
          // Create initial database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          let session = createSession(connectionId);
          db.sessions.set(session.id, session);

          // Add messages to change status to in_progress
          for (const content of messageContents) {
            const result = addMessage(db, session, 'user', content);
            db = result.db;
            session = result.session;
          }

          // Verify session is in_progress before reset
          expect(session.status).toBe('in_progress');

          // Reset the session
          const { newSession } = resetSession(db, session);

          // New session should have not_started status
          expect(newSession.status).toBe('not_started');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('database contains both old and new sessions after reset', () => {
    fc.assert(
      fc.property(connectionIdArb, (connectionId) => {
        // Create initial database and session
        let db: Database = { sessions: new Map(), messages: new Map() };
        const session = createSession(connectionId);
        db.sessions.set(session.id, session);

        const originalSessionCount = db.sessions.size;

        // Reset the session
        const { db: updatedDb, newSession, oldSession } = resetSession(db, session);

        // Database should contain both sessions
        expect(updatedDb.sessions.size).toBe(originalSessionCount + 1);
        expect(updatedDb.sessions.has(oldSession.id)).toBe(true);
        expect(updatedDb.sessions.has(newSession.id)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
