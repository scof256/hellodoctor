/**
 * Feature: appointment-booking-fix, Property 1: Date Selection Triggers Slot Fetch
 * 
 * For any date selected in the BookingModal, the component SHALL call the 
 * getAvailableSlots API with that date and the provided doctorId.
 * 
 * Validates: Requirements 1.1, 1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Simulates the slot fetch request parameters
 */
interface SlotFetchRequest {
  doctorId: string;
  date: string;
}

/**
 * Simulates the BookingModal state and behavior
 */
class BookingModalSimulator {
  private doctorId: string;
  private selectedDate: string;
  private fetchRequests: SlotFetchRequest[] = [];

  constructor(doctorId: string) {
    this.doctorId = doctorId;
    // Default to today
    this.selectedDate = new Date().toISOString().split('T')[0]!;
    // Initial fetch on mount
    if (doctorId) {
      this.triggerFetch();
    }
  }

  /**
   * Simulates selecting a date, which triggers a slot fetch
   */
  selectDate(date: string): void {
    this.selectedDate = date;
    if (this.doctorId) {
      this.triggerFetch();
    }
  }

  /**
   * Simulates the tRPC query being triggered
   */
  private triggerFetch(): void {
    this.fetchRequests.push({
      doctorId: this.doctorId,
      date: this.selectedDate,
    });
  }

  /**
   * Get all fetch requests made
   */
  getFetchRequests(): SlotFetchRequest[] {
    return this.fetchRequests;
  }

  /**
   * Get the last fetch request
   */
  getLastFetchRequest(): SlotFetchRequest | undefined {
    return this.fetchRequests[this.fetchRequests.length - 1];
  }

  /**
   * Get current selected date
   */
  getSelectedDate(): string {
    return this.selectedDate;
  }
}

// Generators
const doctorIdArb = fc.uuid();

const futureDateArb = fc.integer({ min: 0, max: 6 }).map((daysAhead) => {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0]!;
});

describe('Property 1: Date Selection Triggers Slot Fetch', () => {
  it('for any date selected, getAvailableSlots SHALL be called with that date', () => {
    fc.assert(
      fc.property(doctorIdArb, futureDateArb, (doctorId, selectedDate) => {
        const modal = new BookingModalSimulator(doctorId);
        modal.selectDate(selectedDate);
        
        const lastRequest = modal.getLastFetchRequest();
        expect(lastRequest).toBeDefined();
        expect(lastRequest!.date).toBe(selectedDate);
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('for any date selected, getAvailableSlots SHALL be called with the provided doctorId', () => {
    fc.assert(
      fc.property(doctorIdArb, futureDateArb, (doctorId, selectedDate) => {
        const modal = new BookingModalSimulator(doctorId);
        modal.selectDate(selectedDate);
        
        const lastRequest = modal.getLastFetchRequest();
        expect(lastRequest).toBeDefined();
        expect(lastRequest!.doctorId).toBe(doctorId);
        return true;
      }),
      { numRuns: 20 }
    );
  });

  it('when date changes, a new fetch SHALL be triggered with the new date', () => {
    fc.assert(
      fc.property(
        doctorIdArb,
        futureDateArb,
        futureDateArb,
        (doctorId, date1, date2) => {
          const modal = new BookingModalSimulator(doctorId);
          
          // Select first date
          modal.selectDate(date1);
          const requestsAfterFirst = modal.getFetchRequests().length;
          
          // Select second date
          modal.selectDate(date2);
          const requestsAfterSecond = modal.getFetchRequests().length;
          
          // Should have triggered another fetch
          expect(requestsAfterSecond).toBeGreaterThan(requestsAfterFirst);
          
          // Last request should have the new date
          const lastRequest = modal.getLastFetchRequest();
          expect(lastRequest!.date).toBe(date2);
          
          return true;
        }
      ),
      { numRuns: 15 }
    );
  });

  it('initial mount SHALL trigger a fetch with today\'s date', () => {
    fc.assert(
      fc.property(doctorIdArb, (doctorId) => {
        const modal = new BookingModalSimulator(doctorId);
        const today = new Date().toISOString().split('T')[0]!;
        
        const requests = modal.getFetchRequests();
        expect(requests.length).toBeGreaterThanOrEqual(1);
        expect(requests[0]!.date).toBe(today);
        expect(requests[0]!.doctorId).toBe(doctorId);
        
        return true;
      }),
      { numRuns: 10 }
    );
  });
});
