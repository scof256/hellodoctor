/**
 * Feature: doctor-professional-profile, Property 16: Admin Profile View Access
 * 
 * For any doctor profile, administrators should be able to view it regardless of
 * verification status or publication state.
 * 
 * Validates: Requirements 3.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canViewProfile } from '@/lib/profile-access-control';
import type { Doctor, User, ProfileWithPublishStatus } from '@/lib/profile-access-control';

// Arbitraries for generating test data
const verificationStatusArb = fc.constantFrom(
  'pending',
  'verified',
  'rejected'
) as fc.Arbitrary<'pending' | 'verified' | 'rejected'>;

const profileArb = fc.record({
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
  isPublished: fc.boolean(),
});

const doctorArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  verificationStatus: verificationStatusArb,
});

const adminUserArb = fc.record({
  id: fc.uuid(),
  primaryRole: fc.constant('super_admin' as const),
});

describe('Property 16: Admin Profile View Access', () => {
  it('admin can view all profiles regardless of verification status', () => {
    fc.assert(
      fc.property(
        profileArb,
        doctorArb,
        adminUserArb,
        (profile, doctor, admin) => {
          const canView = canViewProfile(profile, doctor, admin);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin can view unpublished profiles', () => {
    fc.assert(
      fc.property(
        doctorArb,
        adminUserArb,
        (doctor, admin) => {
          const unpublishedProfile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished: false,
          };
          
          const canView = canViewProfile(unpublishedProfile, doctor, admin);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin can view pending doctor profiles', () => {
    fc.assert(
      fc.property(
        profileArb,
        fc.uuid(),
        fc.uuid(),
        adminUserArb,
        (profile, doctorId, userId, admin) => {
          const pendingDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'pending',
          };
          
          const canView = canViewProfile(profile, pendingDoctor, admin);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin can view rejected doctor profiles', () => {
    fc.assert(
      fc.property(
        profileArb,
        fc.uuid(),
        fc.uuid(),
        adminUserArb,
        (profile, doctorId, userId, admin) => {
          const rejectedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'rejected',
          };
          
          const canView = canViewProfile(profile, rejectedDoctor, admin);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin can view verified doctor profiles', () => {
    fc.assert(
      fc.property(
        profileArb,
        fc.uuid(),
        fc.uuid(),
        adminUserArb,
        (profile, doctorId, userId, admin) => {
          const verifiedDoctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus: 'verified',
          };
          
          const canView = canViewProfile(profile, verifiedDoctor, admin);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin access is independent of publication status', () => {
    fc.assert(
      fc.property(
        doctorArb,
        adminUserArb,
        fc.boolean(),
        (doctor, admin, isPublished) => {
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
          
          const canView = canViewProfile(profile, doctor, admin);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin access is independent of profile completeness', () => {
    fc.assert(
      fc.property(
        doctorArb,
        adminUserArb,
        (doctor, admin) => {
          // Empty profile
          const emptyProfile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished: false,
          };
          
          // Complete profile
          const completeProfile: ProfileWithPublishStatus = {
            professionalBio: 'A'.repeat(100),
            yearsOfExperience: 10,
            specializations: ['Cardiology'],
            education: [{
              id: fc.sample(fc.uuid(), 1)[0]!,
              institution: 'Medical School',
              degree: 'MD',
              year: 2010,
            }],
            certifications: [{
              id: fc.sample(fc.uuid(), 1)[0]!,
              name: 'Board Certified',
              issuingOrganization: 'Medical Board',
              year: 2015,
            }],
            languages: ['English'],
            profilePhotoUrl: 'https://example.com/photo.jpg',
            officeAddress: '123 Main St',
            isPublished: true,
          };
          
          // Admin should see both
          expect(canViewProfile(emptyProfile, doctor, admin)).toBe(true);
          expect(canViewProfile(completeProfile, doctor, admin)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple admins can all view the same profile', () => {
    fc.assert(
      fc.property(
        profileArb,
        doctorArb,
        fc.array(adminUserArb, { minLength: 2, maxLength: 5 }),
        (profile, doctor, admins) => {
          const visibilityResults = admins.map(admin => 
            canViewProfile(profile, doctor, admin)
          );
          
          // All admins should be able to view
          expect(visibilityResults.every(canView => canView === true)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin can view profiles that patients cannot see', () => {
    fc.assert(
      fc.property(
        doctorArb,
        adminUserArb,
        fc.uuid(),
        (doctor, admin, patientId) => {
          fc.pre(doctor.verificationStatus !== 'verified');
          
          const unpublishedProfile: ProfileWithPublishStatus = {
            professionalBio: null,
            yearsOfExperience: null,
            specializations: null,
            education: null,
            certifications: null,
            languages: null,
            profilePhotoUrl: null,
            officeAddress: null,
            isPublished: false,
          };
          
          const patient: User = {
            id: patientId,
            primaryRole: 'patient',
          };
          
          // Admin should see it
          expect(canViewProfile(unpublishedProfile, doctor, admin)).toBe(true);
          
          // Patient should not see it (unless they're the owner)
          if (patientId !== doctor.userId) {
            expect(canViewProfile(unpublishedProfile, doctor, patient)).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin access works for all combinations of verification and publication status', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        adminUserArb,
        (doctorId, userId, admin) => {
          const statuses: Array<'pending' | 'verified' | 'rejected'> = ['pending', 'verified', 'rejected'];
          const publishStates = [true, false];
          
          // Test all combinations
          for (const verificationStatus of statuses) {
            for (const isPublished of publishStates) {
              const doctor: Doctor = {
                id: doctorId,
                userId: userId,
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
              
              const canView = canViewProfile(profile, doctor, admin);
              expect(canView).toBe(true);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin access is consistent across multiple checks', () => {
    fc.assert(
      fc.property(
        profileArb,
        doctorArb,
        adminUserArb,
        (profile, doctor, admin) => {
          const result1 = canViewProfile(profile, doctor, admin);
          const result2 = canViewProfile(profile, doctor, admin);
          const result3 = canViewProfile(profile, doctor, admin);
          
          // All results should be true
          expect(result1).toBe(true);
          expect(result2).toBe(true);
          expect(result3).toBe(true);
          
          // All results should be consistent
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin who is also the owner can view their profile', () => {
    fc.assert(
      fc.property(
        profileArb,
        fc.uuid(),
        verificationStatusArb,
        (profile, userId, verificationStatus) => {
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: userId,
            verificationStatus,
          };
          
          const adminOwner: User = {
            id: userId,
            primaryRole: 'super_admin',
          };
          
          const canView = canViewProfile(profile, doctor, adminOwner);
          expect(canView).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
