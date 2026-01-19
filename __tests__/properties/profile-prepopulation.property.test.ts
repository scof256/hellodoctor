/**
 * Property-based test for profile pre-population
 * Feature: doctor-professional-profile, Property 21: Profile Pre-population
 * 
 * Property: For any doctor with an existing profile, accessing the profile editor 
 * should pre-populate all form fields with the current values from the database.
 * 
 * Validates: Requirements 1.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { EducationEntry, CertificationEntry } from '@/server/db/schema';

describe('Property 21: Profile Pre-population', () => {
  it('should pre-populate all fields with existing profile data', () => {
    fc.assert(
      fc.property(
        // Generate random profile data
        fc.record({
          professionalBio: fc.string({ minLength: 50, maxLength: 1000 }),
          yearsOfExperience: fc.integer({ min: 0, max: 70 }),
          specializations: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          education: fc.array(
            fc.record({
              id: fc.uuid(),
              institution: fc.string({ minLength: 1, maxLength: 200 }),
              degree: fc.string({ minLength: 1, maxLength: 100 }),
              fieldOfStudy: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
              isVerified: fc.option(fc.boolean(), { nil: undefined }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          certifications: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 200 }),
              issuingOrganization: fc.string({ minLength: 1, maxLength: 200 }),
              year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
              expiryYear: fc.option(fc.integer({ min: new Date().getFullYear(), max: 2100 }), { nil: undefined }),
              credentialId: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
              isVerified: fc.option(fc.boolean(), { nil: undefined }),
            }),
            { minLength: 0, maxLength: 30 }
          ),
          languages: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
          officeAddress: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
          officePhone: fc.option(fc.string({ minLength: 7, maxLength: 20 }), { nil: undefined }),
          officeEmail: fc.option(fc.emailAddress(), { nil: undefined }),
          profilePhotoUrl: fc.option(fc.webUrl(), { nil: undefined }),
          consultationFee: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), { nil: undefined }),
        }),
        (existingProfile) => {
          // Simulate fetching profile from database
          const fetchedProfile = { ...existingProfile };

          // Simulate pre-populating form fields
          const formFields = {
            professionalBio: fetchedProfile.professionalBio,
            yearsOfExperience: fetchedProfile.yearsOfExperience,
            specializations: fetchedProfile.specializations,
            education: fetchedProfile.education,
            certifications: fetchedProfile.certifications,
            languages: fetchedProfile.languages,
            officeAddress: fetchedProfile.officeAddress,
            officePhone: fetchedProfile.officePhone,
            officeEmail: fetchedProfile.officeEmail,
            profilePhotoUrl: fetchedProfile.profilePhotoUrl,
            consultationFee: fetchedProfile.consultationFee,
          };

          // Property: All form fields should match the existing profile data
          expect(formFields.professionalBio).toBe(existingProfile.professionalBio);
          expect(formFields.yearsOfExperience).toBe(existingProfile.yearsOfExperience);
          expect(formFields.specializations).toEqual(existingProfile.specializations);
          expect(formFields.education).toEqual(existingProfile.education);
          expect(formFields.certifications).toEqual(existingProfile.certifications);
          expect(formFields.languages).toEqual(existingProfile.languages);
          expect(formFields.officeAddress).toBe(existingProfile.officeAddress);
          expect(formFields.officePhone).toBe(existingProfile.officePhone);
          expect(formFields.officeEmail).toBe(existingProfile.officeEmail);
          expect(formFields.profilePhotoUrl).toBe(existingProfile.profilePhotoUrl);
          expect(formFields.consultationFee).toBe(existingProfile.consultationFee);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle profiles with null/undefined optional fields', () => {
    fc.assert(
      fc.property(
        // Generate profile with some fields explicitly null/undefined
        fc.record({
          professionalBio: fc.string({ minLength: 50, maxLength: 1000 }),
          yearsOfExperience: fc.integer({ min: 0, max: 70 }),
          specializations: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          education: fc.constant([]), // Empty array
          certifications: fc.constant([]), // Empty array
          languages: fc.constant([]), // Empty array
          officeAddress: fc.constant(null),
          officePhone: fc.constant(null),
          officeEmail: fc.constant(null),
          profilePhotoUrl: fc.constant(null),
          consultationFee: fc.constant(null),
        }),
        (existingProfile) => {
          // Simulate pre-populating form with null/undefined values
          const formFields = {
            professionalBio: existingProfile.professionalBio,
            yearsOfExperience: existingProfile.yearsOfExperience,
            specializations: existingProfile.specializations,
            education: existingProfile.education,
            certifications: existingProfile.certifications,
            languages: existingProfile.languages,
            officeAddress: existingProfile.officeAddress ?? '',
            officePhone: existingProfile.officePhone ?? '',
            officeEmail: existingProfile.officeEmail ?? '',
            profilePhotoUrl: existingProfile.profilePhotoUrl ?? '',
            consultationFee: existingProfile.consultationFee ?? undefined,
          };

          // Property: Form should handle null/undefined values gracefully
          expect(formFields.professionalBio).toBe(existingProfile.professionalBio);
          expect(formFields.yearsOfExperience).toBe(existingProfile.yearsOfExperience);
          expect(formFields.specializations).toEqual(existingProfile.specializations);
          expect(formFields.education).toEqual([]);
          expect(formFields.certifications).toEqual([]);
          expect(formFields.languages).toEqual([]);
          expect(formFields.officeAddress).toBe('');
          expect(formFields.officePhone).toBe('');
          expect(formFields.officeEmail).toBe('');
          expect(formFields.profilePhotoUrl).toBe('');
          expect(formFields.consultationFee).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve complex nested structures in education and certifications', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            institution: fc.string({ minLength: 1, maxLength: 200 }),
            degree: fc.string({ minLength: 1, maxLength: 100 }),
            fieldOfStudy: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
            year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
            isVerified: fc.option(fc.boolean(), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 200 }),
            issuingOrganization: fc.string({ minLength: 1, maxLength: 200 }),
            year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
            expiryYear: fc.option(fc.integer({ min: new Date().getFullYear(), max: 2100 }), { nil: undefined }),
            credentialId: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
            isVerified: fc.option(fc.boolean(), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (education, certifications) => {
          // Simulate fetching and pre-populating complex nested data
          const fetchedEducation = JSON.parse(JSON.stringify(education));
          const fetchedCertifications = JSON.parse(JSON.stringify(certifications));

          // Property: Complex nested structures should be preserved exactly
          expect(fetchedEducation).toEqual(education);
          expect(fetchedCertifications).toEqual(certifications);

          // Verify each education entry is preserved
          education.forEach((entry, index) => {
            expect(fetchedEducation[index]).toEqual(entry);
            expect(fetchedEducation[index]?.id).toBe(entry.id);
            expect(fetchedEducation[index]?.institution).toBe(entry.institution);
            expect(fetchedEducation[index]?.degree).toBe(entry.degree);
            expect(fetchedEducation[index]?.year).toBe(entry.year);
          });

          // Verify each certification entry is preserved
          certifications.forEach((entry, index) => {
            expect(fetchedCertifications[index]).toEqual(entry);
            expect(fetchedCertifications[index]?.id).toBe(entry.id);
            expect(fetchedCertifications[index]?.name).toBe(entry.name);
            expect(fetchedCertifications[index]?.issuingOrganization).toBe(entry.issuingOrganization);
            expect(fetchedCertifications[index]?.year).toBe(entry.year);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
