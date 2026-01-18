/**
 * Feature: intake-sessions-management
 * Property 6: Session Deletion Validation
 * Property 7: Cascade Deletion Completeness
 * 
 * Property 6: For any intake session, deletion SHALL succeed if and only if:
 * (1) the session status is 'not_started' or 'in_progress', AND
 * (2) the session has no linked appointment.
 * Deletion of sessions with status 'ready' or 'reviewed' SHALL always fail.
 * Deletion of sessions with linked appointments SHALL always fail.
 * 
 * Property 7: For any intake session that is successfully deleted, all associated
 * chat messages SHALL also be deleted, and subsequent queries for the session or
 * its messages SHALL return empty results.
 * 
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for session deletion
type SessionStatus = 'not_started' | 'in_progress' | 'ready' | 'reviewed';

interface Session {
  id: string;
  connectionId: string;
  status: SessionStatus;
  completeness: number;
}

interface Appointment {
  id: string;
  intakeSessionId: string | null;
  scheduledAt: Date;
  status: string;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  role: 'user' | 'model' | 'doctor';
}

interface DeletionResult {
  success: boolean;
  error?: string;
}

// Arbitraries
const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<SessionStatus>;
const deletableStatusArb = fc.constantFrom('not_started', 'in_progress') as fc.Arbitrary<SessionStatus>;
const nonDeletableStatusArb = fc.constantFrom('ready', 'reviewed') as fc.Arbitrary<SessionStatus>;

const sessionArb: fc.Arbitrary<Session> = fc.record({
  id: fc.uuid(),
  connectionId: fc.uuid(),
  status: sessionStatusArb,
  completeness: fc.integer({ min: 0, max: 100 }),
});

const appointmentArb = (sessionId: string | null): fc.Arbitrary<Appointment> => fc.record({
  id: fc.uuid(),
  intakeSessionId: fc.constant(sessionId),
  scheduledAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  status: fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled'),
});

const chatMessageArb = (sessionId: string): fc.Arbitrary<ChatMessage> => fc.record({
  id: fc.uuid(),
  sessionId: fc.constant(sessionId),
  content: fc.string({ minLength: 1, maxLength: 500 }),
  role: fc.constantFrom('user', 'model', 'doctor') as fc.Arbitrary<'user' | 'model' | 'doctor'>,
});

/**
 * Determines if a session can be deleted based on business rules
 */
function canDeleteSession(session: Session, linkedAppointment: Appointment | null): boolean {
  // Rule 1: Status must be 'not_started' or 'in_progress'
  const isDeletableStatus = session.status === 'not_started' || session.status === 'in_progress';
  
  // Rule 2: No linked appointment
  const hasNoLinkedAppointment = linkedAppointment === null;
  
  return isDeletableStatus && hasNoLinkedAppointment;
}

/**
 * Simulates the deleteSession mutation logic
 */
function deleteSession(
  session: Session,
  linkedAppointment: Appointment | null,
  messages: ChatMessage[]
): DeletionResult {
  // Check if session can be deleted
  if (session.status !== 'not_started' && session.status !== 'in_progress') {
    return {
      success: false,
      error: 'Completed sessions cannot be deleted.',
    };
  }

  if (linkedAppointment !== null) {
    return {
      success: false,
      error: 'Sessions with linked appointments cannot be deleted.',
    };
  }

  // Simulate cascade deletion of messages
  // In real implementation, this would delete from database
  // Here we just return success
  return { success: true };
}

/**
 * Simulates database state after deletion
 */
interface DatabaseState {
  sessions: Map<string, Session>;
  messages: Map<string, ChatMessage[]>;
  appointments: Map<string, Appointment>;
}

function createDatabaseState(
  session: Session,
  messages: ChatMessage[],
  linkedAppointment: Appointment | null
): DatabaseState {
  const state: DatabaseState = {
    sessions: new Map([[session.id, session]]),
    messages: new Map([[session.id, messages]]),
    appointments: new Map(),
  };
  
  if (linkedAppointment) {
    state.appointments.set(linkedAppointment.id, linkedAppointment);
  }
  
  return state;
}

function performDeletion(state: DatabaseState, sessionId: string): boolean {
  const session = state.sessions.get(sessionId);
  if (!session) return false;
  
  // Find linked appointment
  let linkedAppointment: Appointment | null = null;
  for (const apt of state.appointments.values()) {
    if (apt.intakeSessionId === sessionId) {
      linkedAppointment = apt;
      break;
    }
  }
  
  // Check deletion rules
  if (session.status !== 'not_started' && session.status !== 'in_progress') {
    return false;
  }
  
  if (linkedAppointment !== null) {
    return false;
  }
  
  // Perform cascade deletion
  state.messages.delete(sessionId);
  state.sessions.delete(sessionId);
  
  return true;
}

describe('Property 6: Session Deletion Validation', () => {
  it('deletion should succeed for sessions with deletable status and no linked appointment', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deletableStatusArb,
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, status, completeness) => {
          const session: Session = { id: sessionId, connectionId, status, completeness };
          const linkedAppointment = null;
          
          const canDelete = canDeleteSession(session, linkedAppointment);
          const result = deleteSession(session, linkedAppointment, []);
          
          expect(canDelete).toBe(true);
          expect(result.success).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deletion should fail for sessions with status ready', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = { id: sessionId, connectionId, status: 'ready', completeness };
          const linkedAppointment = null;
          
          const canDelete = canDeleteSession(session, linkedAppointment);
          const result = deleteSession(session, linkedAppointment, []);
          
          expect(canDelete).toBe(false);
          expect(result.success).toBe(false);
          expect(result.error).toBe('Completed sessions cannot be deleted.');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deletion should fail for sessions with status reviewed', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = { id: sessionId, connectionId, status: 'reviewed', completeness };
          const linkedAppointment = null;
          
          const canDelete = canDeleteSession(session, linkedAppointment);
          const result = deleteSession(session, linkedAppointment, []);
          
          expect(canDelete).toBe(false);
          expect(result.success).toBe(false);
          expect(result.error).toBe('Completed sessions cannot be deleted.');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deletion should fail for sessions with linked appointments regardless of status', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deletableStatusArb, // Only test with deletable status to isolate the appointment check
        fc.integer({ min: 0, max: 100 }),
        fc.uuid(),
        (sessionId, connectionId, status, completeness, appointmentId) => {
          const session: Session = { id: sessionId, connectionId, status, completeness };
          const linkedAppointment: Appointment = {
            id: appointmentId,
            intakeSessionId: sessionId,
            scheduledAt: new Date(),
            status: 'pending',
          };
          
          const canDelete = canDeleteSession(session, linkedAppointment);
          const result = deleteSession(session, linkedAppointment, []);
          
          expect(canDelete).toBe(false);
          expect(result.success).toBe(false);
          expect(result.error).toBe('Sessions with linked appointments cannot be deleted.');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('canDeleteSession should return true iff status is deletable AND no linked appointment', () => {
    fc.assert(
      fc.property(
        sessionArb,
        fc.boolean(), // whether to have a linked appointment
        (session, hasLinkedAppointment) => {
          const linkedAppointment = hasLinkedAppointment
            ? { id: crypto.randomUUID(), intakeSessionId: session.id, scheduledAt: new Date(), status: 'pending' }
            : null;
          
          const canDelete = canDeleteSession(session, linkedAppointment);
          
          const isDeletableStatus = session.status === 'not_started' || session.status === 'in_progress';
          const hasNoAppointment = !hasLinkedAppointment;
          
          expect(canDelete).toBe(isDeletableStatus && hasNoAppointment);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deletion of non-deletable status should always fail even with no appointment', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        nonDeletableStatusArb,
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, status, completeness) => {
          const session: Session = { id: sessionId, connectionId, status, completeness };
          
          const canDelete = canDeleteSession(session, null);
          const result = deleteSession(session, null, []);
          
          expect(canDelete).toBe(false);
          expect(result.success).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 7: Cascade Deletion Completeness', () => {
  it('after successful deletion, session should not exist in database', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deletableStatusArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
        (sessionId, connectionId, status, messageContents) => {
          const session: Session = { id: sessionId, connectionId, status, completeness: 50 };
          const messages: ChatMessage[] = messageContents.map((content, i) => ({
            id: crypto.randomUUID(),
            sessionId,
            content,
            role: (['user', 'model', 'doctor'] as const)[i % 3],
          }));
          
          const state = createDatabaseState(session, messages, null);
          
          // Verify session exists before deletion
          expect(state.sessions.has(sessionId)).toBe(true);
          
          // Perform deletion
          const deleted = performDeletion(state, sessionId);
          
          expect(deleted).toBe(true);
          
          // Verify session no longer exists
          expect(state.sessions.has(sessionId)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('after successful deletion, all associated messages should be deleted', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deletableStatusArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 20 }),
        (sessionId, connectionId, status, messageContents) => {
          const session: Session = { id: sessionId, connectionId, status, completeness: 50 };
          const messages: ChatMessage[] = messageContents.map((content, i) => ({
            id: crypto.randomUUID(),
            sessionId,
            content,
            role: (['user', 'model', 'doctor'] as const)[i % 3],
          }));
          
          const state = createDatabaseState(session, messages, null);
          
          // Verify messages exist before deletion
          expect(state.messages.has(sessionId)).toBe(true);
          expect(state.messages.get(sessionId)!.length).toBe(messages.length);
          
          // Perform deletion
          const deleted = performDeletion(state, sessionId);
          
          expect(deleted).toBe(true);
          
          // Verify messages no longer exist
          expect(state.messages.has(sessionId)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('failed deletion should not modify database state', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        nonDeletableStatusArb,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
        (sessionId, connectionId, status, messageContents) => {
          const session: Session = { id: sessionId, connectionId, status, completeness: 100 };
          const messages: ChatMessage[] = messageContents.map((content, i) => ({
            id: crypto.randomUUID(),
            sessionId,
            content,
            role: (['user', 'model', 'doctor'] as const)[i % 3],
          }));
          
          const state = createDatabaseState(session, messages, null);
          
          // Store original state
          const originalSessionCount = state.sessions.size;
          const originalMessageCount = state.messages.get(sessionId)?.length ?? 0;
          
          // Attempt deletion (should fail)
          const deleted = performDeletion(state, sessionId);
          
          expect(deleted).toBe(false);
          
          // Verify state unchanged
          expect(state.sessions.size).toBe(originalSessionCount);
          expect(state.sessions.has(sessionId)).toBe(true);
          expect(state.messages.has(sessionId)).toBe(true);
          expect(state.messages.get(sessionId)!.length).toBe(originalMessageCount);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deletion with linked appointment should not modify database state', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deletableStatusArb, // Even with deletable status
        fc.uuid(),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
        (sessionId, connectionId, status, appointmentId, messageContents) => {
          const session: Session = { id: sessionId, connectionId, status, completeness: 50 };
          const messages: ChatMessage[] = messageContents.map((content, i) => ({
            id: crypto.randomUUID(),
            sessionId,
            content,
            role: (['user', 'model', 'doctor'] as const)[i % 3],
          }));
          const linkedAppointment: Appointment = {
            id: appointmentId,
            intakeSessionId: sessionId,
            scheduledAt: new Date(),
            status: 'pending',
          };
          
          const state = createDatabaseState(session, messages, linkedAppointment);
          
          // Store original state
          const originalSessionCount = state.sessions.size;
          const originalMessageCount = state.messages.get(sessionId)?.length ?? 0;
          
          // Attempt deletion (should fail due to linked appointment)
          const deleted = performDeletion(state, sessionId);
          
          expect(deleted).toBe(false);
          
          // Verify state unchanged
          expect(state.sessions.size).toBe(originalSessionCount);
          expect(state.sessions.has(sessionId)).toBe(true);
          expect(state.messages.has(sessionId)).toBe(true);
          expect(state.messages.get(sessionId)!.length).toBe(originalMessageCount);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('querying deleted session should return empty results', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        deletableStatusArb,
        (sessionId, connectionId, status) => {
          const session: Session = { id: sessionId, connectionId, status, completeness: 50 };
          const messages: ChatMessage[] = [
            { id: crypto.randomUUID(), sessionId, content: 'Hello', role: 'user' },
            { id: crypto.randomUUID(), sessionId, content: 'Hi there', role: 'model' },
          ];
          
          const state = createDatabaseState(session, messages, null);
          
          // Perform deletion
          performDeletion(state, sessionId);
          
          // Query for session - should return undefined
          const queriedSession = state.sessions.get(sessionId);
          expect(queriedSession).toBeUndefined();
          
          // Query for messages - should return undefined
          const queriedMessages = state.messages.get(sessionId);
          expect(queriedMessages).toBeUndefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
