/**
 * Feature: doctor-professional-profile, Property 4: Education Year Validation
 * 
 * For any education entry, the year field should be accepted if and only if
 * it is a four-digit year between 1950 and the current year inclusive.
 * 
 * Validates: Requirements 2.4, 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { educationEntrySchema } from '@/lib/validation';

const currentYear = new Date().getFullYear();

describe('Property 4: Education Year Validation', () => {
  it('accepts education entries with years between 1950 and current year inclusive', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          fieldOfStudy: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
          year: fc.integer({ min: 1950, max: currentYear }),
          isVerified: fc.option(fc.boolean(), { nil: undefined }),
        }),
        (entry) => {
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.year).toBe(entry.year);
            expect(result.data.year).toBeGreaterThanOrEqual(1950);
            expect(result.data.year).toBeLessThanOrEqual(currentYear);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects education entries with years before 1950', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.integer({ min: 1800, max: 1949 }),
        }),
        (entry) => {
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('year') && issue.message.includes('1950')
            )).toBe(true);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects education entries with years in the future', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.integer({ min: currentYear + 1, max: currentYear + 100 }),
        }),
        (entry) => {
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('year')
            )).toBe(true);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts education entries at exact boundary values (1950 and current year)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1950, currentYear),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (year, id, institution, degree) => {
          const entry = { id, institution, degree, year };
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.year).toBe(year);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects education entries at boundary violations (1949 and current year + 1)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1949, currentYear + 1),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (year, id, institution, degree) => {
          const entry = { id, institution, degree, year };
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects education entries with non-integer year values', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.double({ min: 1950, max: currentYear, noNaN: true }).filter(n => !Number.isInteger(n)),
        }),
        (entry) => {
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('year') && issue.message.includes('whole number')
            )).toBe(true);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects education entries with non-numeric year values', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.oneof(
            fc.string(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ) as fc.Arbitrary<any>,
        }),
        (entry) => {
          const result = educationEntrySchema.safeParse(entry);
          expect(result.success).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects education entries with missing required fields', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1950, max: currentYear }),
        (year) => {
          const entry1 = { id: '123e4567-e89b-12d3-a456-426614174000', degree: 'PhD', year };
          const result1 = educationEntrySchema.safeParse(entry1);
          expect(result1.success).toBe(false);

          const entry2 = { id: '123e4567-e89b-12d3-a456-426614174000', institution: 'MIT', year };
          const result2 = educationEntrySchema.safeParse(entry2);
          expect(result2.success).toBe(false);

          const entry3 = { id: '123e4567-e89b-12d3-a456-426614174000', institution: 'MIT', degree: 'PhD' };
          const result3 = educationEntrySchema.safeParse(entry3);
          expect(result3.success).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation is consistent for the same input', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.integer({ min: 1900, max: currentYear + 50 }),
        }),
        (entry) => {
          const result1 = educationEntrySchema.safeParse(entry);
          const result2 = educationEntrySchema.safeParse(entry);
          
          expect(result1.success).toBe(result2.success);
          if (result1.success && result2.success) {
            expect(result1.data).toEqual(result2.data);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
