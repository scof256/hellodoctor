/**
 * Feature: doctor-professional-profile, Property 12: Required Fields for Full Completeness
 * 
 * For any profile, achieving 100% completeness requires all of the following fields
 * to be filled: professionalBio, specializations (at least one), yearsOfExperience,
 * education (at least one entry), profilePhotoUrl.
 * 
 * Validates: Requirements 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateProfileCompleteness, type DoctorProfile } from '@/lib/validation';

describe('Property 12: Required Fields for Full Completeness', () => {
  it('achieves 100% completeness only when all required fields are filled', () => {
    // Complete profile with all required fields
    const completeProfile: DoctorProfile = {
      professionalBio: 'a'.repeat(100), // Valid bio (50+ chars)
      specializations: ['Cardiology'], // At least one specialization
      yearsOfExperience: 10, // Valid years
      education: [{ // At least one education entry
        id: '123e4567-e89b-12d3-a456-426614174000',
        institution: 'Medical School',
        degree: 'MD',
        year: 2010,
      }],
      certifications: [{ // Optional but included
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Board Certified',
        issuingOrganization: 'Medical Board',
        year: 2015,
      }],
      languages: ['English'], // Optional but included
      profilePhotoUrl: 'https://example.com/photo.jpg', // Required
      officeAddress: '123 Main St', // Optional but included
    };

    const score = calculateProfileCompleteness(completeProfile);
    expect(score).toBe(100);
  });

  it('does not achieve 100% without professional bio', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 70 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        (specializations, yearsOfExperience, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            // professionalBio is missing or invalid
            professionalBio: null,
            specializations,
            yearsOfExperience,
            education,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not achieve 100% without specializations', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.integer({ min: 0, max: 70 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        (professionalBio, yearsOfExperience, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            // specializations is missing or empty
            specializations: null,
            yearsOfExperience,
            education,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not achieve 100% with empty specializations array', () => {
    const profile: DoctorProfile = {
      professionalBio: 'a'.repeat(100),
      specializations: [], // Empty array
      yearsOfExperience: 10,
      education: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        institution: 'Medical School',
        degree: 'MD',
        year: 2010,
      }],
      profilePhotoUrl: 'https://example.com/photo.jpg',
    };

    const score = calculateProfileCompleteness(profile);
    expect(score).toBeLessThan(100);
  });

  it('does not achieve 100% without years of experience', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        (professionalBio, specializations, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            // yearsOfExperience is missing
            yearsOfExperience: null,
            education,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not achieve 100% without education', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 70 }),
        fc.webUrl(),
        (professionalBio, specializations, yearsOfExperience, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            // education is missing or empty
            education: null,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not achieve 100% with empty education array', () => {
    const profile: DoctorProfile = {
      professionalBio: 'a'.repeat(100),
      specializations: ['Cardiology'],
      yearsOfExperience: 10,
      education: [], // Empty array
      profilePhotoUrl: 'https://example.com/photo.jpg',
    };

    const score = calculateProfileCompleteness(profile);
    expect(score).toBeLessThan(100);
  });

  it('does not achieve 100% without profile photo', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 70 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        (professionalBio, specializations, yearsOfExperience, education) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            education,
            // profilePhotoUrl is missing
            profilePhotoUrl: null,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('can achieve 100% without optional fields (certifications, languages, officeAddress)', () => {
    const profileWithoutOptionals: DoctorProfile = {
      professionalBio: 'a'.repeat(100),
      specializations: ['Cardiology'],
      yearsOfExperience: 10,
      education: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        institution: 'Medical School',
        degree: 'MD',
        year: 2010,
      }],
      // No certifications
      certifications: null,
      // No languages
      languages: null,
      profilePhotoUrl: 'https://example.com/photo.jpg',
      // No office address
      officeAddress: null,
    };

    const score = calculateProfileCompleteness(profileWithoutOptionals);
    expect(score).toBe(100);
  });

  it('achieves 100% with minimum valid values for required fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 50 }), // Minimum valid bio
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 1 }), // One specialization
        fc.constantFrom(0), // Minimum valid years
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 10 }),
          degree: fc.string({ minLength: 1, maxLength: 10 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 1 }), // One education entry
        fc.webUrl(),
        (professionalBio, specializations, yearsOfExperience, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            education,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBe(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not achieve 100% if bio is less than 50 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 49 }), // Invalid bio
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 70 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        (professionalBio, specializations, yearsOfExperience, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            education,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not achieve 100% if years of experience is negative', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: -100, max: -1 }), // Negative years
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        (professionalBio, specializations, yearsOfExperience, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            education,
            profilePhotoUrl,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBeLessThan(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('achieves 100% with all required fields regardless of optional field values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 70 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1 }),
          degree: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 3 }),
        fc.webUrl(),
        // Optional fields can be anything
        fc.option(fc.array(fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1 }),
          issuingOrganization: fc.string({ minLength: 1 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }))),
        fc.option(fc.array(fc.string({ minLength: 1 }))),
        fc.option(fc.string({ maxLength: 500 })),
        (professionalBio, specializations, yearsOfExperience, education, profilePhotoUrl,
          certifications, languages, officeAddress) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            education,
            profilePhotoUrl,
            certifications,
            languages,
            officeAddress,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBe(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('missing any single required field prevents 100% completeness', () => {
    const baseProfile: DoctorProfile = {
      professionalBio: 'a'.repeat(100),
      specializations: ['Cardiology'],
      yearsOfExperience: 10,
      education: [{
        id: '123e4567-e89b-12d3-a456-426614174000',
        institution: 'Medical School',
        degree: 'MD',
        year: 2010,
      }],
      profilePhotoUrl: 'https://example.com/photo.jpg',
    };

    // Verify base profile is 100%
    expect(calculateProfileCompleteness(baseProfile)).toBe(100);

    // Test removing each required field
    const requiredFields: (keyof DoctorProfile)[] = [
      'professionalBio',
      'specializations',
      'yearsOfExperience',
      'education',
      'profilePhotoUrl',
    ];

    requiredFields.forEach((field) => {
      const incompleteProfile = { ...baseProfile };
      incompleteProfile[field] = null as any;
      const score = calculateProfileCompleteness(incompleteProfile);
      expect(score).toBeLessThan(100);
    });
  });

  it('all required fields together are sufficient for 100% completeness', () => {
    // Test with various combinations of required field values
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 1000 }),
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 70 }),
        fc.array(fc.record({
          id: fc.uuid(),
          institution: fc.string({ minLength: 1, maxLength: 200 }),
          degree: fc.string({ minLength: 1, maxLength: 100 }),
          year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
        }), { minLength: 1, maxLength: 20 }),
        fc.webUrl(),
        (professionalBio, specializations, yearsOfExperience, education, profilePhotoUrl) => {
          const profile: DoctorProfile = {
            professionalBio,
            specializations,
            yearsOfExperience,
            education,
            profilePhotoUrl,
            // Explicitly set optional fields to null
            certifications: null,
            languages: null,
            officeAddress: null,
          };

          const score = calculateProfileCompleteness(profile);
          expect(score).toBe(100);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
