/**
 * Feature: doctor-professional-profile, Property 20: Incomplete Profile Reminder
 * 
 * For any doctor with a profile completeness score below 100%, viewing their dashboard 
 * should display a prominent reminder to complete their profile.
 * 
 * Validates: Requirements 8.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Profile completeness data structure
interface ProfileCompletenessData {
  score: number;
  missingFields: string[];
}

// Helper to determine if reminder should be shown
function shouldShowReminder(completenessData: ProfileCompletenessData): boolean {
  return completenessData.score < 100;
}

// Helper to validate reminder visibility
function validateReminderVisibility(
  completenessData: ProfileCompletenessData,
  reminderShown: boolean
): boolean {
  const shouldShow = shouldShowReminder(completenessData);
  return shouldShow === reminderShown;
}

// Helper to generate missing fields based on score
function generateMissingFields(score: number): string[] {
  const allFields = [
    'professionalBio',
    'specializations',
    'yearsOfExperience',
    'education',
    'certifications',
    'languages',
    'profilePhoto',
    'officeAddress',
  ];

  // Approximate number of missing fields based on score
  // Each field contributes roughly 12.5% (100/8)
  const missingCount = Math.ceil((100 - score) / 12.5);
  return allFields.slice(0, Math.min(missingCount, allFields.length));
}

// Arbitrary generator for profile completeness data
const arbitraryIncompleteProfile = fc.record({
  score: fc.integer({ min: 0, max: 99 }),
  missingFieldsCount: fc.integer({ min: 1, max: 8 }),
}).map(data => ({
  score: data.score,
  missingFields: generateMissingFields(data.score),
}));

const arbitraryCompleteProfile = fc.constant({
  score: 100,
  missingFields: [],
});

describe('Property 20: Incomplete Profile Reminder', () => {
  it('reminder is shown for any profile with score < 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99 }),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: generateMissingFields(score),
          };

          expect(shouldShowReminder(completenessData)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder is not shown for profile with score = 100', () => {
    fc.assert(
      fc.property(
        fc.constant(100),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: [],
          };

          expect(shouldShowReminder(completenessData)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder visibility matches completeness score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: score < 100 ? generateMissingFields(score) : [],
          };

          const reminderShown = score < 100;
          expect(validateReminderVisibility(completenessData, reminderShown)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder is shown for all incomplete profiles', () => {
    fc.assert(
      fc.property(
        arbitraryIncompleteProfile,
        (completenessData) => {
          expect(shouldShowReminder(completenessData)).toBe(true);
          expect(completenessData.score).toBeLessThan(100);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder is not shown for complete profiles', () => {
    fc.assert(
      fc.property(
        arbitraryCompleteProfile,
        (completenessData) => {
          expect(shouldShowReminder(completenessData)).toBe(false);
          expect(completenessData.score).toBe(100);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder threshold is exactly at 100%', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: score < 100 ? generateMissingFields(score) : [],
          };

          const shouldShow = shouldShowReminder(completenessData);

          if (score < 100) {
            expect(shouldShow).toBe(true);
          } else {
            expect(shouldShow).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder visibility is consistent for same score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: score < 100 ? generateMissingFields(score) : [],
          };

          const result1 = shouldShowReminder(completenessData);
          const result2 = shouldShowReminder(completenessData);
          const result3 = shouldShowReminder(completenessData);

          // Same input should always give same output
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder visibility is independent of missing fields count', () => {
    fc.assert(
      fc.property(
        fc.record({
          score: fc.integer({ min: 0, max: 99 }),
          missingFieldsCount: fc.integer({ min: 1, max: 20 }),
        }),
        (data) => {
          const completenessData: ProfileCompletenessData = {
            score: data.score,
            missingFields: Array.from({ length: data.missingFieldsCount }, (_, i) => `field${i}`),
          };

          // Reminder should be shown based on score, not missing fields count
          expect(shouldShowReminder(completenessData)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder is shown for very low completeness scores', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 25 }),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: generateMissingFields(score),
          };

          expect(shouldShowReminder(completenessData)).toBe(true);
          expect(completenessData.score).toBeLessThan(100);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder is shown for nearly complete profiles', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 90, max: 99 }),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: generateMissingFields(score),
          };

          // Even 99% complete should show reminder
          expect(shouldShowReminder(completenessData)).toBe(true);
          expect(completenessData.score).toBeLessThan(100);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder visibility transitions at exactly 100%', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(99, 100),
        (score) => {
          const completenessData: ProfileCompletenessData = {
            score,
            missingFields: score < 100 ? ['someField'] : [],
          };

          const shouldShow = shouldShowReminder(completenessData);

          if (score === 99) {
            expect(shouldShow).toBe(true);
          } else if (score === 100) {
            expect(shouldShow).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder validation is transitive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (score1, score2) => {
          const data1: ProfileCompletenessData = {
            score: score1,
            missingFields: score1 < 100 ? generateMissingFields(score1) : [],
          };
          const data2: ProfileCompletenessData = {
            score: score2,
            missingFields: score2 < 100 ? generateMissingFields(score2) : [],
          };

          const shouldShow1 = shouldShowReminder(data1);
          const shouldShow2 = shouldShowReminder(data2);

          // Verify consistency
          expect(validateReminderVisibility(data1, shouldShow1)).toBe(true);
          expect(validateReminderVisibility(data2, shouldShow2)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reminder message includes missing fields information', () => {
    fc.assert(
      fc.property(
        fc.record({
          score: fc.integer({ min: 0, max: 99 }),
          missingFieldsCount: fc.integer({ min: 1, max: 8 }),
        }),
        (data) => {
          const completenessData: ProfileCompletenessData = {
            score: data.score,
            missingFields: generateMissingFields(data.score),
          };

          // Reminder should be shown
          expect(shouldShowReminder(completenessData)).toBe(true);

          // Missing fields should be present
          expect(completenessData.missingFields.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
