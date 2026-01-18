/**
 * Feature: intake-sessions-management
 * Property 10: Cross-Connection Link Validation
 * 
 * For any appointment booking attempt that specifies an intake session ID, if the session's
 * connectionId does not match the appointment's connectionId, the booking SHALL fail with
 * a validation error.
 * 
 * Validates: Requirements 5.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for cross-connection validation
interface Session {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
}

interface AppointmentBookingRequest {
  connectionId: string;
  intakeSessionId?: string;
  scheduledAt: Date;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Arbitraries
const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<Session['status']>;

const sessionArb: fc.Arbitrary<Session> = fc.record({
  id: fc.uuid(),
  connectionId: fc.uuid(),
  status: sessionStatusArb,
});

/**
 * Validates that an intake session belongs to the same connection as the appointment
 */
function validateCrossConnection(
  request: AppointmentBookingRequest,
  session: Session | null
): ValidationResult {
  // If no session ID provided, validation passes
  if (!request.intakeSessionId) {
    return { valid: true };
  }

  // If session not found, validation fails
  if (!session) {
    return { valid: false, error: 'Intake session not found' };
  }

  // If session belongs to different connection, validation fails
  if (session.connectionId !== request.connectionId) {
    return { valid: false, error: "This session doesn't belong to the selected doctor" };
  }

  return { valid: true };
}

/**
 * Simulates the database lookup for a session
 */
function findSession(sessionId: string, sessions: Session[]): Session | null {
  return sessions.find(s => s.id === sessionId) ?? null;
}

describe('Property 10: Cross-Connection Link Validation', () => {
  it('booking without session ID should always pass validation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, scheduledAt) => {
          const request: AppointmentBookingRequest = {
            connectionId,
            scheduledAt,
            // No intakeSessionId
          };

          const result = validateCrossConnection(request, null);
          expect(result.valid).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('booking with session from same connection should pass validation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        sessionStatusArb,
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, sessionId, status, scheduledAt) => {
          const session: Session = {
            id: sessionId,
            connectionId, // Same connection
            status,
          };

          const request: AppointmentBookingRequest = {
            connectionId,
            intakeSessionId: sessionId,
            scheduledAt,
          };

          const result = validateCrossConnection(request, session);
          expect(result.valid).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('booking with session from different connection should fail validation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        sessionStatusArb,
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, differentConnectionId, sessionId, status, scheduledAt) => {
          // Ensure connections are different
          fc.pre(connectionId !== differentConnectionId);

          const session: Session = {
            id: sessionId,
            connectionId: differentConnectionId, // Different connection
            status,
          };

          const request: AppointmentBookingRequest = {
            connectionId,
            intakeSessionId: sessionId,
            scheduledAt,
          };

          const result = validateCrossConnection(request, session);
          expect(result.valid).toBe(false);
          expect(result.error).toBe("This session doesn't belong to the selected doctor");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('booking with non-existent session should fail validation', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (connectionId, sessionId, scheduledAt) => {
          const request: AppointmentBookingRequest = {
            connectionId,
            intakeSessionId: sessionId,
            scheduledAt,
          };

          // Session not found (null)
          const result = validateCrossConnection(request, null);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Intake session not found');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation result should be deterministic for same inputs', () => {
    fc.assert(
      fc.property(
        sessionArb,
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (session, connectionId, scheduledAt) => {
          const request: AppointmentBookingRequest = {
            connectionId,
            intakeSessionId: session.id,
            scheduledAt,
          };

          const result1 = validateCrossConnection(request, session);
          const result2 = validateCrossConnection(request, session);

          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation should correctly identify matching vs non-matching connections', () => {
    fc.assert(
      fc.property(
        sessionArb,
        fc.uuid(),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (session, requestConnectionId, scheduledAt) => {
          const request: AppointmentBookingRequest = {
            connectionId: requestConnectionId,
            intakeSessionId: session.id,
            scheduledAt,
          };

          const result = validateCrossConnection(request, session);
          const connectionsMatch = session.connectionId === requestConnectionId;

          expect(result.valid).toBe(connectionsMatch);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('with multiple sessions, only the matching session should pass', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(sessionArb, { minLength: 2, maxLength: 10 }),
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        (targetConnectionId, sessions, scheduledAt) => {
          // Create one session that matches the target connection
          const matchingSession: Session = {
            id: crypto.randomUUID(),
            connectionId: targetConnectionId,
            status: 'ready',
          };

          const allSessions = [...sessions, matchingSession];

          // Test each session
          for (const session of allSessions) {
            const request: AppointmentBookingRequest = {
              connectionId: targetConnectionId,
              intakeSessionId: session.id,
              scheduledAt,
            };

            const foundSession = findSession(session.id, allSessions);
            const result = validateCrossConnection(request, foundSession);

            if (session.connectionId === targetConnectionId) {
              expect(result.valid).toBe(true);
            } else {
              expect(result.valid).toBe(false);
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
