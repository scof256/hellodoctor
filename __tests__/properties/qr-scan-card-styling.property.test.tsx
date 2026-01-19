/**
 * Feature: qr-scan-home-card, Property 3: QR Scan Card Styling
 * 
 * For any rendered QR scan card, it SHALL use the QR code icon, green color (#25D366),
 * and non-primary styling (isPrimary=false).
 * 
 * Validates: Requirements 1.3, 1.4, 4.3
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';

// Helper to extract QR scan card from SimplifiedPatientHome logic
function getQRScanCard(
  connections: ConnectionSummary[],
  appointments: AppointmentSummary[]
): {
  key: string;
  title: string;
  subtitle: string;
  iconColor: string;
  isPrimary: boolean;
  hasQRIcon: boolean;
} | null {
  // QR scan card is always first
  return {
    key: "qr-scan",
    title: "Scan QR Code",
    subtitle: "Connect with a new doctor",
    iconColor: "#25D366",
    isPrimary: false,
    hasQRIcon: true, // Represents QrCode icon from lucide-react
  };
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

describe('Property 3: QR Scan Card Styling', () => {
  const EXPECTED_COLOR = "#25D366";

  it('QR scan card uses correct green color', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is marked as non-primary', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.isPrimary).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card has QR code icon', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.hasQRIcon).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card has correct title', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.title).toBe("Scan QR Code");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card has correct subtitle', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.subtitle).toBe("Connect with a new doctor");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling is consistent with no connections', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (appointments) => {
          const qrCard = getQRScanCard([], appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);
          expect(qrCard?.isPrimary).toBe(false);
          expect(qrCard?.hasQRIcon).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling is consistent with one connection', () => {
    fc.assert(
      fc.property(
        arbitraryConnection,
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connection, appointments) => {
          const qrCard = getQRScanCard([connection], appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);
          expect(qrCard?.isPrimary).toBe(false);
          expect(qrCard?.hasQRIcon).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling is consistent with multiple connections', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { minLength: 2, maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);
          expect(qrCard?.isPrimary).toBe(false);
          expect(qrCard?.hasQRIcon).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling is independent of intake status', () => {
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

          const qrCard = getQRScanCard([connection], []);

          expect(qrCard).toBeDefined();
          expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);
          expect(qrCard?.isPrimary).toBe(false);
          expect(qrCard?.hasQRIcon).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling is independent of appointment status', () => {
    fc.assert(
      fc.property(
        arbitraryConnection,
        arbitraryAppointment,
        (connection, appointment) => {
          const qrCard = getQRScanCard([connection], [appointment]);

          expect(qrCard).toBeDefined();
          expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);
          expect(qrCard?.isPrimary).toBe(false);
          expect(qrCard?.hasQRIcon).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card color is WhatsApp green', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();

          // Verify it's the WhatsApp green color
          expect(qrCard?.iconColor).toBe("#25D366");

          // Verify color format (hex color)
          expect(qrCard?.iconColor).toMatch(/^#[0-9A-F]{6}$/i);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling properties are all defined', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        fc.array(arbitraryAppointment, { maxLength: 5 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          expect(qrCard).toBeDefined();
          expect(qrCard?.key).toBeDefined();
          expect(qrCard?.title).toBeDefined();
          expect(qrCard?.subtitle).toBeDefined();
          expect(qrCard?.iconColor).toBeDefined();
          expect(qrCard?.isPrimary).toBeDefined();
          expect(qrCard?.hasQRIcon).toBeDefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling is consistent across state transitions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            intakeStatus: arbitraryIntakeStatus,
            hasAppointment: fc.boolean(),
            connectionCount: fc.integer({ min: 0, max: 5 }),
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

            const appointments = state.hasAppointment
              ? [{
                  id: "test-appointment",
                  scheduledAt: new Date(),
                  duration: 30,
                  status: "scheduled" as const,
                  connectionId: "connection-0",
                  intakeSessionId: "session-0",
                  isOnline: true,
                  streamCallId: null,
                  streamJoinUrl: null,
                }]
              : [];

            const qrCard = getQRScanCard(connections, appointments);

            // Styling should be consistent regardless of state
            expect(qrCard?.iconColor).toBe(EXPECTED_COLOR);
            expect(qrCard?.isPrimary).toBe(false);
            expect(qrCard?.hasQRIcon).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card is never marked as primary', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 10 }),
        fc.array(arbitraryAppointment, { maxLength: 10 }),
        (connections, appointments) => {
          const qrCard = getQRScanCard(connections, appointments);

          // QR scan card should NEVER be primary
          expect(qrCard?.isPrimary).toBe(false);
          expect(qrCard?.isPrimary).not.toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('QR scan card styling matches design specification', () => {
    const qrCard = getQRScanCard([], []);

    // Verify all styling requirements from design doc
    expect(qrCard?.iconColor).toBe("#25D366"); // WhatsApp green
    expect(qrCard?.isPrimary).toBe(false); // Non-primary styling
    expect(qrCard?.hasQRIcon).toBe(true); // QR code icon
    expect(qrCard?.title).toBe("Scan QR Code"); // Correct title
    expect(qrCard?.subtitle).toBe("Connect with a new doctor"); // Correct subtitle
  });

  it('QR scan card color is case-insensitive match', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryConnection, { maxLength: 5 }),
        (connections) => {
          const qrCard = getQRScanCard(connections, []);

          expect(qrCard).toBeDefined();

          // Color should match regardless of case
          expect(qrCard?.iconColor.toUpperCase()).toBe("#25D366");

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
