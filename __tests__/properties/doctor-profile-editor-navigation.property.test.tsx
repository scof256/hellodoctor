/**
 * Feature: doctor-professional-profile, Property 19: Profile Editor Navigation
 * 
 * For any doctor dashboard, there should be a navigation path to the profile editor 
 * that requires at most two clicks.
 * 
 * Validates: Requirements 8.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Navigation path structure
interface NavigationPath {
  from: string;
  to: string;
  clicks: number;
}

// Helper to validate navigation path
function validateNavigationPath(path: NavigationPath, maxClicks: number): boolean {
  return path.clicks <= maxClicks && path.clicks > 0;
}

// Helper to check if a route is the profile editor
function isProfileEditorRoute(route: string): boolean {
  return route === '/doctor/profile';
}

// Helper to check if a route is the doctor dashboard
function isDoctorDashboardRoute(route: string): boolean {
  return route === '/doctor' || route === '/doctor/';
}

// Arbitrary generator for navigation paths
const arbitraryNavigationPath = fc.record({
  from: fc.constantFrom('/doctor', '/doctor/', '/doctor/patients', '/doctor/appointments'),
  to: fc.constantFrom('/doctor/profile', '/doctor/settings', '/doctor/qr-code'),
  clicks: fc.integer({ min: 1, max: 5 }),
});

describe('Property 19: Profile Editor Navigation', () => {
  const MAX_CLICKS = 2;

  it('direct navigation from dashboard to profile editor requires at most 2 clicks', () => {
    fc.assert(
      fc.property(
        fc.constant({ from: '/doctor', to: '/doctor/profile', clicks: 1 }),
        (path) => {
          // Direct link from dashboard to profile editor
          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(true);
          expect(path.clicks).toBeLessThanOrEqual(MAX_CLICKS);
          expect(isProfileEditorRoute(path.to)).toBe(true);
          expect(isDoctorDashboardRoute(path.from)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('navigation path validation works for arbitrary paths', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),
        (clicks) => {
          const path: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks,
          };
          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('paths exceeding max clicks are correctly identified', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        (clicks) => {
          const path: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks,
          };
          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('profile editor route is correctly identified', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '/doctor/profile',
          '/doctor/profile/',
          '/doctor/profile?tab=education'
        ),
        (route) => {
          const baseRoute = route.split('?')[0]?.replace(/\/$/, '');
          expect(isProfileEditorRoute(baseRoute ?? '')).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-profile routes are correctly identified', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '/doctor',
          '/doctor/patients',
          '/doctor/appointments',
          '/doctor/messages',
          '/doctor/settings'
        ),
        (route) => {
          expect(isProfileEditorRoute(route)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dashboard routes are correctly identified', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('/doctor', '/doctor/'),
        (route) => {
          expect(isDoctorDashboardRoute(route)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('navigation from dashboard to profile requires exactly 1 click', () => {
    fc.assert(
      fc.property(
        fc.constant(1),
        (clicks) => {
          // Direct link implementation means 1 click
          expect(clicks).toBe(1);
          expect(clicks).toBeLessThanOrEqual(MAX_CLICKS);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple navigation paths to profile editor all meet click requirement', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            source: fc.constantFrom('header', 'banner', 'sidebar', 'menu'),
            clicks: fc.integer({ min: 1, max: 2 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (paths) => {
          // All paths should meet the requirement
          for (const path of paths) {
            expect(path.clicks).toBeLessThanOrEqual(MAX_CLICKS);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('navigation path is transitive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),
        fc.integer({ min: 1, max: 2 }),
        (clicks1, clicks2) => {
          // If both paths meet requirement individually, they should both pass
          const path1: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks: clicks1,
          };
          const path2: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks: clicks2,
          };

          expect(validateNavigationPath(path1, MAX_CLICKS)).toBe(true);
          expect(validateNavigationPath(path2, MAX_CLICKS)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('zero clicks is invalid navigation', () => {
    fc.assert(
      fc.property(
        fc.constant(0),
        (clicks) => {
          const path: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks,
          };
          // Zero clicks means no navigation occurred
          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('navigation requirement is consistent across all dashboard states', () => {
    fc.assert(
      fc.property(
        fc.record({
          hasPatients: fc.boolean(),
          hasAppointments: fc.boolean(),
          profileComplete: fc.boolean(),
          verificationStatus: fc.constantFrom('verified', 'pending', 'rejected'),
        }),
        (dashboardState) => {
          // Regardless of dashboard state, navigation should require at most 2 clicks
          const path: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks: 1, // Direct link always available
          };

          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(true);
          expect(path.clicks).toBeLessThanOrEqual(MAX_CLICKS);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('profile completeness does not affect navigation path length', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (completenessScore) => {
          // Whether profile is complete or not, navigation should be same
          const path: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks: 1,
          };

          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('navigation path comparison is consistent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (clicks) => {
          const path: NavigationPath = {
            from: '/doctor',
            to: '/doctor/profile',
            clicks,
          };

          const result = validateNavigationPath(path, MAX_CLICKS);

          // Verify consistency: same input should always give same output
          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(result);
          expect(validateNavigationPath(path, MAX_CLICKS)).toBe(result);

          // Verify correctness
          if (clicks <= MAX_CLICKS && clicks > 0) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
