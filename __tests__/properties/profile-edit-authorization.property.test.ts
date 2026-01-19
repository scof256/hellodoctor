/**
 * Feature: doctor-professional-profile, Property 15: Profile Edit Authorization
 * 
 * For any profile edit request, the system should allow the operation if and only if
 * the requesting user is the owner of the profile.
 * 
 * Validates: Requirements 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { canEditProfile } from '@/lib/profile-access-control';
import type { Doctor, User } from '@/lib/profile-access-control';

// Arbitraries for generating test data
const userRoleArb = fc.constantFrom(
  'super_admin',
  'doctor',
  'clinic_admin',
  'receptionist',
  'patient'
) as fc.Arbitrary<'super_admin' | 'doctor' | 'clinic_admin' | 'receptionist' | 'patient'>;

const verificationStatusArb = fc.constantFrom(
  'pending',
  'verified',
  'rejected'
) as fc.Arbitrary<'pending' | 'verified' | 'rejected'>;

const doctorArb = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  verificationStatus: verificationStatusArb,
});

const userArb = fc.record({
  id: fc.uuid(),
  primaryRole: userRoleArb,
});

describe('Property 15: Profile Edit Authorization', () => {
  it('owner can always edit their own profile', () => {
    fc.assert(
      fc.property(
        doctorArb,
        userRoleArb,
        (doctor, role) => {
          // User is the owner
          const owner: User = {
            id: doctor.userId,
            primaryRole: role,
          };
          
          const canEdit = canEditProfile(doctor, owner);
          expect(canEdit).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-owner cannot edit profile regardless of role', () => {
    fc.assert(
      fc.property(
        doctorArb,
        userArb,
        (doctor, user) => {
          fc.pre(user.id !== doctor.userId);
          
          const canEdit = canEditProfile(doctor, user);
          expect(canEdit).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('admin cannot edit other doctors profiles', () => {
    fc.assert(
      fc.property(
        doctorArb,
        fc.uuid(),
        (doctor, adminId) => {
          fc.pre(adminId !== doctor.userId);
          
          const admin: User = {
            id: adminId,
            primaryRole: 'super_admin',
          };
          
          const canEdit = canEditProfile(doctor, admin);
          expect(canEdit).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('verification status does not affect edit authorization', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        verificationStatusArb,
        userRoleArb,
        (doctorId, userId, verificationStatus, role) => {
          const doctor: Doctor = {
            id: doctorId,
            userId: userId,
            verificationStatus,
          };
          
          const owner: User = {
            id: userId,
            primaryRole: role,
          };
          
          // Owner should always be able to edit regardless of verification status
          expect(canEditProfile(doctor, owner)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('user role does not affect edit authorization for owner', () => {
    fc.assert(
      fc.property(
        doctorArb,
        userRoleArb,
        (doctor, role) => {
          const owner: User = {
            id: doctor.userId,
            primaryRole: role,
          };
          
          // Owner can edit regardless of their role
          expect(canEditProfile(doctor, owner)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('user role does not grant edit access to non-owners', () => {
    fc.assert(
      fc.property(
        doctorArb,
        userRoleArb,
        fc.uuid(),
        (doctor, role, nonOwnerId) => {
          fc.pre(nonOwnerId !== doctor.userId);
          
          const nonOwner: User = {
            id: nonOwnerId,
            primaryRole: role,
          };
          
          // Non-owner cannot edit regardless of their role
          expect(canEditProfile(doctor, nonOwner)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('edit authorization is consistent for the same user-doctor pair', () => {
    fc.assert(
      fc.property(
        doctorArb,
        userArb,
        (doctor, user) => {
          const result1 = canEditProfile(doctor, user);
          const result2 = canEditProfile(doctor, user);
          
          // Results should be consistent
          expect(result1).toBe(result2);
          
          // Result should match ownership
          const isOwner = user.id === doctor.userId;
          expect(result1).toBe(isOwner);
          expect(result2).toBe(isOwner);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('edit authorization is determined solely by userId match', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        verificationStatusArb,
        userRoleArb,
        (doctorUserId, requestingUserId, verificationStatus, role) => {
          const doctor: Doctor = {
            id: fc.sample(fc.uuid(), 1)[0]!,
            userId: doctorUserId,
            verificationStatus,
          };
          
          const user: User = {
            id: requestingUserId,
            primaryRole: role,
          };
          
          const canEdit = canEditProfile(doctor, user);
          const shouldBeAbleToEdit = doctorUserId === requestingUserId;
          
          expect(canEdit).toBe(shouldBeAbleToEdit);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple users cannot edit the same profile', () => {
    fc.assert(
      fc.property(
        doctorArb,
        fc.array(userArb, { minLength: 2, maxLength: 5 }),
        (doctor, users) => {
          // Ensure users have different IDs
          const uniqueUsers = users.filter((user, index, self) => 
            self.findIndex(u => u.id === user.id) === index
          );
          
          fc.pre(uniqueUsers.length >= 2);
          
          const editResults = uniqueUsers.map(user => ({
            userId: user.id,
            canEdit: canEditProfile(doctor, user),
          }));
          
          // At most one user should be able to edit (the owner)
          const usersWhoCanEdit = editResults.filter(r => r.canEdit);
          expect(usersWhoCanEdit.length).toBeLessThanOrEqual(1);
          
          // If someone can edit, it must be the owner
          if (usersWhoCanEdit.length === 1) {
            expect(usersWhoCanEdit[0]!.userId).toBe(doctor.userId);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('patient role users cannot edit profiles they do not own', () => {
    fc.assert(
      fc.property(
        doctorArb,
        fc.uuid(),
        (doctor, patientId) => {
          fc.pre(patientId !== doctor.userId);
          
          const patient: User = {
            id: patientId,
            primaryRole: 'patient',
          };
          
          const canEdit = canEditProfile(doctor, patient);
          expect(canEdit).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clinic admin cannot edit doctor profiles', () => {
    fc.assert(
      fc.property(
        doctorArb,
        fc.uuid(),
        (doctor, adminId) => {
          fc.pre(adminId !== doctor.userId);
          
          const clinicAdmin: User = {
            id: adminId,
            primaryRole: 'clinic_admin',
          };
          
          const canEdit = canEditProfile(doctor, clinicAdmin);
          expect(canEdit).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('receptionist cannot edit doctor profiles', () => {
    fc.assert(
      fc.property(
        doctorArb,
        fc.uuid(),
        (doctor, receptionistId) => {
          fc.pre(receptionistId !== doctor.userId);
          
          const receptionist: User = {
            id: receptionistId,
            primaryRole: 'receptionist',
          };
          
          const canEdit = canEditProfile(doctor, receptionist);
          expect(canEdit).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
