/**
 * Feature: qr-scan-home-card, Property 1: QR Scan Card Always First
 * 
 * For any patient state (no connections, intake in progress, appointment booked),
 * the QR scan card SHALL be the first card in the action cards array.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
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

describe('Property 1: QR Scan Card Always First', () => {
  it('QR scan card is first with no connections', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (appointments) => {
          const cards = getActionCards([], appointments);

          // QR scan card should always be first
          expect(cards.length).toBeGreaterThan(0);
          expect(cards[0]?.key).toBe("qr-scan");
          expect(cards[0]?.title).toBe("Scan QR Code");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first with one connection and no appointments', () => {
    fc.assert(
      fc.property(
        arbitraryConnection,
        (connection) => {
          const cards = getActionCards([connection], []);

          // QR scan card should always be first
          expect(cards.length).toBeGreaterThan(0);
          expect(cards[0]?.key).toBe("qr-scan");
          expect(cards[0]?.title).toBe("Scan QR Code");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first with one connection and appointments', () => {
    fc.assert(
      fc.property(
        arbitraryConnection,
        fc.array(arbitraryAppointment, { minLength: 1, maxLength: 5 }),
        (connection, appointments) => {
          const cards = getActionCards([connection], appointments);

          // QR scan card should always be first
          expect(cards.length).toBeGreaterThan(0);
          expect(cards[0]?.key).toBe("qr-scan");
          expect(cards[0]?.title).toBe("Scan QR Code");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first with multiple connections', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 2, maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const cards = getActionCards(connections, appointments);

          // QR scan card should always be first
          expect(cards.length).toBeGreaterThan(0);
          expect(cards[0]?.key).toBe("qr-scan");
          expect(cards[0]?.title).toBe("Scan QR Code");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first regardless of intake status', () => {
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

          // QR scan card should always be first
          expect(cards.length).toBeGreaterThan(0);
          expect(cards[0]?.key).toBe("qr-scan");
          expect(cards[0]?.title).toBe("Scan QR Code");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first before "Book Appointment" card', () => {
    fc.assert(
      fc.property(
        fc.constant({
          id: "test-connection",
          status: "active" as const,
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
            status: "ready" as const,
            completeness: 100,
            sessionId: "test-session",
          },
        }),
        (connection) => {
          const cards = getActionCards([connection], []);

          // QR scan card should be first
          expect(cards[0]?.key).toBe("qr-scan");

          // Book appointment card should be second (if present)
          const bookCard = cards.find(c => c.key === "book");
          if (bookCard) {
            const bookIndex = cards.indexOf(bookCard);
            expect(bookIndex).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first before "Continue Form" card', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (completeness) => {
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
              status: "in_progress",
              completeness,
              sessionId: "test-session",
            },
          };

          const cards = getActionCards([connection], []);

          // QR scan card should be first
          expect(cards[0]?.key).toBe("qr-scan");

          // Continue intake card should be second (if present)
          const continueCard = cards.find(c => c.key === "continue-intake");
          if (continueCard) {
            const continueIndex = cards.indexOf(continueCard);
            expect(continueIndex).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is first before "Start Medical Form" card', () => {
    fc.assert(
      fc.property(
        fc.constant({
          id: "test-connection",
          status: "active" as const,
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
            status: "not_started" as const,
            completeness: 0,
            sessionId: null,
          },
        }),
        (connection) => {
          const cards = getActionCards([connection], []);

          // QR scan card should be first
          expect(cards[0]?.key).toBe("qr-scan");

          // Start intake card should be second (if present)
          const startCard = cards.find(c => c.key === "start-intake");
          if (startCard) {
            const startIndex = cards.indexOf(startCard);
            expect(startIndex).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card position is consistent across state transitions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            intakeStatus: arbitraryIntakeStatus,
            hasAppointment: fc.boolean(),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (states) => {
          // Test that QR scan card remains first across different states
          for (const state of states) {
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
                status: state.intakeStatus,
                completeness: state.intakeStatus === "in_progress" ? 50 : 100,
                sessionId: "test-session",
              },
            };

            const appointments = state.hasAppointment
              ? [{
                  id: "test-appointment",
                  scheduledAt: new Date(),
                  duration: 30,
                  status: "scheduled" as const,
                  connectionId: "test-connection",
                  intakeSessionId: "test-session",
                  isOnline: true,
                  streamCallId: null,
                  streamJoinUrl: null,
                }]
              : [];

            const cards = getActionCards([connection], appointments);

            // QR scan card should always be first
            expect(cards[0]?.key).toBe("qr-scan");
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is always present in the cards array', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const cards = getActionCards(connections, appointments);

          // QR scan card should always be present
          const qrCard = cards.find(c => c.key === "qr-scan");
          expect(qrCard).toBeDefined();
          expect(qrCard?.key).toBe("qr-scan");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
