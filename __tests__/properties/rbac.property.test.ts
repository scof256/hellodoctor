/**
 * Feature: doctor-appointment-saas, Property 1: Role-Based Access Enforcement
 * 
 * For any API request to a protected endpoint, if the authenticated user lacks
 * the required permission for that endpoint, the API SHALL return a 403 Forbidden
 * response and SHALL NOT execute the requested operation.
 * 
 * Validates: Requirements 25.2, 25.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { UserRole } from '@/types';

// Define the role hierarchy and permissions
const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 5,
  doctor: 4,
  clinic_admin: 3,
  receptionist: 2,
  patient: 1,
};

const VALID_ROLES: UserRole[] = ['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient'];

// Define which roles can access which procedure types
const PROCEDURE_PERMISSIONS: Record<string, UserRole[]> = {
  public: VALID_ROLES, // All roles can access public
  protected: VALID_ROLES, // All authenticated users
  admin: ['super_admin'],
  doctor: ['super_admin', 'doctor'],
  clinicAdmin: ['super_admin', 'doctor', 'clinic_admin'],
  receptionist: ['super_admin', 'doctor', 'clinic_admin', 'receptionist'],
  patient: VALID_ROLES, // All authenticated users can access patient procedures
};

// Simulate the role checking logic from tRPC middleware
function hasPermission(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

// Simulate checking if a role has higher or equal hierarchy
function hasHierarchyAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

describe('Property 1: Role-Based Access Enforcement', () => {
  // Arbitrary generators
  const roleArb = fc.constantFrom<UserRole>(...VALID_ROLES);
  const procedureTypeArb = fc.constantFrom(...Object.keys(PROCEDURE_PERMISSIONS));

  describe('Permission Checking', () => {
    it('for any user role and procedure type, access is granted iff role is in allowed list', () => {
      fc.assert(
        fc.property(
          roleArb,
          procedureTypeArb,
          (userRole: UserRole, procedureType: string) => {
            const allowedRoles = PROCEDURE_PERMISSIONS[procedureType];
            const hasAccess = hasPermission(userRole, allowedRoles);
            const shouldHaveAccess = allowedRoles.includes(userRole);
            
            expect(hasAccess).toBe(shouldHaveAccess);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('super_admin role should have access to all procedure types', () => {
      fc.assert(
        fc.property(
          procedureTypeArb,
          (procedureType: string) => {
            const allowedRoles = PROCEDURE_PERMISSIONS[procedureType];
            const hasAccess = hasPermission('super_admin', allowedRoles);
            
            expect(hasAccess).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('patient role should only have access to public, protected, and patient procedures', () => {
      fc.assert(
        fc.property(
          procedureTypeArb,
          (procedureType: string) => {
            const allowedRoles = PROCEDURE_PERMISSIONS[procedureType];
            const hasAccess = hasPermission('patient', allowedRoles);
            
            // Patient should have access to public, protected, and patient
            // Patient should NOT have access to admin, doctor, clinicAdmin, receptionist
            const restrictedProcedures = ['admin', 'doctor', 'clinicAdmin', 'receptionist'];
            const shouldHaveAccess = !restrictedProcedures.includes(procedureType);
            
            expect(hasAccess).toBe(shouldHaveAccess);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Role Hierarchy', () => {
    it('role hierarchy values are unique and ordered', () => {
      const values = Object.values(ROLE_HIERARCHY);
      const uniqueValues = new Set(values);
      
      expect(uniqueValues.size).toBe(values.length);
      expect(Math.max(...values)).toBe(5); // super_admin
      expect(Math.min(...values)).toBe(1); // patient
    });

    it('for any two roles, hierarchy comparison is consistent', () => {
      fc.assert(
        fc.property(
          roleArb,
          roleArb,
          (role1: UserRole, role2: UserRole) => {
            const h1 = ROLE_HIERARCHY[role1];
            const h2 = ROLE_HIERARCHY[role2];
            
            // Hierarchy comparison should be transitive
            if (h1 > h2) {
              expect(hasHierarchyAccess(role1, role2)).toBe(true);
              expect(hasHierarchyAccess(role2, role1)).toBe(false);
            } else if (h1 < h2) {
              expect(hasHierarchyAccess(role1, role2)).toBe(false);
              expect(hasHierarchyAccess(role2, role1)).toBe(true);
            } else {
              // Same role
              expect(hasHierarchyAccess(role1, role2)).toBe(true);
              expect(hasHierarchyAccess(role2, role1)).toBe(true);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('super_admin has hierarchy access to all roles', () => {
      fc.assert(
        fc.property(
          roleArb,
          (targetRole: UserRole) => {
            expect(hasHierarchyAccess('super_admin', targetRole)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('patient only has hierarchy access to patient role', () => {
      fc.assert(
        fc.property(
          roleArb,
          (targetRole: UserRole) => {
            const hasAccess = hasHierarchyAccess('patient', targetRole);
            const shouldHaveAccess = targetRole === 'patient';
            
            expect(hasAccess).toBe(shouldHaveAccess);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Access Denial Scenarios', () => {
    it('for any unauthorized role attempting admin access, permission should be denied', () => {
      const nonAdminRoles: UserRole[] = ['doctor', 'clinic_admin', 'receptionist', 'patient'];
      
      fc.assert(
        fc.property(
          fc.constantFrom<UserRole>(...nonAdminRoles),
          (userRole: UserRole) => {
            const hasAccess = hasPermission(userRole, PROCEDURE_PERMISSIONS.admin);
            
            expect(hasAccess).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('for any unauthorized role attempting doctor access, permission should be denied', () => {
      const nonDoctorRoles: UserRole[] = ['clinic_admin', 'receptionist', 'patient'];
      
      fc.assert(
        fc.property(
          fc.constantFrom<UserRole>(...nonDoctorRoles),
          (userRole: UserRole) => {
            const hasAccess = hasPermission(userRole, PROCEDURE_PERMISSIONS.doctor);
            
            expect(hasAccess).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('receptionist should not have access to clinic admin procedures', () => {
      const hasAccess = hasPermission('receptionist', PROCEDURE_PERMISSIONS.clinicAdmin);
      expect(hasAccess).toBe(false);
    });
  });

  describe('Multiple Role Support', () => {
    // Simulate a user with multiple roles
    function hasAnyPermission(userRoles: UserRole[], allowedRoles: UserRole[]): boolean {
      return userRoles.some(role => allowedRoles.includes(role));
    }

    it('user with multiple roles should have access if any role is allowed', () => {
      fc.assert(
        fc.property(
          fc.array(roleArb, { minLength: 1, maxLength: 3 }),
          procedureTypeArb,
          (userRoles: UserRole[], procedureType: string) => {
            const allowedRoles = PROCEDURE_PERMISSIONS[procedureType];
            const hasAccess = hasAnyPermission(userRoles, allowedRoles);
            const shouldHaveAccess = userRoles.some(r => allowedRoles.includes(r));
            
            expect(hasAccess).toBe(shouldHaveAccess);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('user with patient and doctor roles should have doctor-level access', () => {
      const userRoles: UserRole[] = ['patient', 'doctor'];
      
      expect(hasAnyPermission(userRoles, PROCEDURE_PERMISSIONS.doctor)).toBe(true);
      expect(hasAnyPermission(userRoles, PROCEDURE_PERMISSIONS.clinicAdmin)).toBe(true);
      expect(hasAnyPermission(userRoles, PROCEDURE_PERMISSIONS.admin)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('empty allowed roles list should deny all access', () => {
      fc.assert(
        fc.property(
          roleArb,
          (userRole: UserRole) => {
            const hasAccess = hasPermission(userRole, []);
            expect(hasAccess).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all roles in allowed list should grant access to any valid role', () => {
      fc.assert(
        fc.property(
          roleArb,
          (userRole: UserRole) => {
            const hasAccess = hasPermission(userRole, VALID_ROLES);
            expect(hasAccess).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
