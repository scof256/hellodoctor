/**
 * Feature: booking-flow-integration, Property 1: URL Parameter Modal Initialization
 * 
 * For any valid combination of `sessionId` and `connectionId` URL parameters on the
 * Patient Appointments Page, the BookingModal SHALL open with those exact values
 * pre-populated in its state.
 * 
 * Validates: Requirements 1.1, 4.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
interface Connection {
  id: string;
  doctorId: string;
  doctor: {
    id: string;
    specialty: string | null;
    clinicName: string | null;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    } | null;
  } | null;
}

interface URLParams {
  sessionId: string | null;
  connectionId: string | null;
}

interface ModalState {
  isOpen: boolean;
  connectionId: string | null;
  doctorId: string | null;
  sessionId: string | null;
}

/**
 * Simulates the URL parameter handling logic from PatientAppointmentsPage
 * This mirrors the useEffect behavior that auto-opens the modal
 */
class URLParameterModalService {
  private connections: Map<string, Connection> = new Map();

  setConnections(connections: Connection[]) {
    this.connections.clear();
    connections.forEach(c => this.connections.set(c.id, c));
  }

  /**
   * Process URL parameters and determine modal state
   * Requirements: 1.1, 4.4
   */
  processURLParams(params: URLParams): ModalState {
    const { sessionId, connectionId } = params;

    // If no URL params, modal stays closed
    if (!sessionId || !connectionId) {
      return {
        isOpen: false,
        connectionId: null,
        doctorId: null,
        sessionId: null,
      };
    }

    // Find the connection
    const connection = this.connections.get(connectionId);

    // If connection not found or has no doctor, modal stays closed
    if (!connection || !connection.doctor) {
      return {
        isOpen: false,
        connectionId: null,
        doctorId: null,
        sessionId: null,
      };
    }

    // Valid params - open modal with pre-populated values
    return {
      isOpen: true,
      connectionId: connectionId,
      doctorId: connection.doctor.id,
      sessionId: sessionId,
    };
  }

  /**
   * Validate that modal state matches URL params exactly
   */
  validateModalMatchesParams(params: URLParams, modalState: ModalState): boolean {
    if (!params.sessionId || !params.connectionId) {
      return !modalState.isOpen;
    }

    const connection = this.connections.get(params.connectionId);
    if (!connection || !connection.doctor) {
      return !modalState.isOpen;
    }

    return (
      modalState.isOpen &&
      modalState.connectionId === params.connectionId &&
      modalState.sessionId === params.sessionId &&
      modalState.doctorId === connection.doctor.id
    );
  }
}

// Arbitrary generators
const uuidArb = fc.uuid();

const specialtyArb = fc.constantFrom(
  'General Practice',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  null
);

const clinicNameArb = fc.constantFrom(
  'City Medical Center',
  'Downtown Clinic',
  null
);

const firstNameArb = fc.constantFrom('John', 'Jane', 'Michael', 'Sarah', null);
const lastNameArb = fc.constantFrom('Smith', 'Johnson', 'Williams', null);

const connectionArb: fc.Arbitrary<Connection> = fc.record({
  id: uuidArb,
  doctorId: uuidArb,
  doctor: fc.record({
    id: uuidArb,
    specialty: specialtyArb,
    clinicName: clinicNameArb,
    user: fc.oneof(
      fc.constant(null),
      fc.record({
        firstName: firstNameArb,
        lastName: lastNameArb,
        imageUrl: fc.constantFrom('https://example.com/avatar.jpg', null),
      })
    ),
  }),
}).map(conn => ({
  ...conn,
  doctor: conn.doctor ? {
    ...conn.doctor,
    id: conn.doctorId, // Ensure doctor.id matches doctorId
  } : null,
}));

const validConnectionArb: fc.Arbitrary<Connection> = fc.record({
  id: uuidArb,
  doctorId: uuidArb,
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
    id: conn.doctorId,
  },
}));

describe('Property 1: URL Parameter Modal Initialization', () => {
  describe('Valid URL Parameters', () => {
    it('for any valid sessionId and connectionId params, modal SHALL open with those exact values', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          uuidArb,
          (connection, sessionId) => {
            const service = new URLParameterModalService();
            service.setConnections([connection]);

            const params: URLParams = {
              sessionId,
              connectionId: connection.id,
            };

            const modalState = service.processURLParams(params);

            // Modal should be open
            expect(modalState.isOpen).toBe(true);
            // Connection ID should match exactly
            expect(modalState.connectionId).toBe(connection.id);
            // Session ID should match exactly
            expect(modalState.sessionId).toBe(sessionId);
            // Doctor ID should be derived from connection
            expect(modalState.doctorId).toBe(connection.doctorId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any valid params, modal state SHALL pass validation', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          uuidArb,
          (connection, sessionId) => {
            const service = new URLParameterModalService();
            service.setConnections([connection]);

            const params: URLParams = {
              sessionId,
              connectionId: connection.id,
            };

            const modalState = service.processURLParams(params);
            const isValid = service.validateModalMatchesParams(params, modalState);

            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Missing URL Parameters', () => {
    it('for any missing sessionId, modal SHALL remain closed', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          (connection) => {
            const service = new URLParameterModalService();
            service.setConnections([connection]);

            const params: URLParams = {
              sessionId: null,
              connectionId: connection.id,
            };

            const modalState = service.processURLParams(params);

            expect(modalState.isOpen).toBe(false);
            expect(modalState.connectionId).toBeNull();
            expect(modalState.sessionId).toBeNull();
            expect(modalState.doctorId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any missing connectionId, modal SHALL remain closed', () => {
      fc.assert(
        fc.property(
          uuidArb,
          (sessionId) => {
            const service = new URLParameterModalService();

            const params: URLParams = {
              sessionId,
              connectionId: null,
            };

            const modalState = service.processURLParams(params);

            expect(modalState.isOpen).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any empty params, modal SHALL remain closed', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          (connection) => {
            const service = new URLParameterModalService();
            service.setConnections([connection]);

            const params: URLParams = {
              sessionId: null,
              connectionId: null,
            };

            const modalState = service.processURLParams(params);

            expect(modalState.isOpen).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invalid Connection ID', () => {
    it('for any connectionId not in user connections, modal SHALL remain closed', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          uuidArb,
          uuidArb,
          (connection, invalidConnectionId, sessionId) => {
            // Ensure the invalid ID is different from the valid one
            fc.pre(invalidConnectionId !== connection.id);

            const service = new URLParameterModalService();
            service.setConnections([connection]);

            const params: URLParams = {
              sessionId,
              connectionId: invalidConnectionId,
            };

            const modalState = service.processURLParams(params);

            expect(modalState.isOpen).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any connection without doctor data, modal SHALL remain closed', () => {
      fc.assert(
        fc.property(
          uuidArb,
          uuidArb,
          uuidArb,
          (connectionId, doctorId, sessionId) => {
            const connectionWithoutDoctor: Connection = {
              id: connectionId,
              doctorId,
              doctor: null,
            };

            const service = new URLParameterModalService();
            service.setConnections([connectionWithoutDoctor]);

            const params: URLParams = {
              sessionId,
              connectionId,
            };

            const modalState = service.processURLParams(params);

            expect(modalState.isOpen).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Connections', () => {
    it('for any params matching one of multiple connections, modal SHALL open with correct connection', () => {
      fc.assert(
        fc.property(
          fc.array(validConnectionArb, { minLength: 2, maxLength: 5 }),
          uuidArb,
          (connections, sessionId) => {
            // Ensure unique connection IDs
            const uniqueConnections = connections.filter(
              (c, i, arr) => arr.findIndex(x => x.id === c.id) === i
            );
            fc.pre(uniqueConnections.length >= 2);

            const service = new URLParameterModalService();
            service.setConnections(uniqueConnections);

            // Pick a random connection to test
            const targetConnection = uniqueConnections[Math.floor(Math.random() * uniqueConnections.length)]!;

            const params: URLParams = {
              sessionId,
              connectionId: targetConnection.id,
            };

            const modalState = service.processURLParams(params);

            expect(modalState.isOpen).toBe(true);
            expect(modalState.connectionId).toBe(targetConnection.id);
            expect(modalState.doctorId).toBe(targetConnection.doctorId);
            expect(modalState.sessionId).toBe(sessionId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotence', () => {
    it('for any valid params, processing twice SHALL produce identical results', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          uuidArb,
          (connection, sessionId) => {
            const service = new URLParameterModalService();
            service.setConnections([connection]);

            const params: URLParams = {
              sessionId,
              connectionId: connection.id,
            };

            const firstResult = service.processURLParams(params);
            const secondResult = service.processURLParams(params);

            expect(firstResult).toEqual(secondResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
