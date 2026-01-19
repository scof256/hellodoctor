/**
 * Feature: doctor-professional-profile, Property 3: Years of Experience Bounds
 * 
 * For any years of experience value, the system should accept it if and only if
 * it is a non-negative integer not exceeding 70.
 * 
 * Validates: Requirements 2.3, 6.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { yearsOfExperienceSchema } from '@/lib/validation';

describe('Property 3: Years of Experience Bounds', () => {
  it('accepts years of experience between 0 and 70 inclusive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 70 }),
        (years) => {
          const result = yearsOfExperienceSchema.safeParse(years);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(years);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects negative years of experience', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        (years) => {
          const result = yearsOfExperienceSchema.safeParse(years);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('cannot be negative');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects years of experience exceeding 70', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 71, max: 200 }),
        (years) => {
          const result = yearsOfExperienceSchema.safeParse(years);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('cannot exceed 70');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts years of experience at exact boundary values (0 and 70)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0, 70),
        (years) => {
          const result = yearsOfExperienceSchema.safeParse(years);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(years);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects years of experience at boundary violations (-1 and 71)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(-1, 71),
        (years) => {
          const result = yearsOfExperienceSchema.safeParse(years);
          expect(result.success).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects non-integer values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 70, noNaN: true }).filter(n => !Number.isInteger(n)),
        (years) => {
          const result = yearsOfExperienceSchema.safeParse(years);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('whole number');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects non-numeric values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.object()
        ),
        (value) => {
          const result = yearsOfExperienceSchema.safeParse(value);
          expect(result.success).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation is consistent for the same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 200 }),
        (years) => {
          const result1 = yearsOfExperienceSchema.safeParse(years);
          const result2 = yearsOfExperienceSchema.safeParse(years);
          
          expect(result1.success).toBe(result2.success);
          if (result1.success && result2.success) {
            expect(result1.data).toBe(result2.data);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
