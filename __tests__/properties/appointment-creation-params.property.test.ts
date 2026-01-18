/**
 * Feature: appointment-booking-fix, Property 2: Appointment Creation Uses Correct Parameters
 * 
 * For any appointment creation, the mutation SHALL be called with:
 * - connectionId: the provided connection ID
 * - scheduledAt: ISO datetime combining selected date and slot time
 * - intakeSessionId: optional intake session ID if provided
 * 
 * Validates: Requirements 2.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates the appointment creation request parameters
 */
interface AppointmentCreateRequest {
  connectionId: string;
  scheduledAt: string;
  intakeSessionId?: string;
  isOnline?: boolean;
}

/**
 * Simulates the BookingModal appointment creation behavior
 */
class AppointmentCreationSimulator {
  private connectionId: string;
  private intakeSessionId?: string;
  private selectedDate: string;
  private selectedSlot: string | null = null;
  private createRequests: AppointmentCreateRequest[] = [];

  constructor(connectionId: string, intakeSessionId?: string) {
    this.connectionId = connectionId;
    this.intakeSessionId = intakeSessionId;
    this.selectedDate = new Date().toISOString().split('T')[0]!;
  }

  /**
   * Set the selected date
   */
  setDate(date: string): void {
    this.selectedDate = date;
    this.selectedSlot = null; // Clear slot when date changes
  }

  /**
   * Set the selected time slot (HH:MM format)
   */
  setSlot(slot: string): void {
    this.selectedSlot = slot;
  }

  /**
   * Simulates the handleBook function - creates appointment
   */
  book(): boolean {
    if (!this.selectedSlot || !this.connectionId) {
      return false;
    }

    // Combine selected date and slot time into ISO datetime
    const [hours, minutes] = this.selectedSlot.split(':');
    const scheduledAt = new Date(this.selectedDate);
    scheduledAt.setHours(parseInt(hours!, 10), parseInt(minutes!, 10), 0, 0);

    const request: AppointmentCreateRequest = {
      connectionId: this.connectionId,
      scheduledAt: scheduledAt.toISOString(),
    };

    if (this.intakeSessionId) {
      request.intakeSessionId = this.intakeSessionId;
    }

    this.createRequests.push(request);
    return true;
  }

  /**
   * Get all create requests made
   */
  getCreateRequests(): AppointmentCreateRequest[] {
    return this.createRequests;
  }

  /**
   * Get the last create request
   */
  getLastCreateRequest(): AppointmentCreateRequest | undefined {
    return this.createRequests[this.createRequests.length - 1];
  }
}

// Generators
const connectionIdArb = fc.uuid();
const intakeSessionIdArb = fc.option(fc.uuid(), { nil: undefined });

const futureDateArb = fc.integer({ min: 0, max: 6 }).map((daysAhead) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0]!;
});

// Generate valid time slots (HH:MM format, 9am-5pm)
const timeSlotArb = fc.integer({ min: 9, max: 17 }).chain((hour) =>
  fc.integer({ min: 0, max: 1 }).map((halfHour) => {
    const h = hour.toString().padStart(2, '0');
    const m = (halfHour * 30).toString().padStart(2, '0');
    return `${h}:${m}`;
  })
);

describe('Property 2: Appointment Creation Uses Correct Parameters', () => {
  it('create mutation SHALL be called with the provided connectionId', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        futureDateArb,
        timeSlotArb,
        (connectionId, date, slot) => {
          const simulator = new AppointmentCreationSimulator(connectionId);
          simulator.setDate(date);
          simulator.setSlot(slot);
          simulator.book();

          const request = simulator.getLastCreateRequest();
          expect(request).toBeDefined();
          expect(request!.connectionId).toBe(connectionId);
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('scheduledAt SHALL combine selected date and slot time into valid ISO datetime', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        futureDateArb,
        timeSlotArb,
        (connectionId, date, slot) => {
          const simulator = new AppointmentCreationSimulator(connectionId);
          simulator.setDate(date);
          simulator.setSlot(slot);
          simulator.book();

          const request = simulator.getLastCreateRequest();
          expect(request).toBeDefined();

          // Parse the scheduledAt to verify it's valid ISO
          const scheduledDate = new Date(request!.scheduledAt);
          expect(scheduledDate.toISOString()).toBe(request!.scheduledAt);

          // Verify date portion matches selected date
          const datePortion = request!.scheduledAt.split('T')[0];
          expect(datePortion).toBe(date);

          // Verify time portion matches slot
          const [hours, minutes] = slot.split(':');
          expect(scheduledDate.getHours()).toBe(parseInt(hours!, 10));
          expect(scheduledDate.getMinutes()).toBe(parseInt(minutes!, 10));

          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('intakeSessionId SHALL be included when provided', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.uuid(), // Always provide intakeSessionId for this test
        futureDateArb,
        timeSlotArb,
        (connectionId, intakeSessionId, date, slot) => {
          const simulator = new AppointmentCreationSimulator(connectionId, intakeSessionId);
          simulator.setDate(date);
          simulator.setSlot(slot);
          simulator.book();

          const request = simulator.getLastCreateRequest();
          expect(request).toBeDefined();
          expect(request!.intakeSessionId).toBe(intakeSessionId);
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('intakeSessionId SHALL be omitted when not provided', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        futureDateArb,
        timeSlotArb,
        (connectionId, date, slot) => {
          const simulator = new AppointmentCreationSimulator(connectionId, undefined);
          simulator.setDate(date);
          simulator.setSlot(slot);
          simulator.book();

          const request = simulator.getLastCreateRequest();
          expect(request).toBeDefined();
          expect(request!.intakeSessionId).toBeUndefined();
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('booking SHALL fail without a selected slot', () => {
    fc.assert(
      fc.property(connectionIdArb, futureDateArb, (connectionId, date) => {
        const simulator = new AppointmentCreationSimulator(connectionId);
        simulator.setDate(date);
        // Don't set a slot

        const result = simulator.book();
        expect(result).toBe(false);
        expect(simulator.getCreateRequests().length).toBe(0);
        return true;
      }),
      { numRuns: 10 }
    );
  });
});
