/**
 * Feature: doctor-professional-profile, Property 11: Completeness Score Recalculation
 * 
 * For any profile update operation, the completeness score should be recalculated
 * immediately and reflect the new state of filled fields.
 * 
 * Validates: Requirements 5.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateProfileCompleteness, type DoctorProfile } from '@/lib/validation';

// Arbitrary generators for profile fields
const arbitraryEducationEntry = fc.record({
  id: fc.uuid(),
  institution: fc.string({ minLength: 1, maxLength: 200 }),
  degree: fc.string({ minLength: 1, maxLength: 100 }),
  fieldOfStudy: fc.option(fc.string({ maxLength: 200 })),
  year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
  isVerified: fc.option(fc.boolean()),
});

const arbitraryCertificationEntry = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 200 }),
  issuingOrganization: fc.string({ minLength: 1, maxLength: 200 }),
  year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
  expiryYear: fc.option(fc.integer({ min: new Date().getFullYear(), max: 2100 })),
  credentialId: fc.option(fc.string({ maxLength: 100 })),
  isVerified: fc.option(fc.boolean()),
});

const arbitraryDoctorProfile = fc.record({
  professionalBio: fc.option(fc.string({ minLength: 0, maxLength: 1500 })),
  yearsOfExperience: fc.option(fc.integer({ min: -5, max: 80 })),
  specializations: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 15 })),
  education: fc.option(fc.array(arbitraryEducationEntry, { maxLength: 25 })),
  certifications: fc.option(fc.array(arbitraryCertificationEntry, { maxLength: 35 })),
  languages: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 25 })),
  profilePhotoUrl: fc.option(fc.webUrl()),
  officeAddress: fc.option(fc.string({ maxLength: 500 })),
});

describe('Property 11: Completeness Score Recalculation', () => {
  it('recalculates score immediately after adding a field', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.string({ minLength: 50, maxLength: 1000 }),
        (initialProfile, newBio) => {
          // Calculate initial score
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update profile with new bio
          const updatedProfile = { ...initialProfile, professionalBio: newBio };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // If initial profile didn't have a valid bio, score should increase
          if (!initialProfile.professionalBio || initialProfile.professionalBio.length < 50) {
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // If it already had a valid bio, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after removing a field', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        (initialProfile) => {
          // Calculate initial score
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Remove professional bio
          const updatedProfile = { ...initialProfile, professionalBio: null };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // If initial profile had a valid bio, score should decrease
          if (initialProfile.professionalBio && initialProfile.professionalBio.length >= 50) {
            expect(updatedScore).toBeLessThan(initialScore);
          } else {
            // If it didn't have a valid bio, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after modifying years of experience', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.integer({ min: 0, max: 70 }),
        (initialProfile, newYears) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update years of experience
          const updatedProfile = { ...initialProfile, yearsOfExperience: newYears };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadValidYears = initialProfile.yearsOfExperience !== null &&
            initialProfile.yearsOfExperience !== undefined &&
            initialProfile.yearsOfExperience >= 0;

          if (!hadValidYears) {
            // Adding valid years should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had valid years, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after adding specializations', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
        (initialProfile, newSpecializations) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update specializations
          const updatedProfile = { ...initialProfile, specializations: newSpecializations };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadSpecializations = initialProfile.specializations &&
            initialProfile.specializations.length > 0;

          if (!hadSpecializations) {
            // Adding specializations should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had specializations, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after adding education entries', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.array(arbitraryEducationEntry, { minLength: 1, maxLength: 3 }),
        (initialProfile, newEducation) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update education
          const updatedProfile = { ...initialProfile, education: newEducation };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadEducation = initialProfile.education && initialProfile.education.length > 0;

          if (!hadEducation) {
            // Adding education should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had education, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after adding certifications', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.array(arbitraryCertificationEntry, { minLength: 1, maxLength: 3 }),
        (initialProfile, newCertifications) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update certifications
          const updatedProfile = { ...initialProfile, certifications: newCertifications };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadCertifications = initialProfile.certifications &&
            initialProfile.certifications.length > 0;

          if (!hadCertifications) {
            // Adding certifications should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had certifications, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after adding languages', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
        (initialProfile, newLanguages) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update languages
          const updatedProfile = { ...initialProfile, languages: newLanguages };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadLanguages = initialProfile.languages && initialProfile.languages.length > 0;

          if (!hadLanguages) {
            // Adding languages should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had languages, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after adding profile photo', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.webUrl(),
        (initialProfile, newPhotoUrl) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update profile photo
          const updatedProfile = { ...initialProfile, profilePhotoUrl: newPhotoUrl };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadPhoto = !!initialProfile.profilePhotoUrl;

          if (!hadPhoto) {
            // Adding photo should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had photo, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('recalculates score immediately after adding office address', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.string({ minLength: 1, maxLength: 500 }),
        (initialProfile, newAddress) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update office address
          const updatedProfile = { ...initialProfile, officeAddress: newAddress };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Check if the change should affect the score
          const hadAddress = !!initialProfile.officeAddress;

          if (!hadAddress) {
            // Adding address should increase score
            expect(updatedScore).toBeGreaterThan(initialScore);
          } else {
            // Already had address, score should stay the same
            expect(updatedScore).toBe(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reflects multiple simultaneous updates correctly', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 70 }),
        (initialProfile, newBio, newSpecializations, newYears) => {
          const initialScore = calculateProfileCompleteness(initialProfile);

          // Update multiple fields at once
          const updatedProfile = {
            ...initialProfile,
            professionalBio: newBio,
            specializations: newSpecializations,
            yearsOfExperience: newYears,
          };
          const updatedScore = calculateProfileCompleteness(updatedProfile);

          // Score should reflect all changes
          // At minimum, it should not be less than initial if we're adding valid fields
          const hadValidBio = initialProfile.professionalBio &&
            initialProfile.professionalBio.length >= 50;
          const hadSpecializations = initialProfile.specializations &&
            initialProfile.specializations.length > 0;
          const hadValidYears = initialProfile.yearsOfExperience !== null &&
            initialProfile.yearsOfExperience !== undefined &&
            initialProfile.yearsOfExperience >= 0;

          // If we're adding any new valid fields, score should increase
          if (!hadValidBio || !hadSpecializations || !hadValidYears) {
            expect(updatedScore).toBeGreaterThanOrEqual(initialScore);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is idempotent - recalculating without changes returns same score', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        (profile) => {
          const score1 = calculateProfileCompleteness(profile);
          const score2 = calculateProfileCompleteness(profile);
          const score3 = calculateProfileCompleteness(profile);

          expect(score1).toBe(score2);
          expect(score2).toBe(score3);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles rapid successive updates correctly', () => {
    // Simulate rapid updates to the same profile
    const profile: DoctorProfile = {};
    const scores: number[] = [];

    // Add fields one by one and track scores
    scores.push(calculateProfileCompleteness(profile));

    profile.professionalBio = 'a'.repeat(100);
    scores.push(calculateProfileCompleteness(profile));

    profile.specializations = ['Cardiology'];
    scores.push(calculateProfileCompleteness(profile));

    profile.yearsOfExperience = 10;
    scores.push(calculateProfileCompleteness(profile));

    profile.education = [{
      id: '123e4567-e89b-12d3-a456-426614174000',
      institution: 'Medical School',
      degree: 'MD',
      year: 2010,
    }];
    scores.push(calculateProfileCompleteness(profile));

    // Each score should be greater than or equal to the previous
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  it('correctly reflects field invalidation', () => {
    // Start with a valid profile
    const profile: DoctorProfile = {
      professionalBio: 'a'.repeat(100),
      yearsOfExperience: 10,
    };

    const initialScore = calculateProfileCompleteness(profile);
    expect(initialScore).toBeGreaterThan(0);

    // Invalidate bio by making it too short
    profile.professionalBio = 'short';
    const scoreAfterInvalidBio = calculateProfileCompleteness(profile);
    expect(scoreAfterInvalidBio).toBeLessThan(initialScore);

    // Invalidate years by making it negative
    profile.yearsOfExperience = -5;
    const scoreAfterInvalidYears = calculateProfileCompleteness(profile);
    expect(scoreAfterInvalidYears).toBe(0);
  });
});
