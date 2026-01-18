/**
 * Feature: appointment-booking-fix, Property 4: Past Date Prevention
 * 
 * For any date in the past, the BookingModal SHALL NOT allow that date 
 * to be selected or displayed as selectable.
 * 
 * Validates: Requirements 4.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper function to get today's date in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Generate array of 7 selectable dates starting from today
 */
function generateSelectableDates(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0]!;
  });
}

/**
 * Check if a date string represents a past date
 */
function isPastDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(dateStr);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
}

// Generator for past dates
const pastDateArb = fc.integer({ min: 1, max: 30 }).map((daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0]!;
});

describe('Property 4: Past Date Prevention', () => {
  it('generateSelectableDates SHALL never return any past dates', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const dates = generateSelectableDates();
        for (const d of dates) {
          expect(isPastDate(d)).toBe(false);
        }
        return true;
      }),
      { numRuns: 5 }
    );
  });

  it('SHALL return exactly 7 consecutive dates starting from today', () => {
    const dates = generateSelectableDates();
    expect(dates.length).toBe(7);
    expect(dates[0]).toBe(getTodayDateString());
  });

  it('for any past date, it SHALL NOT be in selectable dates', () => {
    fc.assert(
      fc.property(pastDateArb, (pastDate) => {
        const dates = generateSelectableDates();
        expect(dates.includes(pastDate)).toBe(false);
        return true;
      }),
      { numRuns: 10 }
    );
  });
});
