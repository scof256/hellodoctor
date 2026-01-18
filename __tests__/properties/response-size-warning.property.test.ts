/**
 * Feature: site-performance-optimization, Property 8: Response Size Warning
 * 
 * For any API response exceeding 100KB in size, the system SHALL log a warning
 * message containing the response size and endpoint name.
 * 
 * Validates: Requirements 6.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  checkResponseSize, 
  getLastWarning, 
  clearLastWarning,
  logPerformanceWarning 
} from '@/server/lib/query-optimizer';
import { RESPONSE_SIZE_WARNING_THRESHOLD_KB } from '@/types/api-responses';

describe('Property 8: Response Size Warning', () => {
  beforeEach(() => {
    clearLastWarning();
  });

  it('SHALL log warning for responses exceeding threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 110, max: 200 }),
        (sizeKB) => {
          clearLastWarning();
          const largeData = 'x'.repeat(sizeKB * 1024);
          checkResponseSize({ data: largeData }, 'test.endpoint');
          const warning = getLastWarning();
          return warning !== null && warning.type === 'response_size';
        }
      ),
      { numRuns: 10 }
    );
  });

  it('SHALL NOT log warning for responses under threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (sizeKB) => {
          clearLastWarning();
          const smallData = 'x'.repeat(sizeKB * 1024);
          checkResponseSize({ data: smallData }, 'test.endpoint');
          return getLastWarning() === null;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('logPerformanceWarning SHALL store warning details', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 101, max: 500 }),
        (endpoint, value) => {
          clearLastWarning();
          logPerformanceWarning('response_size', { endpoint, value, threshold: 100 });
          const warning = getLastWarning();
          return warning !== null && warning.endpoint === endpoint && warning.value === value;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('RESPONSE_SIZE_WARNING_THRESHOLD_KB SHALL be exactly 100', () => {
    expect(RESPONSE_SIZE_WARNING_THRESHOLD_KB).toBe(100);
  });

  it('SHALL handle empty responses without error', () => {
    clearLastWarning();
    const size = checkResponseSize({}, 'test.endpoint');
    expect(size).toBeGreaterThanOrEqual(0);
    expect(getLastWarning()).toBeNull();
  });
});
