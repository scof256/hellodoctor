/**
 * Feature: doctor-professional-profile, Property 10: Completeness Score Calculation
 * 
 * For any profile state, the completeness score should be between 0 and 100 inclusive,
 * and should increase monotonically as more required fields are filled.
 * 
 * Validates: Requirements 5.1, 5.2, 5.3
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

describe('Property 10: Completeness Score Calculation', () => {
  it('returns a score between 0 and 100 inclusive for any profile', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        (profile) => {
          const score = calculateProfileCompleteness(profile);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isInteger(score)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns 0 for an empty profile', () => {
    const emptyProfile: DoctorProfile = {};
    const score = calculateProfileCompleteness(emptyProfile);
    expect(score).toBe(0);
  });

  it('returns 0 for a profile with all null/undefined fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalBio: fc.constantFrom(null, undefined),
          yearsOfExperience: fc.constantFrom(null, undefined),
          specializations: fc.constantFrom(null, undefined, []),
          education: fc.constantFrom(null, undefined, []),
          certifications: fc.constantFrom(null, undefined, []),
          languages: fc.constantFrom(null, undefined, []),
          profilePhotoUrl: fc.constantFrom(null, undefined),
          officeAddress: fc.constantFrom(null, undefined),
        }),
        (profile) => {
          const score = calculateProfileCompleteness(profile);
          expect(score).toBe(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('increases score monotonically as fields are filled', () => {
    // Start with empty profile
    const profile: DoctorProfile = {};
    let previousScore = calculateProfileCompleteness(profile);
    expect(previousScore).toBe(0);

    // Add professional bio (50+ chars)
    profile.professionalBio = 'a'.repeat(50);
    let currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add specializations
    profile.specializations = ['Cardiology'];
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add years of experience
    profile.yearsOfExperience = 5;
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add education
    profile.education = [{
      id: '123e4567-e89b-12d3-a456-426614174000',
      institution: 'Medical School',
      degree: 'MD',
      year: 2010,
    }];
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add certifications
    profile.certifications = [{
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Board Certified',
      issuingOrganization: 'Medical Board',
      year: 2015,
    }];
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add languages
    profile.languages = ['English'];
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add profile photo
    profile.profilePhotoUrl = 'https://example.com/photo.jpg';
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    previousScore = currentScore;

    // Add office address
    profile.officeAddress = '123 Main St';
    currentScore = calculateProfileCompleteness(profile);
    expect(currentScore).toBeGreaterThan(previousScore);
    expect(currentScore).toBe(100);
  });

  it('does not count professional bio shorter than 50 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 49 }),
        (shortBio) => {
          const profile: DoctorProfile = { professionalBio: shortBio };
          const score = calculateProfileCompleteness(profile);
          expect(score).toBe(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('counts professional bio of 50 or more characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        (validBio) => {
          const profile: DoctorProfile = { professionalBio: validBio };
          const score = calculateProfileCompleteness(profile);
          expect(score).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not count negative years of experience', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: -1 }),
        (negativeYears) => {
          const profile: DoctorProfile = { yearsOfExperience: negativeYears };
          const score = calculateProfileCompleteness(profile);
          expect(score).toBe(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('counts zero or positive years of experience', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 70 }),
        (validYears) => {
          const profile: DoctorProfile = { yearsOfExperience: validYears };
          const score = calculateProfileCompleteness(profile);
          expect(score).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not count empty arrays', () => {
    const profile: DoctorProfile = {
      specializations: [],
      education: [],
      certifications: [],
      languages: [],
    };
    const score = calculateProfileCompleteness(profile);
    expect(score).toBe(0);
  });

  it('counts non-empty arrays', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        fc.array(arbitraryEducationEntry, { minLength: 1, maxLength: 5 }),
        fc.array(arbitraryCertificationEntry, { minLength: 1, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        (specializations, education, certifications, languages) => {
          const profile: DoctorProfile = {
            specializations,
            education,
            certifications,
            languages,
          };
          const score = calculateProfileCompleteness(profile);
          expect(score).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('is deterministic - same profile always returns same score', () => {
    fc.assert(
      fc.property(
        arbitraryDoctorProfile,
        (profile) => {
          const score1 = calculateProfileCompleteness(profile);
          const score2 = calculateProfileCompleteness(profile);
          expect(score1).toBe(score2);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles null and undefined fields gracefully', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalBio: fc.option(fc.string({ minLength: 50, maxLength: 1000 }), { nil: null }),
          yearsOfExperience: fc.option(fc.integer({ min: 0, max: 70 }), { nil: null }),
          specializations: fc.option(fc.array(fc.string({ minLength: 1 })), { nil: null }),
          education: fc.option(fc.array(arbitraryEducationEntry), { nil: null }),
          certifications: fc.option(fc.array(arbitraryCertificationEntry), { nil: null }),
          languages: fc.option(fc.array(fc.string({ minLength: 1 })), { nil: null }),
          profilePhotoUrl: fc.option(fc.webUrl(), { nil: null }),
          officeAddress: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
        }),
        (profile) => {
          // Should not throw
          const score = calculateProfileCompleteness(profile);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('adding more items to arrays does not decrease score', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.string({ minLength: 1 }),
        (initialArray, newItem) => {
          const profile1: DoctorProfile = { specializations: initialArray };
          const score1 = calculateProfileCompleteness(profile1);

          const profile2: DoctorProfile = { specializations: [...initialArray, newItem] };
          const score2 = calculateProfileCompleteness(profile2);

          expect(score2).toBeGreaterThanOrEqual(score1);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removing fields decreases or maintains score', () => {
    // Start with a complete profile
    const completeProfile: DoctorProfile = {
      professionalBio: 'a'.repeat(100),
      yearsOfExperience: 10,
      specializations: ['Cardiology'],
      education: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        institution: 'Medical School',
        degree: 'MD',
        year: 2010,
      }],
      certifications: [{
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Board Certified',
        issuingOrganization: 'Medical Board',
        year: 2015,
      }],
      languages: ['English'],
      profilePhotoUrl: 'https://example.com/photo.jpg',
      officeAddress: '123 Main St',
    };

    const completeScore = calculateProfileCompleteness(completeProfile);

    // Remove each field and verify score decreases or stays same
    const fieldsToRemove: (keyof DoctorProfile)[] = [
      'professionalBio',
      'yearsOfExperience',
      'specializations',
      'education',
      'certifications',
      'languages',
      'profilePhotoUrl',
      'officeAddress',
    ];

    fieldsToRemove.forEach((field) => {
      const partialProfile = { ...completeProfile };
      delete partialProfile[field];
      const partialScore = calculateProfileCompleteness(partialProfile);
      expect(partialScore).toBeLessThanOrEqual(completeScore);
    });
  });
});
