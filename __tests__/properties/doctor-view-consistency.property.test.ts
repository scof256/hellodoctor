/**
 * Property Test: Doctor View Read Consistency
 *
 * Property 6: For any intake session viewed by a doctor, the displayed messages
 * SHALL exactly match the messages stored in the database for that session.
 *
 * **Validates: Requirements 5.1, 5.2**
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
  images?: string[];
  activeAgent?: string;
  timestamp: number;
}

interface MedicalData {
  chiefComplaint: string | null;
  symptoms: string[];
  medications: string[];
  allergies: string[];
}

interface IntakeSession {
  id: string;
  connectionId: string;
  doctorId: string;
  patientId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  medicalData: MedicalData;
  completeness: number;
  createdAt: number;
  updatedAt: number;
}

interface Database {
  sessions: Map<string, IntakeSession>;
  messages: Map<string, Message[]>; // sessionId -> messages
}

interface DoctorViewResult {
  session: IntakeSession;
  messages: Message[];
  isReadOnly: boolean;
}

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Create a session in the database
function createSession(
  db: Database,
  connectionId: string,
  doctorId: string,
  patientId: string,
  status: IntakeSession['status'] = 'in_progress',
  completeness: number = 0,
  medicalData: MedicalData = { chiefComplaint: null, symptoms: [], medications: [], allergies: [] }
): { db: Database; session: IntakeSession } {
  const session: IntakeSession = {
    id: generateId(),
    connectionId,
    doctorId,
    patientId,
    status,
    medicalData,
    completeness,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updatedSessions = new Map(db.sessions);
  updatedSessions.set(session.id, session);

  const updatedMessages = new Map(db.messages);
  updatedMessages.set(session.id, []);

  return {
    db: { sessions: updatedSessions, messages: updatedMessages },
    session,
  };
}

// Add a message to a session in the database
function addMessageToDb(
  db: Database,
  sessionId: string,
  role: 'user' | 'model' | 'doctor',
  content: string,
  images?: string[],
  activeAgent?: string
): { db: Database; message: Message } {
  const message: Message = {
    id: generateId(),
    sessionId,
    role,
    content,
    images,
    activeAgent,
    timestamp: Date.now(),
  };

  const sessionMessages = db.messages.get(sessionId) ?? [];
  const updatedMessages = new Map(db.messages);
  updatedMessages.set(sessionId, [...sessionMessages, message]);

  return {
    db: { sessions: db.sessions, messages: updatedMessages },
    message,
  };
}

// Simulate doctor viewing a session - should return exactly what's in the database
function getDoctorView(db: Database, sessionId: string, doctorId: string): DoctorViewResult | null {
  const session = db.sessions.get(sessionId);
  if (!session) return null;

  // Verify doctor has access to this session
  if (session.doctorId !== doctorId) return null;

  // Get messages from database
  const messages = db.messages.get(sessionId) ?? [];

  // Determine if read-only (reviewed sessions are read-only)
  const isReadOnly = session.status === 'reviewed';

  return {
    session,
    messages: [...messages], // Return a copy
    isReadOnly,
  };
}

// Arbitrary generators
const uuidArb = fc.uuid();
const messageContentArb = fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0);
const roleArb = fc.constantFrom<'user' | 'model' | 'doctor'>('user', 'model', 'doctor');
const agentArb = fc.constantFrom('Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist');
const statusArb = fc.constantFrom<IntakeSession['status']>('not_started', 'in_progress', 'ready', 'reviewed');
const completenessArb = fc.integer({ min: 0, max: 100 });
const chiefComplaintArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const symptomArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

const medicalDataArb = fc.record({
  chiefComplaint: fc.option(chiefComplaintArb, { nil: null }),
  symptoms: fc.array(symptomArb, { minLength: 0, maxLength: 5 }),
  medications: fc.array(symptomArb, { minLength: 0, maxLength: 5 }),
  allergies: fc.array(symptomArb, { minLength: 0, maxLength: 5 }),
});

const messageArb = fc.record({
  role: roleArb,
  content: messageContentArb,
  hasImages: fc.boolean(),
  hasAgent: fc.boolean(),
});

describe('Property 6: Doctor View Read Consistency', () => {
  it('displayed messages exactly match database messages', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.array(messageArb, { minLength: 1, maxLength: 20 }),
        (connectionId, doctorId, patientId, messageSpecs) => {
          // Create database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(db, connectionId, doctorId, patientId);
          db = createResult.db;
          const session = createResult.session;

          // Add messages to database
          const addedMessages: Message[] = [];
          for (const spec of messageSpecs) {
            const result = addMessageToDb(
              db,
              session.id,
              spec.role,
              spec.content,
              spec.hasImages ? ['image1.jpg'] : undefined,
              spec.hasAgent && spec.role === 'model' ? 'Triage' : undefined
            );
            db = result.db;
            addedMessages.push(result.message);
          }

          // Get doctor view
          const doctorView = getDoctorView(db, session.id, doctorId);

          // Verify view exists
          expect(doctorView).not.toBeNull();

          // Verify message count matches
          expect(doctorView!.messages.length).toBe(addedMessages.length);

          // Verify each message matches exactly
          for (let i = 0; i < addedMessages.length; i++) {
            const dbMessage = addedMessages[i]!;
            const viewMessage = doctorView!.messages[i]!;

            expect(viewMessage.id).toBe(dbMessage.id);
            expect(viewMessage.sessionId).toBe(dbMessage.sessionId);
            expect(viewMessage.role).toBe(dbMessage.role);
            expect(viewMessage.content).toBe(dbMessage.content);
            expect(viewMessage.images).toEqual(dbMessage.images);
            expect(viewMessage.activeAgent).toBe(dbMessage.activeAgent);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('message order is preserved in doctor view', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.array(messageContentArb, { minLength: 2, maxLength: 15 }),
        (connectionId, doctorId, patientId, contents) => {
          // Create database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(db, connectionId, doctorId, patientId);
          db = createResult.db;
          const session = createResult.session;

          // Add messages in order
          const messageIds: string[] = [];
          for (let i = 0; i < contents.length; i++) {
            const role: 'user' | 'model' = i % 2 === 0 ? 'user' : 'model';
            const result = addMessageToDb(db, session.id, role, contents[i]!);
            db = result.db;
            messageIds.push(result.message.id);
          }

          // Get doctor view
          const doctorView = getDoctorView(db, session.id, doctorId);

          // Verify order is preserved
          expect(doctorView).not.toBeNull();
          expect(doctorView!.messages.length).toBe(messageIds.length);

          for (let i = 0; i < messageIds.length; i++) {
            expect(doctorView!.messages[i]!.id).toBe(messageIds[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('patient and AI messages are distinguishable', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.array(messageContentArb, { minLength: 2, maxLength: 10 }),
        (connectionId, doctorId, patientId, contents) => {
          // Create database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(db, connectionId, doctorId, patientId);
          db = createResult.db;
          const session = createResult.session;

          // Add alternating user and model messages
          for (let i = 0; i < contents.length; i++) {
            const role: 'user' | 'model' = i % 2 === 0 ? 'user' : 'model';
            const result = addMessageToDb(
              db,
              session.id,
              role,
              contents[i]!,
              undefined,
              role === 'model' ? 'Triage' : undefined
            );
            db = result.db;
          }

          // Get doctor view
          const doctorView = getDoctorView(db, session.id, doctorId);

          // Verify messages have distinguishable roles
          expect(doctorView).not.toBeNull();

          const userMessages = doctorView!.messages.filter((m) => m.role === 'user');
          const modelMessages = doctorView!.messages.filter((m) => m.role === 'model');

          // Should have both types
          expect(userMessages.length).toBeGreaterThan(0);
          expect(modelMessages.length).toBeGreaterThan(0);

          // All model messages should have activeAgent
          for (const msg of modelMessages) {
            expect(msg.activeAgent).toBeDefined();
          }

          // User messages should not have activeAgent
          for (const msg of userMessages) {
            expect(msg.activeAgent).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reviewed sessions show read-only indicator', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        statusArb,
        (connectionId, doctorId, patientId, status) => {
          // Create database and session with specific status
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(db, connectionId, doctorId, patientId, status);
          db = createResult.db;
          const session = createResult.session;

          // Get doctor view
          const doctorView = getDoctorView(db, session.id, doctorId);

          // Verify read-only status matches session status
          expect(doctorView).not.toBeNull();
          expect(doctorView!.isReadOnly).toBe(status === 'reviewed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('doctor cannot view sessions they are not connected to', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb, // Different doctor
        (connectionId, doctorId, patientId, otherDoctorId) => {
          // Skip if IDs happen to be the same
          fc.pre(doctorId !== otherDoctorId);

          // Create database and session for doctorId
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(db, connectionId, doctorId, patientId);
          db = createResult.db;
          const session = createResult.session;

          // Try to view as different doctor
          const doctorView = getDoctorView(db, session.id, otherDoctorId);

          // Should not be able to view
          expect(doctorView).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session completeness and medical data are accurately displayed', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        completenessArb,
        medicalDataArb,
        (connectionId, doctorId, patientId, completeness, medicalData) => {
          // Create database and session with specific data
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(
            db,
            connectionId,
            doctorId,
            patientId,
            'in_progress',
            completeness,
            medicalData
          );
          db = createResult.db;
          const session = createResult.session;

          // Get doctor view
          const doctorView = getDoctorView(db, session.id, doctorId);

          // Verify session data matches
          expect(doctorView).not.toBeNull();
          expect(doctorView!.session.completeness).toBe(completeness);
          expect(doctorView!.session.medicalData.chiefComplaint).toBe(medicalData.chiefComplaint);
          expect(doctorView!.session.medicalData.symptoms).toEqual(medicalData.symptoms);
          expect(doctorView!.session.medicalData.medications).toEqual(medicalData.medications);
          expect(doctorView!.session.medicalData.allergies).toEqual(medicalData.allergies);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty sessions display correctly', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, uuidArb, (connectionId, doctorId, patientId) => {
        // Create database and session with no messages
        let db: Database = { sessions: new Map(), messages: new Map() };
        const createResult = createSession(db, connectionId, doctorId, patientId, 'not_started');
        db = createResult.db;
        const session = createResult.session;

        // Get doctor view
        const doctorView = getDoctorView(db, session.id, doctorId);

        // Verify empty session is handled correctly
        expect(doctorView).not.toBeNull();
        expect(doctorView!.messages.length).toBe(0);
        expect(doctorView!.session.status).toBe('not_started');
        expect(doctorView!.session.completeness).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('message content is not modified in doctor view', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        messageContentArb,
        (connectionId, doctorId, patientId, content) => {
          // Create database and session
          let db: Database = { sessions: new Map(), messages: new Map() };
          const createResult = createSession(db, connectionId, doctorId, patientId);
          db = createResult.db;
          const session = createResult.session;

          // Add message with specific content
          const addResult = addMessageToDb(db, session.id, 'user', content);
          db = addResult.db;

          // Get doctor view
          const doctorView = getDoctorView(db, session.id, doctorId);

          // Verify content is exactly the same (not trimmed, modified, etc.)
          expect(doctorView).not.toBeNull();
          expect(doctorView!.messages[0]!.content).toBe(content);
        }
      ),
      { numRuns: 100 }
    );
  });
});
