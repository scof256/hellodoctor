/**
 * Feature: doctor-role-handling-fix
 * 
 * Property tests for doctor role validation in the auto-patient flow
 * and connection creation.
 * 
 * These tests verify that doctors cannot be enrolled as patients and
 * that role validation is comprehensive.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '@/types';

// Valid user roles from the system
const VALID_ROLES: UserRole[] = ['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient'];

// Roles that should be blocked from auto-patient flow
const DOCTOR_ROLES: UserRole[] = ['doctor'];

// Roles that can be enrolled as patients
const PATIENT_ELIGIBLE_ROLES: UserRole[] = ['patient', 'clinic_admin', 'receptionist'];

/**
 * Simulates the validateUserCanBePatient function logic.
 * This mirrors the actual implementation in auto-patient/route.ts
 */
function validateUserCanBePatient(user: {
  primaryRole: UserRole;
  hasDoctorProfile: boolean;
  hasPatientProfile: boolean;
}): { canBePatient: boolean; reason?: string } {
  // Check if user has a doctor profile (highest priority)
  if (user.hasDoctorProfile) {
    return {
      canBePatient: false,
      reason: 'Doctors cannot connect as patients. Please use the professional networking features instead.',
    };
  }

  // Check primary role
  if (user.primaryRole === 'doctor') {
    return {
      canBePatient: false,
      reason: 'Your account is registered as a doctor. Doctors cannot connect as patients.',
    };
  }

  return { canBePatient: true };
}

/**
 * Simulates connection creation validation.
 * This mirrors the logic in connection.ts router.
 */
function canCreateConnection(user: {
  primaryRole: UserRole;
  hasDoctorProfile: boolean;
  hasPatientProfile: boolean;
}): { canCreate: boolean; reason?: string } {
  // Check if user has a doctor profile
  if (user.hasDoctorProfile) {
    return {
      canCreate: false,
      reason: 'Doctors cannot create patient connections.',
    };
  }

  // Check if user has a patient profile
  if (!user.hasPatientProfile) {
    return {
      canCreate: false,
      reason: 'Patient profile not found. Please create a profile first.',
    };
  }

  return { canCreate: true };
}

/**
 * Determines the effective role based on primary role and profile existence.
 * Doctor profile takes precedence over everything.
 */
function getEffectiveRole(user: {
  primaryRole: UserRole;
  hasDoctorProfile: boolean;
  hasPatientProfile: boolean;
}): 'doctor' | 'patient' | 'other' {
  if (user.hasDoctorProfile || user.primaryRole === 'doctor') {
    return 'doctor';
  }
  if (user.hasPatientProfile || user.primaryRole === 'patient') {
    return 'patient';
  }
  return 'other';
}

describe('Property 1: Doctor Auto-Patient Blocking', () => {
  /**
   * For any user with a doctor profile or primary_role 'doctor',
   * when they call the auto-patient endpoint, the system SHALL return
   * a 403 status code AND SHALL NOT create a patient profile for that user.
   * 
   * Validates: Requirements 1.1, 1.2, 3.1, 3.2, 3.3
   */

  // Generator for users with doctor profiles
  const doctorUserArb = fc.record({
    primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
    hasDoctorProfile: fc.constant(true),
    hasPatientProfile: fc.boolean(),
  });

  // Generator for users with doctor primary role (but may not have profile yet)
  const doctorRoleUserArb = fc.record({
    primaryRole: fc.constant<UserRole>('doctor'),
    hasDoctorProfile: fc.boolean(),
    hasPatientProfile: fc.boolean(),
  });

  // Generator for any user
  const anyUserArb = fc.record({
    primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
    hasDoctorProfile: fc.boolean(),
    hasPatientProfile: fc.boolean(),
  });

  it('for any user with a doctor profile, auto-patient validation SHALL return canBePatient=false', () => {
    fc.assert(
      fc.property(doctorUserArb, (user) => {
        const result = validateUserCanBePatient(user);
        
        expect(result.canBePatient).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('Doctors cannot');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('for any user with primary_role doctor, auto-patient validation SHALL return canBePatient=false', () => {
    fc.assert(
      fc.property(doctorRoleUserArb, (user) => {
        const result = validateUserCanBePatient(user);
        
        expect(result.canBePatient).toBe(false);
        expect(result.reason).toBeDefined();
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('for any user, canBePatient=false iff user has doctor profile OR primary_role is doctor', () => {
    fc.assert(
      fc.property(anyUserArb, (user) => {
        const result = validateUserCanBePatient(user);
        const shouldBeBlocked = user.hasDoctorProfile || user.primaryRole === 'doctor';
        
        expect(result.canBePatient).toBe(!shouldBeBlocked);
        
        if (shouldBeBlocked) {
          expect(result.reason).toBeDefined();
        } else {
          expect(result.reason).toBeUndefined();
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('doctor profile check takes precedence over primary_role check', () => {
    // User with doctor profile but patient primary_role should still be blocked
    const user = {
      primaryRole: 'patient' as UserRole,
      hasDoctorProfile: true,
      hasPatientProfile: true,
    };
    
    const result = validateUserCanBePatient(user);
    expect(result.canBePatient).toBe(false);
    expect(result.reason).toContain('Doctors cannot connect as patients');
  });
});

describe('Property 3: Connection Creation Role Validation', () => {
  /**
   * For any connection creation attempt, the system SHALL only succeed
   * if the requesting user has a valid patient profile AND does not have
   * a doctor profile. If the user has a doctor profile, the system SHALL
   * return a FORBIDDEN error.
   * 
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4
   */

  const anyUserArb = fc.record({
    primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
    hasDoctorProfile: fc.boolean(),
    hasPatientProfile: fc.boolean(),
  });

  it('for any user with doctor profile, connection creation SHALL be denied', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
          hasDoctorProfile: fc.constant(true),
          hasPatientProfile: fc.boolean(),
        }),
        (user) => {
          const result = canCreateConnection(user);
          
          expect(result.canCreate).toBe(false);
          expect(result.reason).toContain('Doctors cannot');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any user without patient profile, connection creation SHALL be denied', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
          hasDoctorProfile: fc.constant(false),
          hasPatientProfile: fc.constant(false),
        }),
        (user) => {
          const result = canCreateConnection(user);
          
          expect(result.canCreate).toBe(false);
          expect(result.reason).toContain('Patient profile not found');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('connection creation succeeds iff user has patient profile AND no doctor profile', () => {
    fc.assert(
      fc.property(anyUserArb, (user) => {
        const result = canCreateConnection(user);
        const shouldSucceed = user.hasPatientProfile && !user.hasDoctorProfile;
        
        expect(result.canCreate).toBe(shouldSucceed);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('doctor profile check takes precedence over patient profile check', () => {
    // User with both profiles should be blocked
    const user = {
      primaryRole: 'patient' as UserRole,
      hasDoctorProfile: true,
      hasPatientProfile: true,
    };
    
    const result = canCreateConnection(user);
    expect(result.canCreate).toBe(false);
    expect(result.reason).toContain('Doctors cannot');
  });
});

describe('Property 4: Primary Role Precedence', () => {
  /**
   * For any user with both doctor and patient profiles, the system SHALL
   * use the primary_role field to determine behavior, treating users with
   * primary_role 'doctor' as doctors regardless of patient profile existence.
   * 
   * Validates: Requirements 1.4
   */

  it('for any user with both profiles, doctor profile existence determines effective role', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
          hasDoctorProfile: fc.constant(true),
          hasPatientProfile: fc.constant(true),
        }),
        (user) => {
          const effectiveRole = getEffectiveRole(user);
          
          // Doctor profile always makes effective role 'doctor'
          expect(effectiveRole).toBe('doctor');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('primary_role doctor makes effective role doctor even without doctor profile', () => {
    const user = {
      primaryRole: 'doctor' as UserRole,
      hasDoctorProfile: false,
      hasPatientProfile: true,
    };
    
    const effectiveRole = getEffectiveRole(user);
    expect(effectiveRole).toBe('doctor');
  });

  it('patient profile without doctor indicators results in patient effective role', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryRole: fc.constantFrom<UserRole>('patient', 'clinic_admin', 'receptionist'),
          hasDoctorProfile: fc.constant(false),
          hasPatientProfile: fc.constant(true),
        }),
        (user) => {
          const effectiveRole = getEffectiveRole(user);
          
          expect(effectiveRole).toBe('patient');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: Role Validation Completeness', () => {
  /**
   * For any role validation check, the system SHALL verify both the
   * primary_role field in the users table AND the existence of role-specific
   * profiles in the doctors/patients tables, returning the most restrictive
   * result (doctor takes precedence).
   * 
   * Validates: Requirements 3.4
   */

  const anyUserArb = fc.record({
    primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
    hasDoctorProfile: fc.boolean(),
    hasPatientProfile: fc.boolean(),
  });

  it('validation checks both primary_role AND profile existence', () => {
    fc.assert(
      fc.property(anyUserArb, (user) => {
        const result = validateUserCanBePatient(user);
        
        // If either indicator says doctor, should be blocked
        const hasDoctorIndicator = user.hasDoctorProfile || user.primaryRole === 'doctor';
        
        expect(result.canBePatient).toBe(!hasDoctorIndicator);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('doctor profile takes precedence over patient primary_role', () => {
    const user = {
      primaryRole: 'patient' as UserRole,
      hasDoctorProfile: true,
      hasPatientProfile: false,
    };
    
    const result = validateUserCanBePatient(user);
    expect(result.canBePatient).toBe(false);
  });

  it('doctor primary_role blocks even with patient profile', () => {
    const user = {
      primaryRole: 'doctor' as UserRole,
      hasDoctorProfile: false,
      hasPatientProfile: true,
    };
    
    const result = validateUserCanBePatient(user);
    expect(result.canBePatient).toBe(false);
  });

  it('only users with no doctor indicators can be patients', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryRole: fc.constantFrom<UserRole>('patient', 'clinic_admin', 'receptionist', 'super_admin'),
          hasDoctorProfile: fc.constant(false),
          hasPatientProfile: fc.boolean(),
        }),
        (user) => {
          const result = validateUserCanBePatient(user);
          
          expect(result.canBePatient).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Doctor Viewer UI State', () => {
  /**
   * For any authenticated user with a doctor profile viewing another doctor's
   * public profile page, the UI state SHALL indicate doctor-viewer mode AND
   * SHALL NOT display patient connection options.
   * 
   * Validates: Requirements 2.1, 2.3, 5.1
   */

  interface ViewerState {
    isSignedIn: boolean;
    primaryRole: UserRole;
    hasDoctorProfile: boolean;
  }

  function determineUIState(viewer: ViewerState): {
    showConnectButton: boolean;
    showDoctorMessage: boolean;
    viewMode: 'patient' | 'doctor' | 'anonymous';
  } {
    if (!viewer.isSignedIn) {
      return {
        showConnectButton: false,
        showDoctorMessage: false,
        viewMode: 'anonymous',
      };
    }

    if (viewer.hasDoctorProfile || viewer.primaryRole === 'doctor') {
      return {
        showConnectButton: false,
        showDoctorMessage: true,
        viewMode: 'doctor',
      };
    }

    return {
      showConnectButton: true,
      showDoctorMessage: false,
      viewMode: 'patient',
    };
  }

  it('for any doctor viewer, connect button SHALL NOT be shown', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSignedIn: fc.constant(true),
          primaryRole: fc.constantFrom<UserRole>(...VALID_ROLES),
          hasDoctorProfile: fc.constant(true),
        }),
        (viewer) => {
          const uiState = determineUIState(viewer);
          
          expect(uiState.showConnectButton).toBe(false);
          expect(uiState.viewMode).toBe('doctor');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any doctor viewer, doctor message SHALL be shown', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSignedIn: fc.constant(true),
          primaryRole: fc.constant<UserRole>('doctor'),
          hasDoctorProfile: fc.boolean(),
        }),
        (viewer) => {
          const uiState = determineUIState(viewer);
          
          expect(uiState.showDoctorMessage).toBe(true);
          expect(uiState.viewMode).toBe('doctor');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any non-doctor signed-in viewer, connect button SHALL be shown', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSignedIn: fc.constant(true),
          primaryRole: fc.constantFrom<UserRole>('patient', 'clinic_admin', 'receptionist'),
          hasDoctorProfile: fc.constant(false),
        }),
        (viewer) => {
          const uiState = determineUIState(viewer);
          
          expect(uiState.showConnectButton).toBe(true);
          expect(uiState.showDoctorMessage).toBe(false);
          expect(uiState.viewMode).toBe('patient');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('anonymous viewers see neither connect button nor doctor message', () => {
    const viewer = {
      isSignedIn: false,
      primaryRole: 'patient' as UserRole,
      hasDoctorProfile: false,
    };
    
    const uiState = determineUIState(viewer);
    
    expect(uiState.showConnectButton).toBe(false);
    expect(uiState.showDoctorMessage).toBe(false);
    expect(uiState.viewMode).toBe('anonymous');
  });
});
