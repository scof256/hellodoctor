/**
 * Feature: site-performance-optimization, Property 2: Query Warning Threshold
 * 
 * For any API call that results in more than 5 database queries, the system SHALL
 * log a warning message containing the query count and endpoint name.
 * 
 * Validates: Requirements 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  checkQueryCount,
  logPerformanceWarning,
  type QueryOptimizerConfig,
} from '@/server/lib/query-optimizer';

describe('Property 2: Query Warning Threshold', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('for any query count > 5, a warning SHALL be logged with query count and endpoint name', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 100 }), // Query counts above threshold
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // Endpoint names
        (queryCount, endpoint) => {
          consoleWarnSpy.mockClear();
          
          checkQueryCount(queryCount, endpoint, { enableWarnings: true });
          
          // Warning should be logged
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          
          // Warning message should contain query count and endpoint
          const warningMessage = consoleWarnSpy.mock.calls[0]?.[0] as string;
          expect(warningMessage).toContain(queryCount.toString());
          expect(warningMessage).toContain(endpoint);
          expect(warningMessage).toContain('Query count');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any query count <= 5, no warning SHALL be logged', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }), // Query counts at or below threshold
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (queryCount, endpoint) => {
          consoleWarnSpy.mockClear();
          
          checkQueryCount(queryCount, endpoint, { enableWarnings: true });
          
          // No warning should be logged
          expect(consoleWarnSpy).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any custom threshold, warnings are logged only when query count exceeds it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // Custom threshold
        fc.integer({ min: 0, max: 30 }), // Query count
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (threshold, queryCount, endpoint) => {
          consoleWarnSpy.mockClear();
          
          checkQueryCount(queryCount, endpoint, { 
            enableWarnings: true, 
            maxQueriesPerCall: threshold 
          });
          
          if (queryCount > threshold) {
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            const warningMessage = consoleWarnSpy.mock.calls[0]?.[0] as string;
            expect(warningMessage).toContain(queryCount.toString());
            expect(warningMessage).toContain(endpoint);
          } else {
            expect(consoleWarnSpy).not.toHaveBeenCalled();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('logPerformanceWarning formats query_count warnings correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (endpoint, value, threshold) => {
          consoleWarnSpy.mockClear();
          
          logPerformanceWarning('query_count', { endpoint, value, threshold });
          
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          const message = consoleWarnSpy.mock.calls[0]?.[0] as string;
          
          // Message should contain all required information
          expect(message).toContain('[Performance Warning]');
          expect(message).toContain('Query count');
          expect(message).toContain(endpoint);
          expect(message).toContain(value.toString());
          expect(message).toContain(threshold.toString());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('warnings are suppressed when enableWarnings is false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 6, max: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (queryCount, endpoint) => {
          consoleWarnSpy.mockClear();
          
          checkQueryCount(queryCount, endpoint, { enableWarnings: false });
          
          // No warning should be logged when disabled
          expect(consoleWarnSpy).not.toHaveBeenCalled();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
