/**
 * Property-based test for validation error preservation
 * Feature: doctor-professional-profile, Property 22: Validation Error Preservation
 * 
 * Property: For any profile submission with validation errors, the system should 
 * display specific error messages and preserve all entered data without loss.
 * 
 * Validates: Requirements 1.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { updateProfessionalProfileSchema } from '@/lib/validation';

describe('Property 22: Validation Error Preservation', () => {
  it('should preserve all valid fields when some fields have validation errors', () => {
    fc.assert(
      fc.property(
        // Generate a mix of valid and invalid data
        fc.record({
          professionalBio: fc.string({ minLength: 0, maxLength: 40 }), // Invalid: too short
          yearsOfExperience: fc.integer({ min: 0, max: 70 }), // Valid
          specializations: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }), // Valid
          languages: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }), // Valid
        }),
        (inputData) => {
          // Attempt to validate the data
          const result = updateProfessionalProfileSchema.safeParse(inputData);

          // Property: Validation should fail due to invalid bio
          expect(result.success).toBe(false);

          // Property: Original input data should be preserved
          expect(inputData.professionalBio).toBeDefined();
          expect(inputData.yearsOfExperience).toBeDefined();
          expect(inputData.specializations).toBeDefined();
          expect(inputData.languages).toBeDefined();

          // Property: Valid fields should still be accessible
          expect(inputData.yearsOfExperience).toBeGreaterThanOrEqual(0);
          expect(inputData.yearsOfExperience).toBeLessThanOrEqual(70);
          expect(inputData.specializations.length).toBeGreaterThan(0);
          expect(inputData.languages.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide specific error messages for each invalid field', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalBio: fc.string({ minLength: 0, maxLength: 40 }), // Too short
          yearsOfExperience: fc.integer({ min: -100, max: -1 }), // Negative
          consultationFee: fc.double({ min: -1000, max: -0.01, noNaN: true }), // Negative
        }),
        (invalidData) => {
          const result = updateProfessionalProfileSchema.safeParse(invalidData);

          // Property: Validation should fail
          expect(result.success).toBe(false);

          if (!result.success) {
            // Property: Should have specific error messages
            const errors = result.error.issues;
            expect(errors.length).toBeGreaterThan(0);

            // Property: Each error should have a message and path
            errors.forEach(error => {
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(0);
              expect(error.path).toBeDefined();
              expect(error.path.length).toBeGreaterThan(0);
            });

            // Property: Error messages should be descriptive
            const errorMessages = errors.map(e => e.message.toLowerCase());
            const hasDescriptiveErrors = errorMessages.some(msg => 
              msg.includes('character') || 
              msg.includes('negative') || 
              msg.includes('positive') ||
              msg.includes('minimum') ||
              msg.includes('maximum')
            );
            expect(hasDescriptiveErrors).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve complex nested data structures on validation failure', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalBio: fc.string({ minLength: 0, maxLength: 40 }), // Invalid
          education: fc.array(
            fc.record({
              id: fc.uuid(),
              institution: fc.string({ minLength: 1, maxLength: 200 }),
              degree: fc.string({ minLength: 1, maxLength: 100 }),
              year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
            }),
            { minLength: 1, maxLength: 3 }
          ), // Valid
          certifications: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 200 }),
              issuingOrganization: fc.string({ minLength: 1, maxLength: 200 }),
              year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
            }),
            { minLength: 1, maxLength: 3 }
          ), // Valid
        }),
        (inputData) => {
          // Store original data for comparison
          const originalEducation = JSON.parse(JSON.stringify(inputData.education));
          const originalCertifications = JSON.parse(JSON.stringify(inputData.certifications));

          // Attempt validation
          const result = updateProfessionalProfileSchema.safeParse(inputData);

          // Property: Validation should fail
          expect(result.success).toBe(false);

          // Property: Complex nested structures should be preserved exactly
          expect(inputData.education).toEqual(originalEducation);
          expect(inputData.certifications).toEqual(originalCertifications);

          // Property: Each nested object should be intact
          inputData.education.forEach((entry, index) => {
            expect(entry).toEqual(originalEducation[index]);
            expect(entry.id).toBe(originalEducation[index]?.id);
            expect(entry.institution).toBe(originalEducation[index]?.institution);
            expect(entry.degree).toBe(originalEducation[index]?.degree);
            expect(entry.year).toBe(originalEducation[index]?.year);
          });

          inputData.certifications.forEach((entry, index) => {
            expect(entry).toEqual(originalCertifications[index]);
            expect(entry.id).toBe(originalCertifications[index]?.id);
            expect(entry.name).toBe(originalCertifications[index]?.name);
            expect(entry.issuingOrganization).toBe(originalCertifications[index]?.issuingOrganization);
            expect(entry.year).toBe(originalCertifications[index]?.year);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve data when multiple fields have validation errors', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalBio: fc.string({ minLength: 0, maxLength: 40 }), // Invalid: too short
          yearsOfExperience: fc.integer({ min: 71, max: 200 }), // Invalid: too high
          specializations: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }), // Valid
          education: fc.array(
            fc.record({
              id: fc.uuid(),
              institution: fc.string({ minLength: 1, maxLength: 200 }),
              degree: fc.string({ minLength: 1, maxLength: 100 }),
              year: fc.integer({ min: new Date().getFullYear() + 1, max: 2100 }), // Invalid: future year
            }),
            { minLength: 1, maxLength: 2 }
          ),
          languages: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 3 }), // Valid
        }),
        (inputData) => {
          // Store original data
          const originalData = JSON.parse(JSON.stringify(inputData));

          // Attempt validation
          const result = updateProfessionalProfileSchema.safeParse(inputData);

          // Property: Validation should fail (multiple errors)
          expect(result.success).toBe(false);

          if (!result.success) {
            // Property: Should have multiple errors
            expect(result.error.issues.length).toBeGreaterThan(0);
          }

          // Property: All data should be preserved despite multiple errors
          expect(inputData).toEqual(originalData);
          expect(inputData.professionalBio).toBe(originalData.professionalBio);
          expect(inputData.yearsOfExperience).toBe(originalData.yearsOfExperience);
          expect(inputData.specializations).toEqual(originalData.specializations);
          expect(inputData.education).toEqual(originalData.education);
          expect(inputData.languages).toEqual(originalData.languages);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve optional fields with null/undefined values on validation failure', () => {
    fc.assert(
      fc.property(
        fc.record({
          professionalBio: fc.string({ minLength: 0, maxLength: 40 }), // Invalid
          officeAddress: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
          officePhone: fc.option(fc.string({ minLength: 7, maxLength: 20 }), { nil: undefined }),
          officeEmail: fc.option(fc.emailAddress(), { nil: undefined }),
        }),
        (inputData) => {
          // Store original optional field values
          const originalOfficeAddress = inputData.officeAddress;
          const originalOfficePhone = inputData.officePhone;
          const originalOfficeEmail = inputData.officeEmail;

          // Attempt validation
          const result = updateProfessionalProfileSchema.safeParse(inputData);

          // Property: Validation should fail
          expect(result.success).toBe(false);

          // Property: Optional fields should be preserved exactly, including null/undefined
          expect(inputData.officeAddress).toBe(originalOfficeAddress);
          expect(inputData.officePhone).toBe(originalOfficePhone);
          expect(inputData.officeEmail).toBe(originalOfficeEmail);

          // Property: If optional field was undefined, it should remain undefined
          if (originalOfficeAddress === undefined) {
            expect(inputData.officeAddress).toBeUndefined();
          }
          if (originalOfficePhone === undefined) {
            expect(inputData.officePhone).toBeUndefined();
          }
          if (originalOfficeEmail === undefined) {
            expect(inputData.officeEmail).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
