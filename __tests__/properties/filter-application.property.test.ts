/**
 * Feature: intake-sessions-management
 * Property 11: Filter Application Correctness
 * 
 * For any status filter applied to the session list:
 * - when filter is 'active', only sessions with status 'not_started' or 'in_progress' SHALL be returned
 * - when filter is 'completed', only sessions with status 'ready' or 'reviewed' SHALL be returned
 * - when filter is 'all', all sessions SHALL be returned
 * 
 * Validates: Requirements 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for session data
type SessionStatus = 'not_started' | 'in_progress' | 'ready' | 'reviewed';
type StatusFilter = 'all' | 'active' | 'completed';

interface SessionData {
  id: string;
  connectionId: string;
  status: SessionStatus;
  completeness: number;
  createdAt: Date;
  updatedAt: Date;
  linkedAppointment: {
    id: string;
    scheduledAt: Date;
    duration: number;
    status: string;
  } | null;
}

// Arbitraries for generating test data
const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<SessionStatus>;
const statusFilterArb = fc.constantFrom('all', 'active', 'completed') as fc.Arbitrary<StatusFilter>;

const appointmentArb = fc.option(
  fc.record({
    id: fc.uuid(),
    scheduledAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
    duration: fc.integer({ min: 15, max: 120 }),
    status: fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled'),
  }),
  { nil: null }
);

const sessionArb: fc.Arbitrary<SessionData> = fc.record({
  id: fc.uuid(),
  connectionId: fc.uuid(),
  status: sessionStatusArb,
  completeness: fc.integer({ min: 0, max: 100 }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  linkedAppointment: appointmentArb,
});

const sessionsArrayArb = fc.array(sessionArb, { minLength: 0, maxLength: 30 });

/**
 * Filter sessions by status filter
 * This mirrors the logic in getAllSessionsWithAppointments
 */
function filterSessionsByStatus(sessions: SessionData[], filter: StatusFilter): SessionData[] {
  if (filter === 'all') {
    return sessions;
  }
  
  if (filter === 'active') {
    return sessions.filter(s => s.status === 'not_started' || s.status === 'in_progress');
  }
  
  if (filter === 'completed') {
    return sessions.filter(s => s.status === 'ready' || s.status === 'reviewed');
  }
  
  return sessions;
}

/**
 * Check if a session status is considered "active"
 */
function isActiveStatus(status: SessionStatus): boolean {
  return status === 'not_started' || status === 'in_progress';
}

/**
 * Check if a session status is considered "completed"
 */
function isCompletedStatus(status: SessionStatus): boolean {
  return status === 'ready' || status === 'reviewed';
}

describe('Property 11: Filter Application Correctness', () => {
  it('when filter is "active", only sessions with status not_started or in_progress are returned', () => {
    fc.assert(
      fc.property(sessionsArrayArb, (sessions) => {
        const filtered = filterSessionsByStatus(sessions, 'active');
        
        // All returned sessions must have active status
        for (const session of filtered) {
          expect(isActiveStatus(session.status)).toBe(true);
        }
        
        // No session with completed status should be in the result
        for (const session of filtered) {
          expect(isCompletedStatus(session.status)).toBe(false);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('when filter is "completed", only sessions with status ready or reviewed are returned', () => {
    fc.assert(
      fc.property(sessionsArrayArb, (sessions) => {
        const filtered = filterSessionsByStatus(sessions, 'completed');
        
        // All returned sessions must have completed status
        for (const session of filtered) {
          expect(isCompletedStatus(session.status)).toBe(true);
        }
        
        // No session with active status should be in the result
        for (const session of filtered) {
          expect(isActiveStatus(session.status)).toBe(false);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('when filter is "all", all sessions are returned', () => {
    fc.assert(
      fc.property(sessionsArrayArb, (sessions) => {
        const filtered = filterSessionsByStatus(sessions, 'all');
        
        // All sessions should be returned
        expect(filtered.length).toBe(sessions.length);
        
        // All original session IDs should be present
        const originalIds = new Set(sessions.map(s => s.id));
        const filteredIds = new Set(filtered.map(s => s.id));
        expect(filteredIds).toEqual(originalIds);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('active filter returns all and only active sessions', () => {
    fc.assert(
      fc.property(sessionsArrayArb, (sessions) => {
        const filtered = filterSessionsByStatus(sessions, 'active');
        const expectedActive = sessions.filter(s => isActiveStatus(s.status));
        
        // Count should match
        expect(filtered.length).toBe(expectedActive.length);
        
        // All expected active sessions should be in filtered result
        const filteredIds = new Set(filtered.map(s => s.id));
        for (const session of expectedActive) {
          expect(filteredIds.has(session.id)).toBe(true);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('completed filter returns all and only completed sessions', () => {
    fc.assert(
      fc.property(sessionsArrayArb, (sessions) => {
        const filtered = filterSessionsByStatus(sessions, 'completed');
        const expectedCompleted = sessions.filter(s => isCompletedStatus(s.status));
        
        // Count should match
        expect(filtered.length).toBe(expectedCompleted.length);
        
        // All expected completed sessions should be in filtered result
        const filteredIds = new Set(filtered.map(s => s.id));
        for (const session of expectedCompleted) {
          expect(filteredIds.has(session.id)).toBe(true);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('active and completed filters are mutually exclusive and exhaustive', () => {
    fc.assert(
      fc.property(sessionsArrayArb, (sessions) => {
        const activeSessions = filterSessionsByStatus(sessions, 'active');
        const completedSessions = filterSessionsByStatus(sessions, 'completed');
        
        // No overlap between active and completed
        const activeIds = new Set(activeSessions.map(s => s.id));
        const completedIds = new Set(completedSessions.map(s => s.id));
        
        for (const id of activeIds) {
          expect(completedIds.has(id)).toBe(false);
        }
        
        // Together they should equal all sessions
        expect(activeSessions.length + completedSessions.length).toBe(sessions.length);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('filtering preserves session data integrity', () => {
    fc.assert(
      fc.property(sessionsArrayArb, statusFilterArb, (sessions, filter) => {
        const filtered = filterSessionsByStatus(sessions, filter);
        
        // Each filtered session should have all its original data intact
        for (const filteredSession of filtered) {
          const original = sessions.find(s => s.id === filteredSession.id);
          expect(original).toBeDefined();
          
          if (original) {
            expect(filteredSession.connectionId).toBe(original.connectionId);
            expect(filteredSession.status).toBe(original.status);
            expect(filteredSession.completeness).toBe(original.completeness);
            expect(filteredSession.createdAt.getTime()).toBe(original.createdAt.getTime());
            expect(filteredSession.updatedAt.getTime()).toBe(original.updatedAt.getTime());
            expect(filteredSession.linkedAppointment).toEqual(original.linkedAppointment);
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('empty session list returns empty for any filter', () => {
    fc.assert(
      fc.property(statusFilterArb, (filter) => {
        const filtered = filterSessionsByStatus([], filter);
        expect(filtered.length).toBe(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('filter is idempotent - applying same filter twice gives same result', () => {
    fc.assert(
      fc.property(sessionsArrayArb, statusFilterArb, (sessions, filter) => {
        const filteredOnce = filterSessionsByStatus(sessions, filter);
        const filteredTwice = filterSessionsByStatus(filteredOnce, filter);
        
        expect(filteredTwice.length).toBe(filteredOnce.length);
        
        const onceIds = new Set(filteredOnce.map(s => s.id));
        const twiceIds = new Set(filteredTwice.map(s => s.id));
        expect(twiceIds).toEqual(onceIds);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
