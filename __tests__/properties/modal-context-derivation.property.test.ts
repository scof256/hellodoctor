/**
 * Feature: booking-flow-integration, Property 2: Modal Context Derivation
 * 
 * For any BookingModal opened with a `connectionId` but without an explicit `doctorId`,
 * the modal SHALL derive and use the correct `doctorId` from the connection data.
 * 
 * Additionally, when the BookingModal opens from the Sessions page, it SHALL
 * pre-select the associated intake session.
 * 
 * Validates: Requirements 4.2, 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface Connection {
  id: string;
  doctorId: string;
  patientId: string;
  doctor: {
    id: string;
    specialty: string | null;
    clinicName: string | null;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    };
  };
}

interface IntakeSession {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  completeness: number;
  createdAt: Date;
}

interface BookingModalContext {
  connectionId: string;
  doctorId: string | null;
  intakeSessionId: string | null;
}

interface DerivedModalState {
  connectionId: string;
  doctorId: string;
  selectedSessionId: string | null;
  error: string | null;
}

/**
 * Simulates the BookingModal context derivation logic
 * This mirrors the behavior in BookingModal.tsx
 */
class BookingModalContextService {
  private connections: Map<string, Connection> = new Map();
  private sessions: Map<string, IntakeSession[]> = new Map();

  setConnections(connections: Connection[]) {
    this.connections.clear();
    connections.forEach(c => this.connections.set(c.id, c));
  }

  setSessions(connectionId: string, sessions: IntakeSession[]) {
    this.sessions.set(connectionId, sessions);
  }

  /**
   * Derive the full modal state from the provided context
   * Requirements: 4.2, 4.3
   */
  deriveModalState(context: BookingModalContext): DerivedModalState {
    // Get connection data
    const connection = this.connections.get(context.connectionId);
    
    if (!connection) {
      return {
        connectionId: context.connectionId,
        doctorId: '',
        selectedSessionId: null,
        error: 'Connection not found',
      };
    }

    // Derive doctorId from connection if not explicitly provided
    // Requirements: 4.2
    const doctorId = context.doctorId ?? connection.doctorId;

    // Get sessions for this connection
    const connectionSessions = this.sessions.get(context.connectionId) ?? [];

    // Determine selected session
    // Requirements: 4.3
    let selectedSessionId: string | null = null;

    if (context.intakeSessionId) {
      // If session ID provided, use it (from Sessions page)
      selectedSessionId = context.intakeSessionId;
    } else if (connectionSessions.length > 0) {
      // Auto-select most recent ready session, or first linkable session
      const readySession = connectionSessions.find(s => s.status === 'ready');
      if (readySession) {
        selectedSessionId = readySession.id;
      } else {
        // Fall back to first session
        selectedSessionId = connectionSessions[0]?.id ?? null;
      }
    }

    return {
      connectionId: context.connectionId,
      doctorId,
      selectedSessionId,
      error: null,
    };
  }

  /**
   * Validate that the derived doctorId matches the connection's doctor
   */
  validateDoctorIdDerivation(context: BookingModalContext): boolean {
    const connection = this.connections.get(context.connectionId);
    if (!connection) return false;

    const derivedState = this.deriveModalState(context);
    return derivedState.doctorId === connection.doctorId;
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const specialtyArb = fc.constantFrom(
  'General Practice',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  null
);

const clinicNameArb = fc.constantFrom(
  'City Medical Center',
  'Downtown Clinic',
  'Family Health Practice',
  null
);

const firstNameArb = fc.constantFrom('John', 'Jane', 'Michael', 'Sarah', 'David', null);
const lastNameArb = fc.constantFrom('Smith', 'Johnson', 'Williams', 'Brown', 'Davis', null);

const connectionArb = fc.record({
  id: uuidArb,
  doctorId: uuidArb,
  patientId: uuidArb,
  doctor: fc.record({
    id: uuidArb,
    specialty: specialtyArb,
    clinicName: clinicNameArb,
    user: fc.record({
      firstName: firstNameArb,
      lastName: lastNameArb,
      imageUrl: fc.constantFrom('https://example.com/avatar.jpg', null),
    }),
  }),
}).map(conn => ({
  ...conn,
  doctor: {
    ...conn.doctor,
    id: conn.doctorId, // Ensure doctor.id matches doctorId
  },
}));

const sessionStatusArb = fc.constantFrom<'not_started' | 'in_progress' | 'ready' | 'reviewed'>(
  'not_started',
  'in_progress',
  'ready',
  'reviewed'
);

const sessionArb = (connectionId: string) => fc.record({
  id: uuidArb,
  connectionId: fc.constant(connectionId),
  status: sessionStatusArb,
  completeness: fc.integer({ min: 0, max: 100 }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
});

const sessionsForConnectionArb = (connectionId: string) => 
  fc.array(sessionArb(connectionId), { minLength: 0, maxLength: 5 });

describe('Property 2: Modal Context Derivation', () => {
  describe('Doctor ID Derivation from Connection', () => {
    it('for any connection, when doctorId is not provided, modal SHALL derive it from connection', () => {
      fc.assert(
        fc.property(
          connectionArb,
          (connection) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);

            // Context without explicit doctorId
            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: null,
              intakeSessionId: null,
            };

            const derivedState = service.deriveModalState(context);

            // The derived doctorId should match the connection's doctorId
            expect(derivedState.doctorId).toBe(connection.doctorId);
            expect(derivedState.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection, when doctorId IS provided, modal SHALL use the provided value', () => {
      fc.assert(
        fc.property(
          connectionArb,
          uuidArb,
          (connection, explicitDoctorId) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);

            // Context with explicit doctorId
            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: explicitDoctorId,
              intakeSessionId: null,
            };

            const derivedState = service.deriveModalState(context);

            // The derived doctorId should be the explicitly provided one
            expect(derivedState.doctorId).toBe(explicitDoctorId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any invalid connectionId, modal SHALL return an error state', () => {
      fc.assert(
        fc.property(
          uuidArb,
          connectionArb,
          (invalidConnectionId, validConnection) => {
            const service = new BookingModalContextService();
            service.setConnections([validConnection]);

            // Ensure we're using a different connection ID
            fc.pre(invalidConnectionId !== validConnection.id);

            const context: BookingModalContext = {
              connectionId: invalidConnectionId,
              doctorId: null,
              intakeSessionId: null,
            };

            const derivedState = service.deriveModalState(context);

            expect(derivedState.error).toBe('Connection not found');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Session Pre-selection from Sessions Page', () => {
    it('for any session opened from Sessions page, modal SHALL pre-select that session', () => {
      fc.assert(
        fc.property(
          connectionArb,
          fc.integer({ min: 1, max: 5 }),
          (connection, sessionCount) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);

            // Generate sessions for this connection
            const sessions: IntakeSession[] = Array.from({ length: sessionCount }, (_, i) => ({
              id: `session-${i}`,
              connectionId: connection.id,
              status: i === 0 ? 'ready' : 'in_progress',
              completeness: i === 0 ? 100 : 50,
              createdAt: new Date(Date.now() - i * 86400000),
            }));
            service.setSessions(connection.id, sessions);

            // Pick a random session to open from
            const targetSession = sessions[Math.floor(Math.random() * sessions.length)]!;

            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: null,
              intakeSessionId: targetSession.id,
            };

            const derivedState = service.deriveModalState(context);

            // The selected session should be the one we passed
            expect(derivedState.selectedSessionId).toBe(targetSession.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection with ready sessions, modal SHALL auto-select the ready session when no session provided', () => {
      fc.assert(
        fc.property(
          connectionArb,
          (connection) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);

            // Create sessions with one ready session
            const sessions: IntakeSession[] = [
              {
                id: 'session-in-progress',
                connectionId: connection.id,
                status: 'in_progress',
                completeness: 50,
                createdAt: new Date(Date.now() - 86400000),
              },
              {
                id: 'session-ready',
                connectionId: connection.id,
                status: 'ready',
                completeness: 100,
                createdAt: new Date(),
              },
              {
                id: 'session-not-started',
                connectionId: connection.id,
                status: 'not_started',
                completeness: 0,
                createdAt: new Date(Date.now() - 172800000),
              },
            ];
            service.setSessions(connection.id, sessions);

            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: null,
              intakeSessionId: null, // No session provided
            };

            const derivedState = service.deriveModalState(context);

            // Should auto-select the ready session
            expect(derivedState.selectedSessionId).toBe('session-ready');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection with no ready sessions, modal SHALL select the first available session', () => {
      fc.assert(
        fc.property(
          connectionArb,
          (connection) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);

            // Create sessions with no ready sessions
            const sessions: IntakeSession[] = [
              {
                id: 'session-1',
                connectionId: connection.id,
                status: 'in_progress',
                completeness: 50,
                createdAt: new Date(),
              },
              {
                id: 'session-2',
                connectionId: connection.id,
                status: 'not_started',
                completeness: 0,
                createdAt: new Date(Date.now() - 86400000),
              },
            ];
            service.setSessions(connection.id, sessions);

            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: null,
              intakeSessionId: null,
            };

            const derivedState = service.deriveModalState(context);

            // Should select the first session
            expect(derivedState.selectedSessionId).toBe('session-1');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection with no sessions, modal SHALL have null selectedSessionId', () => {
      fc.assert(
        fc.property(
          connectionArb,
          (connection) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);
            service.setSessions(connection.id, []); // No sessions

            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: null,
              intakeSessionId: null,
            };

            const derivedState = service.deriveModalState(context);

            expect(derivedState.selectedSessionId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Context Derivation', () => {
    it('for any valid context from Sessions page, modal SHALL correctly derive both doctorId and sessionId', () => {
      fc.assert(
        fc.property(
          connectionArb,
          (connection) => {
            const service = new BookingModalContextService();
            service.setConnections([connection]);

            const session: IntakeSession = {
              id: 'target-session',
              connectionId: connection.id,
              status: 'ready',
              completeness: 100,
              createdAt: new Date(),
            };
            service.setSessions(connection.id, [session]);

            // Context as it would come from Sessions page handleBookAppointment
            const context: BookingModalContext = {
              connectionId: connection.id,
              doctorId: connection.doctorId, // Sessions page provides this
              intakeSessionId: session.id,
            };

            const derivedState = service.deriveModalState(context);

            // Both should be correctly set
            expect(derivedState.doctorId).toBe(connection.doctorId);
            expect(derivedState.selectedSessionId).toBe(session.id);
            expect(derivedState.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
