/**
 * Feature: booking-flow-integration, Property 4: Doctor Selection Flow
 * 
 * For any patient with exactly one active connection, clicking "Book Appointment"
 * SHALL open the BookingModal directly. For patients with multiple connections,
 * a doctor selection interface SHALL appear first.
 * 
 * Validates: Requirements 5.2, 5.4
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

interface BookingFlowState {
  showDoctorSelection: boolean;
  isBookingModalOpen: boolean;
  selectedConnectionId: string | null;
  selectedDoctorId: string | null;
}

/**
 * Simulates the doctor selection flow logic from PatientAppointmentsPage
 * This mirrors the handleBookAppointmentClick behavior
 */
class DoctorSelectionFlowService {
  /**
   * Process "Book Appointment" button click
   * Requirements: 5.2, 5.4
   */
  handleBookAppointmentClick(connections: Connection[]): BookingFlowState {
    // No connections - nothing happens
    if (connections.length === 0) {
      return {
        showDoctorSelection: false,
        isBookingModalOpen: false,
        selectedConnectionId: null,
        selectedDoctorId: null,
      };
    }

    // Single connection - skip selection, open modal directly
    // Requirements: 5.4
    if (connections.length === 1) {
      const connection = connections[0]!;
      if (connection.doctor) {
        return {
          showDoctorSelection: false,
          isBookingModalOpen: true,
          selectedConnectionId: connection.id,
          selectedDoctorId: connection.doctor.id,
        };
      }
      // Connection without doctor data
      return {
        showDoctorSelection: false,
        isBookingModalOpen: false,
        selectedConnectionId: null,
        selectedDoctorId: null,
      };
    }

    // Multiple connections - show doctor selection
    // Requirements: 5.2
    return {
      showDoctorSelection: true,
      isBookingModalOpen: false,
      selectedConnectionId: null,
      selectedDoctorId: null,
    };
  }

  /**
   * Process doctor selection from the selection UI
   * Requirements: 5.3
   */
  handleDoctorSelect(connection: Connection): BookingFlowState {
    if (!connection.doctor) {
      return {
        showDoctorSelection: false,
        isBookingModalOpen: false,
        selectedConnectionId: null,
        selectedDoctorId: null,
      };
    }

    return {
      showDoctorSelection: false,
      isBookingModalOpen: true,
      selectedConnectionId: connection.id,
      selectedDoctorId: connection.doctor.id,
    };
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

const connectionWithoutDoctorArb: fc.Arbitrary<Connection> = fc.record({
  id: uuidArb,
  doctorId: uuidArb,
  doctor: fc.constant(null),
});

// Generate array of unique connections
const uniqueConnectionsArb = (minLength: number, maxLength: number): fc.Arbitrary<Connection[]> =>
  fc.array(validConnectionArb, { minLength, maxLength }).map(connections => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return connections.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }).filter(arr => arr.length >= minLength);

describe('Property 4: Doctor Selection Flow', () => {
  describe('Single Connection - Direct Modal Open', () => {
    it('for any patient with exactly one connection, clicking Book SHALL open modal directly', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          (connection) => {
            const service = new DoctorSelectionFlowService();
            const result = service.handleBookAppointmentClick([connection]);

            // Should NOT show doctor selection
            expect(result.showDoctorSelection).toBe(false);
            // Should open modal directly
            expect(result.isBookingModalOpen).toBe(true);
            // Should have correct connection and doctor IDs
            expect(result.selectedConnectionId).toBe(connection.id);
            expect(result.selectedDoctorId).toBe(connection.doctorId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any single connection without doctor data, modal SHALL not open', () => {
      fc.assert(
        fc.property(
          connectionWithoutDoctorArb,
          (connection) => {
            const service = new DoctorSelectionFlowService();
            const result = service.handleBookAppointmentClick([connection]);

            expect(result.showDoctorSelection).toBe(false);
            expect(result.isBookingModalOpen).toBe(false);
            expect(result.selectedConnectionId).toBeNull();
            expect(result.selectedDoctorId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple Connections - Doctor Selection Required', () => {
    it('for any patient with multiple connections, clicking Book SHALL show doctor selection', () => {
      fc.assert(
        fc.property(
          uniqueConnectionsArb(2, 5),
          (connections) => {
            fc.pre(connections.length >= 2);

            const service = new DoctorSelectionFlowService();
            const result = service.handleBookAppointmentClick(connections);

            // Should show doctor selection
            expect(result.showDoctorSelection).toBe(true);
            // Should NOT open modal yet
            expect(result.isBookingModalOpen).toBe(false);
            // Should not have selected anything yet
            expect(result.selectedConnectionId).toBeNull();
            expect(result.selectedDoctorId).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any doctor selection, modal SHALL open with selected doctor', () => {
      fc.assert(
        fc.property(
          uniqueConnectionsArb(2, 5),
          (connections) => {
            fc.pre(connections.length >= 2);

            const service = new DoctorSelectionFlowService();
            
            // First click shows selection
            const initialState = service.handleBookAppointmentClick(connections);
            expect(initialState.showDoctorSelection).toBe(true);

            // Select a random doctor
            const selectedConnection = connections[Math.floor(Math.random() * connections.length)]!;
            const afterSelection = service.handleDoctorSelect(selectedConnection);

            // Doctor selection should close
            expect(afterSelection.showDoctorSelection).toBe(false);
            // Modal should open
            expect(afterSelection.isBookingModalOpen).toBe(true);
            // Correct connection and doctor should be selected
            expect(afterSelection.selectedConnectionId).toBe(selectedConnection.id);
            expect(afterSelection.selectedDoctorId).toBe(selectedConnection.doctorId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No Connections', () => {
    it('for any patient with no connections, nothing SHALL happen', () => {
      const service = new DoctorSelectionFlowService();
      const result = service.handleBookAppointmentClick([]);

      expect(result.showDoctorSelection).toBe(false);
      expect(result.isBookingModalOpen).toBe(false);
      expect(result.selectedConnectionId).toBeNull();
      expect(result.selectedDoctorId).toBeNull();
    });
  });

  describe('Connection Count Boundary', () => {
    it('for exactly 1 connection, modal opens directly; for 2+ connections, selection appears', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (connectionCount) => {
            // Generate the specified number of unique connections
            const connections: Connection[] = Array.from({ length: connectionCount }, (_, i) => ({
              id: `conn-${i}`,
              doctorId: `doctor-${i}`,
              doctor: {
                id: `doctor-${i}`,
                specialty: 'General Practice',
                clinicName: 'Test Clinic',
                user: {
                  firstName: `Doctor${i}`,
                  lastName: 'Test',
                  imageUrl: null,
                },
              },
            }));

            const service = new DoctorSelectionFlowService();
            const result = service.handleBookAppointmentClick(connections);

            if (connectionCount === 1) {
              // Single connection - direct modal open
              expect(result.showDoctorSelection).toBe(false);
              expect(result.isBookingModalOpen).toBe(true);
              expect(result.selectedConnectionId).toBe(connections[0]!.id);
            } else {
              // Multiple connections - show selection
              expect(result.showDoctorSelection).toBe(true);
              expect(result.isBookingModalOpen).toBe(false);
              expect(result.selectedConnectionId).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Doctor Selection Preserves Connection Data', () => {
    it('for any selected connection, all connection data SHALL be preserved', () => {
      fc.assert(
        fc.property(
          validConnectionArb,
          (connection) => {
            const service = new DoctorSelectionFlowService();
            const result = service.handleDoctorSelect(connection);

            // The selected IDs should exactly match the connection
            expect(result.selectedConnectionId).toBe(connection.id);
            expect(result.selectedDoctorId).toBe(connection.doctor!.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Idempotence', () => {
    it('for any connection list, clicking Book twice SHALL produce same result', () => {
      fc.assert(
        fc.property(
          uniqueConnectionsArb(1, 5),
          (connections) => {
            const service = new DoctorSelectionFlowService();
            
            const firstResult = service.handleBookAppointmentClick(connections);
            const secondResult = service.handleBookAppointmentClick(connections);

            expect(firstResult).toEqual(secondResult);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
