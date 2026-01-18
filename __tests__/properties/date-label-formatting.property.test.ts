/**
 * Feature: message-date-separators, Property 3: Date Label Formatting Correctness
 * 
 * For any date, the formatDateLabel function should return:
 * - "Today" if the date is the current calendar day
 * - "Yesterday" if the date is the previous calendar day
 * - "Month Day" format if the date is in the current year (but not today/yesterday)
 * - "Month Day, Year" format if the date is from a previous year
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatDateLabel } from '@/app/lib/date-utils';

describe('Property 3: Date Label Formatting Correctness', () => {
  it('returns "Today" for current calendar day', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(), max: new Date() }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (baseDate, hours, minutes, seconds) => {
          const now = new Date();
          const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hours,
            minutes,
            seconds
          );
          
          const result = formatDateLabel(today, now);
          expect(result).toBe('Today');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "Yesterday" for previous calendar day', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        (hours, minutes, seconds) => {
          const now = new Date();
          const yesterday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
            hours,
            minutes,
            seconds
          );
          
          const result = formatDateLabel(yesterday, now);
          expect(result).toBe('Yesterday');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "Month Day" format for dates in current year (not today/yesterday)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 365 }), // Days ago (not today or yesterday)
        (daysAgo) => {
          const now = new Date();
          const dateInCurrentYear = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - daysAgo
          );
          
          // Skip if date is in previous year
          if (dateInCurrentYear.getFullYear() !== now.getFullYear()) {
            return true;
          }
          
          const result = formatDateLabel(dateInCurrentYear, now);
          
          // Should not contain year
          expect(result).not.toContain(now.getFullYear().toString());
          // Should contain month name
          const monthName = dateInCurrentYear.toLocaleDateString('en-US', { month: 'long' });
          expect(result).toContain(monthName);
          // Should contain day
          expect(result).toContain(dateInCurrentYear.getDate().toString());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "Month Day, Year" format for dates from previous years', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Years ago
        fc.integer({ min: 0, max: 11 }), // Month
        fc.integer({ min: 1, max: 28 }), // Day (safe for all months)
        (yearsAgo, month, day) => {
          const now = new Date();
          const dateInPreviousYear = new Date(
            now.getFullYear() - yearsAgo,
            month,
            day
          );
          
          const result = formatDateLabel(dateInPreviousYear, now);
          
          // Should contain year
          expect(result).toContain(dateInPreviousYear.getFullYear().toString());
          // Should contain month name
          const monthName = dateInPreviousYear.toLocaleDateString('en-US', { month: 'long' });
          expect(result).toContain(monthName);
          // Should contain day
          expect(result).toContain(dateInPreviousYear.getDate().toString());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('formatting is consistent for same date', () => {
    fc.assert(
      fc.property(
        fc.date(),
        fc.date(),
        (date, now) => {
          const result1 = formatDateLabel(date, now);
          const result2 = formatDateLabel(date, now);
          
          expect(result1).toBe(result2);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
