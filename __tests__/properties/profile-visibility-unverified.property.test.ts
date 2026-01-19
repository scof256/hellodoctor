/**
 * Feature: doctor-professional-profile, Property 13: Profile Visibility for Unverified Doctors
 * 
 * For any doctor with verification status other than 'verified', their profile should not be
 * visible to patients regardless of the isPublished flag.
 * 
 * Validates: Requirements 3.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canViewProfile } from '@/lib/profile-access-control';
import type { Doctor, User, ProfileWithPublishStatus } from '@/lib/profile-access-control';

// Arbitraries for generating test data
const verificationStatusArb = fc.constantFrom('pending', 'rejected') as fc.Arbitrary<'pending' | 'rejected'>;
const userRoleArb = fc.constantFrom('patient', 'doctor', 'clinic_admin', 'receptionist') as fc.Arbitrary<'patient' | 'doctor' | 'clinic_admin' | 'receptionist'>;

const doctorArb = (verificationStatus: 'pending' | 'verified' | 'rejected') => fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  verificationStatus: fc.constant(verificationStatus),
});

const profileArb = (isPublished: boolean) => fc.record({
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
  isPublished: fc.constant(isPublished),
});

const patientUserArb = fc.record({
  id: fc.uuid(),
  primaryRole: fc.constant('patient' as const),
});

const nonAdminUserArb = fc.record({
  id: fc.uuid(),
  primaryRole: userRoleArb,
});

describe('Property 13: Profile Visibility for Unverified Doctors', () => {
  it('unverified doctors profiles are not visible to patients regardless of isPublished flag', () => {
    fc.assert(
      fc.property(
        verificationStatusArb,
        fc.boolean(),
        patientUserArb,
        (verificationStatus, isPublished, patient) => {
          fc.pre(verificationStatus !== 'verified');
          
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: fc.sample(fc.uuid(), 1)[0]!,
            verificationStatus,
          };
          
          const profile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished,
          };
          
          const canView = canViewProfile(profile, doctor, patient);
          
          // Patients should never see unverified doctor profiles
          expect(canView).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('pending doctors with published profiles are not visible to patients', () => {
    fc.assert(
      fc.property(
        doctorArb('pending'),
        profileArb(true),
        patientUserArb,
        (doctor, profile, patient) => {
          const canView = canViewProfile(profile, doctor, patient);
          expect(canView).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejected doctors with published profiles are not visible to patients', () => {
    fc.assert(
      fc.property(
        doctorArb('rejected'),
        profileArb(true),
        patientUserArb,
        (doctor, profile, patient) => {
          const canView = canViewProfile(profile, doctor, patient);
          expect(canView).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('unverified doctors with unpublished profiles are not visible to patients', () => {
    fc.assert(
      fc.property(
        verificationStatusArb,
        profileArb(false),
        patientUserArb,
        (verificationStatus, profile, patient) => {
          fc.pre(verificationStatus !== 'verified');
          
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: fc.sample(fc.uuid(), 1)[0]!,
            verificationStatus,
          };
          
          const canView = canViewProfile(profile, doctor, patient);
          expect(canView).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('unverified doctors profiles are not visible to non-admin users regardless of isPublished', () => {
    fc.assert(
      fc.property(
        verificationStatusArb,
        fc.boolean(),
        nonAdminUserArb,
        (verificationStatus, isPublished, user) => {
          fc.pre(verificationStatus !== 'verified' && user.primaryRole !== 'super_admin');
          
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: fc.sample(fc.uuid(), 1)[0]!,
            verificationStatus,
          };
          
          const profile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished,
          };
          
          // If user is not the owner and not admin, they should not see unverified profiles
          if (user.id !== doctor.userId) {
            const canView = canViewProfile(profile, doctor, user);
            expect(canView).toBe(false);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verification status takes precedence over isPublished flag for patient visibility', () => {
    fc.assert(
      fc.property(
        verificationStatusArb,
        patientUserArb,
        (verificationStatus, patient) => {
          fc.pre(verificationStatus !== 'verified');
          
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: fc.sample(fc.uuid(), 1)[0]!,
            verificationStatus,
          };
          
          // Test with published profile
          const publishedProfile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished: true,
          };
          
          // Test with unpublished profile
          const unpublishedProfile: ProfileWithPublishStatus = {
            ...publishedProfile,
            isPublished: false,
          };
          
          const canViewPublished = canViewProfile(publishedProfile, doctor, patient);
          const canViewUnpublished = canViewProfile(unpublishedProfile, doctor, patient);
          
          // Both should be false for unverified doctors
          expect(canViewPublished).toBe(false);
          expect(canViewUnpublished).toBe(false);
          
          // They should be equal (both false)
          expect(canViewPublished).toBe(canViewUnpublished);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('anonymous users cannot view unverified doctor profiles', () => {
    fc.assert(
      fc.property(
        verificationStatusArb,
        fc.boolean(),
        (verificationStatus, isPublished) => {
          fc.pre(verificationStatus !== 'verified');
          
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: fc.sample(fc.uuid(), 1)[0]!,
            verificationStatus,
          };
          
          const profile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished,
          };
          
          const canView = canViewProfile(profile, doctor, null);
          expect(canView).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
