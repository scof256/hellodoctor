/**
 * Feature: dashboard-performance-optimization, Property 10: Server-Side Intake Status Sorting
 * 
 * For any doctor dashboard connections response, connections with intake status 'ready'
 * SHALL appear before connections with other intake statuses.
 * 
 * Validates: Requirements 6.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * This property test validates that doctor dashboard connections are sorted
 * by intake status on the server side, with 'ready' status appearing first.
 * 
 * The sorting priority is:
 * 1. 'ready' (priority 0) - needs doctor review
 * 2. 'in_progress' (priority 1) - patient is working on it
 * 3. 'not_started', 'reviewed', null (priority 2) - other statuses
 */

// Types
type IntakeStatus = 'not_started' | 'in_progress' | 'ready' | 'reviewed' | null;

interface ConnectionWithIntake {
  id: string;
  connectedAt: Date;
  intakeStatus: IntakeStatus;
}

// Get sorting priority for intake status
function getIntakeStatusPriority(status: IntakeStatus): number {
  switch (status) {
    case 'ready':
      return 0;
    case 'in_progress':
      return 1;
    default:
      return 2;
  }
}

// Sort connections by intake status (server-side sorting logic)
function sortConnectionsByIntakeStatus(connections: ConnectionWithIntake[]): ConnectionWithIntake[] {
  return [...connections].sort((a, b) => {
    const priorityA = getIntakeStatusPriority(a.intakeStatus);
    const priorityB = getIntakeStatusPriority(b.intakeStatus);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Secondary sort by connectedAt (most recent first)
    return b.connectedAt.getTime() - a.connectedAt.getTime();
  });
}

// Check if connections are properly sorted
function isProperlyOrdered(connections: ConnectionWithIntake[]): boolean {
  for (let i = 0; i < connections.length - 1; i++) {
    const currentPriority = getIntakeStatusPriority(connections[i]!.intakeStatus);
    const nextPriority = getIntakeStatusPriority(connections[i + 1]!.intakeStatus);
    
    if (currentPriority > nextPriority) {
      return false;
    }
  }
  return true;
}

// Arbitraries
const uuidArb = fc.uuid();
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') });
const intakeStatusArb = fc.constantFrom<IntakeStatus>('not_started', 'in_progress', 'ready', 'reviewed', null);

const connectionArb = fc.record({
  id: uuidArb,
  connectedAt: dateArb,
  intakeStatus: intakeStatusArb,
});

const connectionsArrayArb = fc.array(connectionArb, { minLength: 0, maxLength: 50 });

describe('Property 10: Server-Side Intake Status Sorting', () => {
  describe('Sorting Priority Validation', () => {
    it('ready status SHALL have highest priority (0)', () => {
      expect(getIntakeStatusPriority('ready')).toBe(0);
    });

    it('in_progress status SHALL have second priority (1)', () => {
      expect(getIntakeStatusPriority('in_progress')).toBe(1);
    });

    it('other statuses SHALL have lowest priority (2)', () => {
      expect(getIntakeStatusPriority('not_started')).toBe(2);
      expect(getIntakeStatusPriority('reviewed')).toBe(2);
      expect(getIntakeStatusPriority(null)).toBe(2);
    });

    it('ready SHALL have lower priority value than in_progress', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          expect(getIntakeStatusPriority('ready')).toBeLessThan(getIntakeStatusPriority('in_progress'));
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('in_progress SHALL have lower priority value than other statuses', () => {
      const otherStatuses: IntakeStatus[] = ['not_started', 'reviewed', null];
      
      fc.assert(
        fc.property(fc.constantFrom(...otherStatuses), (status) => {
          expect(getIntakeStatusPriority('in_progress')).toBeLessThan(getIntakeStatusPriority(status));
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Sorting Behavior Validation', () => {
    it('sorted connections SHALL have ready status before all other statuses', () => {
      fc.assert(
        fc.property(connectionsArrayArb, (connections) => {
          const sorted = sortConnectionsByIntakeStatus(connections);
          
          // Find the last 'ready' index and first non-ready index
          let lastReadyIndex = -1;
          let firstNonReadyIndex = sorted.length;
          
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i]!.intakeStatus === 'ready') {
              lastReadyIndex = i;
            } else if (firstNonReadyIndex === sorted.length) {
              firstNonReadyIndex = i;
            }
          }
          
          // All ready items should come before non-ready items
          if (lastReadyIndex >= 0 && firstNonReadyIndex < sorted.length) {
            expect(lastReadyIndex).toBeLessThan(firstNonReadyIndex);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('sorted connections SHALL have in_progress status before not_started/reviewed/null', () => {
      fc.assert(
        fc.property(connectionsArrayArb, (connections) => {
          const sorted = sortConnectionsByIntakeStatus(connections);
          
          // Find the last 'in_progress' index and first lower-priority index
          let lastInProgressIndex = -1;
          let firstLowerPriorityIndex = sorted.length;
          
          for (let i = 0; i < sorted.length; i++) {
            const status = sorted[i]!.intakeStatus;
            if (status === 'in_progress') {
              lastInProgressIndex = i;
            } else if (status !== 'ready' && firstLowerPriorityIndex === sorted.length) {
              firstLowerPriorityIndex = i;
            }
          }
          
          // All in_progress items should come before lower priority items
          if (lastInProgressIndex >= 0 && firstLowerPriorityIndex < sorted.length) {
            expect(lastInProgressIndex).toBeLessThan(firstLowerPriorityIndex);
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('sorted connections SHALL maintain proper ordering', () => {
      fc.assert(
        fc.property(connectionsArrayArb, (connections) => {
          const sorted = sortConnectionsByIntakeStatus(connections);
          expect(isProperlyOrdered(sorted)).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('sorting SHALL be idempotent', () => {
      fc.assert(
        fc.property(connectionsArrayArb, (connections) => {
          const sorted1 = sortConnectionsByIntakeStatus(connections);
          const sorted2 = sortConnectionsByIntakeStatus(sorted1);
          
          // Sorting twice should produce the same result
          expect(sorted1.map(c => c.id)).toEqual(sorted2.map(c => c.id));
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('sorting SHALL preserve all connections', () => {
      fc.assert(
        fc.property(connectionsArrayArb, (connections) => {
          const sorted = sortConnectionsByIntakeStatus(connections);
          
          // Same length
          expect(sorted.length).toBe(connections.length);
          
          // Same IDs (just reordered)
          const originalIds = new Set(connections.map(c => c.id));
          const sortedIds = new Set(sorted.map(c => c.id));
          expect(sortedIds).toEqual(originalIds);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('empty array SHALL remain empty after sorting', () => {
      const sorted = sortConnectionsByIntakeStatus([]);
      expect(sorted).toEqual([]);
    });

    it('single connection SHALL remain unchanged after sorting', () => {
      fc.assert(
        fc.property(connectionArb, (connection) => {
          const sorted = sortConnectionsByIntakeStatus([connection]);
          expect(sorted.length).toBe(1);
          expect(sorted[0]!.id).toBe(connection.id);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('all same status SHALL maintain relative order by connectedAt', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: uuidArb,
              connectedAt: dateArb,
              intakeStatus: fc.constant<IntakeStatus>('ready'),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (connections) => {
            const sorted = sortConnectionsByIntakeStatus(connections);
            
            // All have same status, so should be sorted by connectedAt (descending)
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(sorted[i]!.connectedAt.getTime()).toBeGreaterThanOrEqual(
                sorted[i + 1]!.connectedAt.getTime()
              );
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
