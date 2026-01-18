/**
 * Property-Based Test: Logout Redirect Consistency
 * 
 * Feature: auth-ui-restoration, Property 4: Logout redirect consistency
 * 
 * Tests that logout redirects are consistent based on user role:
 * - Patients redirect to /sign-in
 * - Doctors redirect to /
 * - Admins redirect to /
 * 
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getLogoutRedirectUrl } from '@/app/lib/auth-utils';

describe('Property: Logout Redirect Consistency', () => {
  /**
   * Property 4: Logout Redirect Consistency
   * 
   * For any user completing logout, the system should redirect to the 
   * appropriate page based on their role (sign-in for patients, home for doctors/admins).
   * 
   * **Validates: Requirements 5.2, 5.3, 5.4**
   */
  it('should redirect patients to /sign-in and doctors/admins to /', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary pathnames for different roles
        fc.oneof(
          // Patient paths
          fc.constantFrom(
            '/patient',
            '/patient/appointments',
            '/patient/messages',
            '/patient/intake',
            '/patient/sessions',
            '/patient/settings'
          ),
          // Doctor paths
          fc.constantFrom(
            '/doctor',
            '/doctor/patients',
            '/doctor/appointments',
            '/doctor/availability',
            '/doctor/messages',
            '/doctor/scribe',
            '/doctor/qr-code',
            '/doctor/team'
          ),
          // Admin paths
          fc.constantFrom(
            '/admin',
            '/admin/users',
            '/admin/doctors',
            '/admin/tickets',
            '/admin/config',
            '/admin/analytics',
            '/admin/audit'
          )
        ),
        (pathname) => {
          // Get the redirect URL
          const redirectUrl = getLogoutRedirectUrl(pathname);
          
          // Determine expected redirect based on role
          const isPatient = pathname.startsWith('/patient');
          const expectedRedirect = isPatient ? '/sign-in' : '/';
          
          // Verify redirect matches expected value
          expect(redirectUrl).toBe(expectedRedirect);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Patient paths always redirect to /sign-in
   * 
   * **Validates: Requirements 5.2, 5.3**
   */
  it('should always redirect patient paths to /sign-in', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary patient sub-paths
        fc.constantFrom(
          'appointments',
          'messages',
          'intake',
          'sessions',
          'settings',
          'notifications'
        ),
        fc.option(fc.uuid(), { nil: undefined }),
        (subPath, id) => {
          // Construct patient pathname
          const pathname = id ? `/patient/${subPath}/${id}` : `/patient/${subPath}`;
          
          // Get redirect URL
          const redirectUrl = getLogoutRedirectUrl(pathname);
          
          // All patient paths should redirect to /sign-in
          expect(redirectUrl).toBe('/sign-in');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Doctor and admin paths always redirect to /
   * 
   * **Validates: Requirements 5.2, 5.4**
   */
  it('should always redirect doctor and admin paths to /', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary doctor or admin paths
        fc.oneof(
          fc.tuple(
            fc.constant('doctor'),
            fc.constantFrom(
              'patients',
              'appointments',
              'availability',
              'messages',
              'scribe',
              'qr-code',
              'team'
            )
          ),
          fc.tuple(
            fc.constant('admin'),
            fc.constantFrom(
              'users',
              'doctors',
              'tickets',
              'config',
              'analytics',
              'audit'
            )
          )
        ),
        fc.option(fc.uuid(), { nil: undefined }),
        ([role, subPath], id) => {
          // Construct pathname
          const pathname = id ? `/${role}/${subPath}/${id}` : `/${role}/${subPath}`;
          
          // Get redirect URL
          const redirectUrl = getLogoutRedirectUrl(pathname);
          
          // All doctor and admin paths should redirect to /
          expect(redirectUrl).toBe('/');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Redirect URL is always a valid path
   * 
   * **Validates: Requirements 5.2, 5.3, 5.4**
   */
  it('should always return a valid redirect path', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary pathnames
        fc.oneof(
          fc.constantFrom('/patient', '/doctor', '/admin'),
          fc.tuple(
            fc.constantFrom('patient', 'doctor', 'admin'),
            fc.stringOf(fc.constantFrom('a', 'b', 'c', '-', '/', '0', '1'), { minLength: 1, maxLength: 50 })
          ).map(([role, path]) => `/${role}/${path}`)
        ),
        (pathname) => {
          // Get redirect URL
          const redirectUrl = getLogoutRedirectUrl(pathname);
          
          // Verify it's one of the valid redirect URLs
          expect(['/sign-in', '/']).toContain(redirectUrl);
          
          // Verify it starts with /
          expect(redirectUrl).toMatch(/^\//);
          
          // Verify it's not empty
          expect(redirectUrl.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Redirect is deterministic for the same pathname
   * 
   * **Validates: Requirements 5.2, 5.3, 5.4**
   */
  it('should return the same redirect URL for the same pathname', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '/patient',
          '/patient/appointments',
          '/doctor',
          '/doctor/patients',
          '/admin',
          '/admin/users'
        ),
        (pathname) => {
          // Call the function multiple times
          const redirect1 = getLogoutRedirectUrl(pathname);
          const redirect2 = getLogoutRedirectUrl(pathname);
          const redirect3 = getLogoutRedirectUrl(pathname);
          
          // All calls should return the same value
          expect(redirect1).toBe(redirect2);
          expect(redirect2).toBe(redirect3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
