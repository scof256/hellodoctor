/**
 * Feature: dashboard-performance-optimization, Property 6: Cache Stale Time Configuration
 * 
 * For any dashboard stats query, the cache stale time SHALL be 30 seconds for
 * patient/doctor dashboards and 60 seconds for admin dashboard.
 * 
 * Validates: Requirements 4.4, 8.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CACHE_CONFIGS, getCacheConfig } from '../../src/trpc/cache-config';

/**
 * This property test validates that dashboard cache configurations have the
 * correct stale times as specified in the requirements:
 * - Patient/Doctor dashboards: 30 seconds stale time
 * - Admin dashboard: 60 seconds stale time
 */

// Expected stale times in milliseconds
const PATIENT_DOCTOR_STALE_TIME = 30 * 1000; // 30 seconds
const ADMIN_STALE_TIME = 60 * 1000; // 60 seconds

// Dashboard query keys for patient/doctor
const patientDoctorDashboardKeys = [
  'dashboard.stats',
  'dashboard.getDoctorDashboard',
  'dashboard.getPatientDashboard',
  'dashboard.connections',
  'dashboard.appointments',
];

// Dashboard query keys for admin
const adminDashboardKeys = [
  'dashboard.admin.stats',
  'dashboard.getAdminDashboard',
];

describe('Property 6: Cache Stale Time Configuration', () => {
  describe('Patient/Doctor Dashboard Cache Configuration', () => {
    const patientDoctorKeyArb = fc.constantFrom(...patientDoctorDashboardKeys);

    it('patient/doctor dashboard queries SHALL have 30 second stale time', () => {
      fc.assert(
        fc.property(patientDoctorKeyArb, (queryKey) => {
          const config = CACHE_CONFIGS[queryKey];
          expect(config).toBeDefined();
          expect(config?.staleTime).toBe(PATIENT_DOCTOR_STALE_TIME);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('patient/doctor dashboard queries SHALL have cache time >= stale time', () => {
      fc.assert(
        fc.property(patientDoctorKeyArb, (queryKey) => {
          const config = CACHE_CONFIGS[queryKey];
          expect(config).toBeDefined();
          expect(config?.cacheTime).toBeGreaterThanOrEqual(config?.staleTime ?? 0);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Admin Dashboard Cache Configuration', () => {
    const adminKeyArb = fc.constantFrom(...adminDashboardKeys);

    it('admin dashboard queries SHALL have 60 second stale time', () => {
      fc.assert(
        fc.property(adminKeyArb, (queryKey) => {
          const config = CACHE_CONFIGS[queryKey];
          expect(config).toBeDefined();
          expect(config?.staleTime).toBe(ADMIN_STALE_TIME);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('admin dashboard queries SHALL have cache time >= stale time', () => {
      fc.assert(
        fc.property(adminKeyArb, (queryKey) => {
          const config = CACHE_CONFIGS[queryKey];
          expect(config).toBeDefined();
          expect(config?.cacheTime).toBeGreaterThanOrEqual(config?.staleTime ?? 0);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('getCacheConfig Function Validation', () => {
    it('getCacheConfig SHALL return correct config for patient/doctor dashboard keys', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...patientDoctorDashboardKeys),
          (queryKey) => {
            const parts = queryKey.split('.');
            const config = getCacheConfig(parts);
            expect(config.staleTime).toBe(PATIENT_DOCTOR_STALE_TIME);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getCacheConfig SHALL return correct config for admin dashboard keys', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...adminDashboardKeys),
          (queryKey) => {
            const parts = queryKey.split('.');
            const config = getCacheConfig(parts);
            expect(config.staleTime).toBe(ADMIN_STALE_TIME);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Stale Time Relationship Validation', () => {
    it('admin stale time SHALL be exactly 2x patient/doctor stale time', () => {
      const adminConfig = CACHE_CONFIGS['dashboard.admin.stats'];
      const patientDoctorConfig = CACHE_CONFIGS['dashboard.stats'];
      
      expect(adminConfig?.staleTime).toBe(patientDoctorConfig?.staleTime! * 2);
    });

    it('all dashboard configs SHALL have refetchOnWindowFocus appropriately set', () => {
      const allDashboardKeys = [...patientDoctorDashboardKeys, ...adminDashboardKeys];
      const dashboardKeyArb = fc.constantFrom(...allDashboardKeys);

      fc.assert(
        fc.property(dashboardKeyArb, (queryKey) => {
          const config = CACHE_CONFIGS[queryKey];
          expect(config).toBeDefined();
          // Stats queries should not refetch on window focus (they're cached)
          if (queryKey.includes('stats')) {
            expect(config?.refetchOnWindowFocus).toBe(false);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Cache Configuration Completeness', () => {
    it('all required dashboard cache keys SHALL be defined', () => {
      const requiredKeys = [
        'dashboard',
        'dashboard.stats',
        'dashboard.admin.stats',
        'dashboard.getDoctorDashboard',
        'dashboard.getPatientDashboard',
        'dashboard.getAdminDashboard',
        'dashboard.connections',
        'dashboard.appointments',
      ];

      for (const key of requiredKeys) {
        expect(CACHE_CONFIGS[key]).toBeDefined();
        expect(CACHE_CONFIGS[key]?.staleTime).toBeGreaterThan(0);
        expect(CACHE_CONFIGS[key]?.cacheTime).toBeGreaterThan(0);
      }
    });
  });
});
