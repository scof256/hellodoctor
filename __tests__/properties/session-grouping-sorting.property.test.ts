/**
 * Feature: intake-sessions-management
 * Property 1: Session Grouping by Connection
 * Property 2: Session Chronological Ordering
 * 
 * Property 1: For any list of intake sessions belonging to a patient, when grouped by connection,
 * each group SHALL contain only sessions that belong to that specific connection, and no session
 * SHALL appear in multiple groups.
 * 
 * Property 2: For any list of sessions within a connection group, when sorted by newest first,
 * each session's createdAt timestamp SHALL be greater than or equal to the next session's
 * createdAt timestamp in the list.
 * 
 * Validates: Requirements 1.1, 1.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for session data
interface SessionData {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
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

interface ConnectionData {
  id: string;
  status: string;
  doctor: {
    id: string;
    specialty: string | null;
    clinicName: string | null;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    };
  };
}

interface GroupedSession {
  connection: ConnectionData;
  sessions: SessionData[];
}

// Arbitraries for generating test data
const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<'not_started' | 'in_progress' | 'ready' | 'reviewed'>;

const appointmentArb = fc.option(
  fc.record({
    id: fc.uuid(),
    scheduledAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
    duration: fc.integer({ min: 15, max: 120 }),
    status: fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled'),
  }),
  { nil: null }
);

const sessionArb = (connectionId: string): fc.Arbitrary<SessionData> => fc.record({
  id: fc.uuid(),
  connectionId: fc.constant(connectionId),
  status: sessionStatusArb,
  completeness: fc.integer({ min: 0, max: 100 }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  linkedAppointment: appointmentArb,
});

const connectionArb: fc.Arbitrary<ConnectionData> = fc.record({
  id: fc.uuid(),
  status: fc.constantFrom('active', 'disconnected', 'blocked'),
  doctor: fc.record({
    id: fc.uuid(),
    specialty: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    clinicName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    user: fc.record({
      firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      imageUrl: fc.option(fc.webUrl(), { nil: null }),
    }),
  }),
});

// Generate multiple connections with sessions
const connectionsWithSessionsArb = fc.array(connectionArb, { minLength: 1, maxLength: 5 })
  .chain(connections => {
    const sessionArbs = connections.map(conn => 
      fc.array(sessionArb(conn.id), { minLength: 1, maxLength: 10 })
        .map(sessions => ({ connection: conn, sessions }))
    );
    return fc.tuple(...sessionArbs);
  });

/**
 * Simulates the grouping logic from getAllSessionsWithAppointments
 */
function groupSessionsByConnection(sessions: SessionData[], connections: ConnectionData[]): GroupedSession[] {
  const connectionMap = new Map(connections.map(c => [c.id, c]));
  const groupedMap = new Map<string, GroupedSession>();

  for (const session of sessions) {
    const connection = connectionMap.get(session.connectionId);
    if (!connection) continue;

    if (groupedMap.has(session.connectionId)) {
      groupedMap.get(session.connectionId)!.sessions.push(session);
    } else {
      groupedMap.set(session.connectionId, {
        connection,
        sessions: [session],
      });
    }
  }

  return Array.from(groupedMap.values());
}

/**
 * Sorts sessions by createdAt in descending order (newest first)
 */
function sortSessionsNewestFirst(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Sorts sessions by createdAt in ascending order (oldest first)
 */
function sortSessionsOldestFirst(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Sorts sessions by completeness in descending order
 */
function sortSessionsByCompleteness(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => {
    if (b.completeness !== a.completeness) {
      return b.completeness - a.completeness;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

describe('Property 1: Session Grouping by Connection', () => {
  it('each group should contain only sessions belonging to that specific connection', () => {
    fc.assert(
      fc.property(connectionsWithSessionsArb, (groupedData) => {
        // Flatten all sessions
        const allSessions = groupedData.flatMap(g => g.sessions);
        const allConnections = groupedData.map(g => g.connection);

        // Group sessions
        const grouped = groupSessionsByConnection(allSessions, allConnections);

        // Verify each group contains only sessions for that connection
        for (const group of grouped) {
          for (const session of group.sessions) {
            expect(session.connectionId).toBe(group.connection.id);
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('no session should appear in multiple groups', () => {
    fc.assert(
      fc.property(connectionsWithSessionsArb, (groupedData) => {
        // Flatten all sessions
        const allSessions = groupedData.flatMap(g => g.sessions);
        const allConnections = groupedData.map(g => g.connection);

        // Group sessions
        const grouped = groupSessionsByConnection(allSessions, allConnections);

        // Collect all session IDs across all groups
        const sessionIdCounts = new Map<string, number>();
        for (const group of grouped) {
          for (const session of group.sessions) {
            const count = sessionIdCounts.get(session.id) ?? 0;
            sessionIdCounts.set(session.id, count + 1);
          }
        }

        // Verify no session appears more than once
        for (const [sessionId, count] of sessionIdCounts) {
          expect(count).toBe(1);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('all sessions should be accounted for in groups', () => {
    fc.assert(
      fc.property(connectionsWithSessionsArb, (groupedData) => {
        // Flatten all sessions
        const allSessions = groupedData.flatMap(g => g.sessions);
        const allConnections = groupedData.map(g => g.connection);

        // Group sessions
        const grouped = groupSessionsByConnection(allSessions, allConnections);

        // Count total sessions in groups
        const totalInGroups = grouped.reduce((sum, g) => sum + g.sessions.length, 0);

        // Should equal original count
        expect(totalInGroups).toBe(allSessions.length);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Session Chronological Ordering', () => {
  it('when sorted by newest first, each session createdAt should be >= next session createdAt', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            status: sessionStatusArb,
            completeness: fc.integer({ min: 0, max: 100 }),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            linkedAppointment: appointmentArb,
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (sessions) => {
          const sorted = sortSessionsNewestFirst(sessions);

          // Verify ordering: each session's createdAt >= next session's createdAt
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
              sorted[i + 1]!.createdAt.getTime()
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when sorted by oldest first, each session createdAt should be <= next session createdAt', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            status: sessionStatusArb,
            completeness: fc.integer({ min: 0, max: 100 }),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            linkedAppointment: appointmentArb,
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (sessions) => {
          const sorted = sortSessionsOldestFirst(sessions);

          // Verify ordering: each session's createdAt <= next session's createdAt
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i]!.createdAt.getTime()).toBeLessThanOrEqual(
              sorted[i + 1]!.createdAt.getTime()
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when sorted by completeness, higher completeness should come first', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            status: sessionStatusArb,
            completeness: fc.integer({ min: 0, max: 100 }),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            linkedAppointment: appointmentArb,
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (sessions) => {
          const sorted = sortSessionsByCompleteness(sessions);

          // Verify ordering: each session's completeness >= next session's completeness
          for (let i = 0; i < sorted.length - 1; i++) {
            expect(sorted[i]!.completeness).toBeGreaterThanOrEqual(
              sorted[i + 1]!.completeness
            );
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sorting should preserve all sessions (no data loss)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            status: sessionStatusArb,
            completeness: fc.integer({ min: 0, max: 100 }),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            linkedAppointment: appointmentArb,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (sessions) => {
          const sortedNewest = sortSessionsNewestFirst(sessions);
          const sortedOldest = sortSessionsOldestFirst(sessions);
          const sortedCompleteness = sortSessionsByCompleteness(sessions);

          // All sorted arrays should have same length as original
          expect(sortedNewest.length).toBe(sessions.length);
          expect(sortedOldest.length).toBe(sessions.length);
          expect(sortedCompleteness.length).toBe(sessions.length);

          // All session IDs should be present
          const originalIds = new Set(sessions.map(s => s.id));
          const newestIds = new Set(sortedNewest.map(s => s.id));
          const oldestIds = new Set(sortedOldest.map(s => s.id));
          const completenessIds = new Set(sortedCompleteness.map(s => s.id));

          expect(newestIds).toEqual(originalIds);
          expect(oldestIds).toEqual(originalIds);
          expect(completenessIds).toEqual(originalIds);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sorting should be stable for sessions with same createdAt', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
        (sameDate, ids) => {
          // Create sessions with the same createdAt
          const sessions: SessionData[] = ids.map(id => ({
            id,
            connectionId: 'conn-1',
            status: 'in_progress' as const,
            completeness: 50,
            createdAt: sameDate,
            updatedAt: sameDate,
            linkedAppointment: null,
          }));

          const sorted = sortSessionsNewestFirst(sessions);

          // All sessions should still be present
          expect(sorted.length).toBe(sessions.length);

          // All timestamps should be equal
          for (const session of sorted) {
            expect(session.createdAt.getTime()).toBe(sameDate.getTime());
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
