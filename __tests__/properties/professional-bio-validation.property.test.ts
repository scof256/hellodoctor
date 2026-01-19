/**
 * Feature: doctor-professional-profile, Property 2: Biography Length Validation
 * 
 * For any biography text, the system should accept it if and only if its length
 * is between 50 and 1000 characters inclusive.
 * 
 * Validates: Requirements 2.1, 6.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { professionalBioSchema } from '@/lib/validation';

describe('Property 2: Biography Length Validation', () => {
  it('accepts biographies with length between 50 and 1000 characters inclusive', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        (bio) => {
          const result = professionalBioSchema.safeParse(bio);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(bio);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects biographies shorter than 50 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 49 }),
        (bio) => {
          const result = professionalBioSchema.safeParse(bio);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('at least 50 characters');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects biographies longer than 1000 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1001, maxLength: 2000 }),
        (bio) => {
          const result = professionalBioSchema.safeParse(bio);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0]?.message).toContain('not exceed 1000 characters');
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts biographies at exact boundary values (50 and 1000 characters)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(50, 1000),
        (length) => {
          const bio = 'a'.repeat(length);
          const result = professionalBioSchema.safeParse(bio);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.length).toBe(length);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects biographies at boundary violations (49 and 1001 characters)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(49, 1001),
        (length) => {
          const bio = 'a'.repeat(length);
          const result = professionalBioSchema.safeParse(bio);
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
        fc.string({ minLength: 0, maxLength: 2000 }),
        (bio) => {
          const result1 = professionalBioSchema.safeParse(bio);
          const result2 = professionalBioSchema.safeParse(bio);
          
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

  it('accepts biographies with various character types within valid length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.constantFrom(
          'unicode',
          'numbers',
          'special',
          'mixed'
        ),
        (baseString, type) => {
          let bio = baseString;
          
          // Ensure minimum length
          while (bio.length < 50) {
            switch (type) {
              case 'unicode':
                bio += '你好世界🌍';
                break;
              case 'numbers':
                bio += '1234567890';
                break;
              case 'special':
                bio += '!@#$%^&*()';
                break;
              case 'mixed':
                bio += 'Abc123!@#';
                break;
            }
          }
          
          // Trim to max length
          bio = bio.substring(0, 1000);
          
          const result = professionalBioSchema.safeParse(bio);
          expect(result.success).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
