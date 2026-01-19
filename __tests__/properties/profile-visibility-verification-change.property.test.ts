/**
 * Feature: doctor-professional-profile, Property 14: Profile Visibility After Verification Status Change
 * 
 * For any doctor whose verification status changes from 'verified' to any other status,
 * their profile should immediately become invisible to patients.
 * 
 * Validates: Requirements 3.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canViewProfile } from '@/lib/profile-access-control';
import type { Doctor, User, ProfileWithPublishStatus } from '@/lib/profile-access-control';

// Arbitraries for generating test data
const unverifiedStatusArb = fc.constantFrom('pending', 'rejected') as fc.Arbitrary<'pending' | 'rejected'>;

const publishedProfileArb = fc.record({
  professionalBio: fc.option(fc.string({ minLength: 50, maxLength: 1000 }), { nil: null }),
  yearsOfExperience: fc.option(fc.integer({ min: 0, max: 70 }), { nil: null }),
  specializations: fc.option(fc.array(fc.string(), { maxLength: 10 }), { nil: null }),
  education: fc.option(fc.array(fc.record({
    id: fc.uuid(),
    institution: fc.string(),
    degree: fc.string(),
    year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
  })), { nil: null }),
  certifications: fc.option(fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string(),
    issuingOrganization: fc.string(),
    year: fc.integer({ min: 1950, max: new Date().getFullYear() }),
  })), { nil: null }),
  languages: fc.option(fc.array(fc.string()), { nil: null }),
  profilePhotoUrl: fc.option(fc.webUrl(), { nil: null }),
  officeAddress: fc.option(fc.string(), { nil: null }),
  isPublished: fc.constant(true),
});

const patientUserArb = fc.record({
  id: fc.uuid(),
  primaryRole: fc.constant('patient' as const),
});

describe('Property 14: Profile Visibility After Verification Status Change', () => {
  it('verified doctor profile becomes invisible when status changes to unverified', () => {
    fc.assert(
      fc.property(
        publishedProfileArb,
        patientUserArb,
        unverifiedStatusArb,
        (profile, patient, newStatus) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          // Initially verified doctor
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          // Profile should be visible when verified
          const canViewWhenVerified = canViewProfile(profile, verifiedDoctor, patient);
          expect(canViewWhenVerified).toBe(true);
          
          // After status change to unverified
          const unverifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: newStatus,
          };
          
          // Profile should become invisible
          const canViewAfterChange = canViewProfile(profile, unverifiedDoctor, patient);
          expect(canViewAfterChange).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('profile visibility changes immediately with verification status', () => {
    fc.assert(
      fc.property(
        publishedProfileArb,
        patientUserArb,
        (profile, patient) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          // Test all status transitions
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          const pendingDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'pending',
          };
          
          const rejectedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'rejected',
          };
          
          // Verified should be visible
          expect(canViewProfile(profile, verifiedDoctor, patient)).toBe(true);
          
          // Pending should not be visible
          expect(canViewProfile(profile, pendingDoctor, patient)).toBe(false);
          
          // Rejected should not be visible
          expect(canViewProfile(profile, rejectedDoctor, patient)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verification status change affects all patients equally', () => {
    fc.assert(
      fc.property(
        publishedProfileArb,
        fc.array(patientUserArb, { minLength: 2, maxLength: 5 }),
        unverifiedStatusArb,
        (profile, patients, newStatus) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          // Initially verified
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          // All patients should see the profile when verified
          const visibilityWhenVerified = patients.map(patient => 
            canViewProfile(profile, verifiedDoctor, patient)
          );
          expect(visibilityWhenVerified.every(v => v === true)).toBe(true);
          
          // After status change
          const unverifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: newStatus,
          };
          
          // No patients should see the profile after status change
          const visibilityAfterChange = patients.map(patient => 
            canViewProfile(profile, unverifiedDoctor, patient)
          );
          expect(visibilityAfterChange.every(v => v === false)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('published flag does not prevent visibility loss on verification status change', () => {
    fc.assert(
      fc.property(
        patientUserArb,
        unverifiedStatusArb,
        (patient, newStatus) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          // Profile is published
          const publishedProfile: ProfileWithPublishStatus = {
            professionalBio: 'A'.repeat(50),
            yearsOfExperience: 10,
            specializations: ['Cardiology'],
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: 'https://example.com/photo.jpg',
            officeAddress: null,
            isPublished: true,
          };
          
          // Initially verified
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          // Should be visible when verified
          expect(canViewProfile(publishedProfile, verifiedDoctor, patient)).toBe(true);
          
          // After status change
          const unverifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: newStatus,
          };
          
          // Should not be visible even though still published
          expect(canViewProfile(publishedProfile, unverifiedDoctor, patient)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verification status change is the sole determinant of patient visibility', () => {
    fc.assert(
      fc.property(
        publishedProfileArb,
        patientUserArb,
        (profile, patient) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          // Create doctors with different verification statuses
          const statuses: Array<'pending' | 'verified' | 'rejected'> = ['pending', 'verified', 'rejected'];
          
          const visibilityResults = statuses.map(status => {
            const doctor: Doctor = {
              id: doctorId,
              userId: userId,
              verificationStatus: status,
            };
            return {
              status,
              canView: canViewProfile(profile, doctor, patient),
            };
          });
          
          // Only verified should be visible
          const verifiedResult = visibilityResults.find(r => r.status === 'verified');
          const unverifiedResults = visibilityResults.filter(r => r.status !== 'verified');
          
          expect(verifiedResult?.canView).toBe(true);
          expect(unverifiedResults.every(r => r.canView === false)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('anonymous users also lose visibility when verification status changes', () => {
    fc.assert(
      fc.property(
        publishedProfileArb,
        unverifiedStatusArb,
        (profile, newStatus) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          // Initially verified
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          // Anonymous user should see verified profile
          expect(canViewProfile(profile, verifiedDoctor, null)).toBe(true);
          
          // After status change
          const unverifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: newStatus,
          };
          
          // Anonymous user should not see unverified profile
          expect(canViewProfile(profile, unverifiedDoctor, null)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verification status change does not affect owner visibility', () => {
    fc.assert(
      fc.property(
        publishedProfileArb,
        unverifiedStatusArb,
        (profile, newStatus) => {
          const doctorId = fc.sample(fc.uuid(), 1)[0]!;
          const userId = fc.sample(fc.uuid(), 1)[0]!;
          
          const owner: User = {
            id: userId,
            primaryRole: 'doctor',
          };
          
          // Initially verified
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          // Owner should see their own profile
          expect(canViewProfile(profile, verifiedDoctor, owner)).toBe(true);
          
          // After status change
          const unverifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: newStatus,
          };
          
          // Owner should still see their own profile
          expect(canViewProfile(profile, unverifiedDoctor, owner)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
