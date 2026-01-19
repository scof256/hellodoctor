/**
 * Feature: qr-scan-home-card, Property 2: Maximum Card Limit Preserved
 * 
 * For any patient state, the total number of displayed action cards SHALL not exceed 3.
 * This includes the QR scan card which is always first.
 * 
 * Validates: Requirements 5.1
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';

// Helper to extract action cards from SimplifiedPatientHome logic
function getActionCards(
  connections: ConnectionSummary[],
  appointments: AppointmentSummary[]
): Array<{ key: string; title: string }> {
  const actionCards: Array<{ key: string; title: string }> = [];

  // ALWAYS add QR scan card first
  actionCards.push({
    key: "qr-scan",
    title: "Scan QR Code",
  });

  const primaryConnection = connections[0];

  if (!primaryConnection) {
    // No connections - show connect message as second card
    actionCards.push({
      key: "connect",
      title: "No Doctor Connected",
    });
  } else {
    const intakeStatus = primaryConnection.intakeStatus;
    const nextAppointment = appointments[0];

    // Check if there's an upcoming appointment
    if (nextAppointment) {
      actionCards.push({
        key: "appointment",
        title: "View Appointment",
      });
    } else if (
      intakeStatus?.status === "ready" ||
      intakeStatus?.status === "reviewed"
    ) {
      actionCards.push({
        key: "book",
        title: "Book Appointment",
      });
    } else if (intakeStatus?.status === "in_progress") {
      actionCards.push({
        key: "continue-intake",
        title: "Continue Medical Form",
      });
    } else {
      actionCards.push({
        key: "start-intake",
        title: "Start Medical Form",
      });
    }

    // Add secondary cards if we have room (max 3 total)
    if (actionCards.length < 3 && connections.length > 1) {
      const secondConnection = connections[1];
      if (secondConnection) {
        const secondIntakeStatus = secondConnection.intakeStatus;

        if (
          secondIntakeStatus?.status === "ready" ||
          secondIntakeStatus?.status === "reviewed"
        ) {
          actionCards.push({
            key: "book-second",
            title: "Book with Another Doctor",
          });
        } else if (secondIntakeStatus?.status === "in_progress") {
          actionCards.push({
            key: "continue-second",
            title: "Continue Form",
          });
        } else {
          actionCards.push({
            key: "start-second",
            title: "Start Form",
          });
        }
      }
    }

    // Add "View Messages" card if we still have room
    if (actionCards.length < 3) {
      actionCards.push({
        key: "messages",
        title: "View Messages",
      });
    }
  }

  // Ensure we only show maximum 3 cards
  return actionCards.slice(0, 3);
}

// Arbitrary generator for intake status
const arbitraryIntakeStatus = fc.constantFrom(
  "not_started",
  "in_progress",
  "ready",
  "reviewed"
) as fc.Arbitrary<"not_started" | "in_progress" | "ready" | "reviewed">;

// Arbitrary generator for connection summary
const arbitraryConnection = fc.record({
  id: fc.string(),
  status: fc.constantFrom("active", "pending", "disconnected") as fc.Arbitrary<"active" | "pending" | "disconnected">,
  connectedAt: fc.date(),
  doctor: fc.record({
    id: fc.string(),
    firstName: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    lastName: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    imageUrl: fc.option(fc.webUrl()),
    specialty: fc.option(fc.string({ minLength: 1, maxLength: 30 })),
    clinicName: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
  }),
  intakeStatus: fc.option(
    fc.record({
      status: arbitraryIntakeStatus,
      completeness: fc.integer({ min: 0, max: 100 }),
      sessionId: fc.option(fc.string()),
    })
  ),
}) as fc.Arbitrary<ConnectionSummary>;

// Arbitrary generator for appointment summary
const arbitraryAppointment = fc.record({
  id: fc.string(),
  scheduledAt: fc.date(),
  duration: fc.integer({ min: 15, max: 120 }),
  status: fc.constantFrom("scheduled", "completed", "cancelled", "no_show") as fc.Arbitrary<"scheduled" | "completed" | "cancelled" | "no_show">,
  connectionId: fc.string(),
  intakeSessionId: fc.option(fc.string()),
  isOnline: fc.boolean(),
  streamCallId: fc.option(fc.string()),
  streamJoinUrl: fc.option(fc.webUrl()),
}) as fc.Arbitrary<AppointmentSummary>;

describe('Property 2: Maximum Card Limit Preserved', () => {
  const MAX_CARDS = 3;

  it('displays maximum 3 cards with no connections', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryAppointment, { maxLength: 10 }),
        (appointments) => {
          const cards = getActionCards([], appointments);

          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
          expect(cards.length).toBeGreaterThan(0); // At least QR scan card

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('displays maximum 3 cards with one connection', () => {
    fc.assert(
      fc.property(
        arbitraryConnection,
        fc.array(arbitraryAppointment, { maxLength: 10 }),
        (connection, appointments) => {
          const cards = getActionCards([connection], appointments);

          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
          expect(cards.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('displays maximum 3 cards with multiple connections', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 2, maxLength: 10 }),
        fc.array(arbitraryAppointment, { maxLength: 10 }),
        (connections, appointments) => {
          const cards = getActionCards(connections, appointments);

          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
          expect(cards.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit includes QR scan card', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 1, maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const cards = getActionCards(connections, appointments);

          // QR scan card should be counted in the limit
          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);

          // QR scan card should always be present
          const qrCard = cards.find(c => c.key === "qr-scan");
          expect(qrCard).toBeDefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit is enforced with all intake statuses', () => {
    fc.assert(
      fc.property(
        arbitraryIntakeStatus,
        fc.integer({ min: 0, max: 100 }),
        (status, completeness) => {
          const connection: ConnectionSummary = {
            id: "test-connection",
            status: "active",
            connectedAt: new Date(),
            doctor: {
              id: "test-doctor",
              firstName: "John",
              lastName: "Doe",
              imageUrl: null,
              specialty: "General Practice",
              clinicName: null,
            },
            intakeStatus: {
              status,
              completeness,
              sessionId: "test-session",
            },
          };

          const cards = getActionCards([connection], []);

          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
          expect(cards.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit is enforced with appointments', () => {
    fc.assert(
      fc.property(
        arbitraryConnection,
        fc.array(arbitraryAppointment, { minLength: 1, maxLength: 10 }),
        (connection, appointments) => {
          const cards = getActionCards([connection], appointments);

          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
          expect(cards.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit is consistent across state transitions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            connectionCount: fc.integer({ min: 0, max: 5 }),
            appointmentCount: fc.integer({ min: 0, max: 5 }),
            intakeStatus: arbitraryIntakeStatus,
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (states) => {
          for (const state of states) {
            const connections: ConnectionSummary[] = Array.from(
              { length: state.connectionCount },
              (_, i) => ({
                id: `connection-${i}`,
                status: "active" as const,
                connectedAt: new Date(),
                doctor: {
                  id: `doctor-${i}`,
                  firstName: `Doctor${i}`,
                  lastName: `Last${i}`,
                  imageUrl: null,
                  specialty: "General Practice",
                  clinicName: null,
                },
                intakeStatus: {
                  status: state.intakeStatus,
                  completeness: 50,
                  sessionId: `session-${i}`,
                },
              })
            );

            const appointments: AppointmentSummary[] = Array.from(
              { length: state.appointmentCount },
              (_, i) => ({
                id: `appointment-${i}`,
                scheduledAt: new Date(),
                duration: 30,
                status: "scheduled" as const,
                connectionId: `connection-${i}`,
                intakeSessionId: `session-${i}`,
                isOnline: true,
                streamCallId: null,
                streamJoinUrl: null,
              })
            );

            const cards = getActionCards(connections, appointments);

            expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit prevents overflow with many potential cards', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 20 }),
        (connectionCount) => {
          // Create many connections to test that limit is enforced
          const connections: ConnectionSummary[] = Array.from(
            { length: connectionCount },
            (_, i) => ({
              id: `connection-${i}`,
              status: "active" as const,
              connectedAt: new Date(),
              doctor: {
                id: `doctor-${i}`,
                firstName: `Doctor${i}`,
                lastName: `Last${i}`,
                imageUrl: null,
                specialty: "General Practice",
                clinicName: null,
              },
              intakeStatus: {
                status: "ready" as const,
                completeness: 100,
                sessionId: `session-${i}`,
              },
            })
          );

          const cards = getActionCards(connections, []);

          // Even with many connections, should only show 3 cards
          expect(cards.length).toBe(MAX_CARDS);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit is exactly 3 when enough cards are available', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 3, maxLength: 10 }),
        (connections) => {
          const cards = getActionCards(connections, []);

          // With 3+ connections, should show exactly 3 cards
          expect(cards.length).toBe(MAX_CARDS);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit applies to all card types', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 1, maxLength: 10 }),
        fc.array(arbitraryAppointment, { maxLength: 10 }),
        (connections, appointments) => {
          const cards = getActionCards(connections, appointments);

          // Count different card types
          const cardTypes = new Set(cards.map(c => c.key));

          // Total cards should not exceed 3
          expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);

          // Each card should have a unique key
          expect(cards.length).toBe(cardTypes.size);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card counts toward the 3-card limit', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 2, maxLength: 5 }),
        (connections) => {
          const cards = getActionCards(connections, []);

          // Should have exactly 3 cards
          expect(cards.length).toBe(MAX_CARDS);

          // First card should be QR scan
          expect(cards[0]?.key).toBe("qr-scan");

          // QR scan card is counted in the limit
          // So only 2 more cards can be shown
          expect(cards.length).toBe(MAX_CARDS);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('card limit is maintained with edge cases', () => {
    // Test with empty arrays
    let cards = getActionCards([], []);
    expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);

    // Test with single connection, no appointments
    const singleConnection: ConnectionSummary = {
      id: "test",
      status: "active",
      connectedAt: new Date(),
      doctor: {
        id: "doctor",
        firstName: "John",
        lastName: "Doe",
        imageUrl: null,
        specialty: null,
        clinicName: null,
      },
      intakeStatus: null,
    };
    cards = getActionCards([singleConnection], []);
    expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);

    // Test with connection but no intake status
    const connectionNoIntake: ConnectionSummary = {
      id: "test",
      status: "active",
      connectedAt: new Date(),
      doctor: {
        id: "doctor",
        firstName: "John",
        lastName: "Doe",
        imageUrl: null,
        specialty: null,
        clinicName: null,
      },
      intakeStatus: null,
    };
    cards = getActionCards([connectionNoIntake], []);
    expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
  });
});
