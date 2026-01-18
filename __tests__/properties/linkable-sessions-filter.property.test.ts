/**
 * Feature: intake-sessions-management
 * Property 8: Linkable Sessions Filter
 * 
 * For any connection, the list of sessions available for appointment linking SHALL contain
 * only sessions where: status is 'ready', OR (status is 'in_progress' AND completeness >= 50).
 * Sessions with status 'not_started' or 'reviewed' SHALL NOT appear in the linkable sessions list.
 * 
 * Validates: Requirements 5.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for linkable sessions
type SessionStatus = 'not_started' | 'in_progress' | 'ready' | 'reviewed';

interface Session {
  id: string;
  connectionId: string;
  status: SessionStatus;
  completeness: number;
  createdAt: Date;
  updatedAt: Date;
}

// Arbitraries
const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<SessionStatus>;

const sessionArb = (connectionId: string): fc.Arbitrary<Session> => fc.record({
  id: fc.uuid(),
  connectionId: fc.constant(connectionId),
  status: sessionStatusArb,
  completeness: fc.integer({ min: 0, max: 100 }),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
});

/**
 * Determines if a session is linkable for appointment booking
 * Based on the business rules:
 * - status 'ready' OR
 * - status 'in_progress' AND completeness >= 50
 */
function isSessionLinkable(session: Session): boolean {
  if (session.status === 'ready') {
    return true;
  }
  
  if (session.status === 'in_progress' && session.completeness >= 50) {
    return true;
  }
  
  return false;
}

/**
 * Filters sessions to only those that are linkable
 */
function filterLinkableSessions(sessions: Session[]): Session[] {
  return sessions.filter(isSessionLinkable);
}

describe('Property 8: Linkable Sessions Filter', () => {
  it('sessions with status ready should always be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'ready',
            completeness,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sessions with status in_progress and completeness >= 50 should be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 50, max: 100 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'in_progress',
            completeness,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sessions with status in_progress and completeness < 50 should NOT be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 0, max: 49 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'in_progress',
            completeness,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sessions with status not_started should never be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'not_started',
            completeness,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sessions with status reviewed should never be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }),
        (sessionId, connectionId, completeness) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'reviewed',
            completeness,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtering should return only linkable sessions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(sessionArb(fc.sample(fc.uuid(), 1)[0]!), { minLength: 1, maxLength: 20 }),
        (connectionId, sessions) => {
          // Update all sessions to have the same connectionId
          const normalizedSessions = sessions.map(s => ({ ...s, connectionId }));
          
          const linkable = filterLinkableSessions(normalizedSessions);
          
          // All returned sessions should be linkable
          for (const session of linkable) {
            expect(isSessionLinkable(session)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtering should not include any non-linkable sessions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(sessionArb(fc.sample(fc.uuid(), 1)[0]!), { minLength: 1, maxLength: 20 }),
        (connectionId, sessions) => {
          // Update all sessions to have the same connectionId
          const normalizedSessions = sessions.map(s => ({ ...s, connectionId }));
          
          const linkable = filterLinkableSessions(normalizedSessions);
          const linkableIds = new Set(linkable.map(s => s.id));
          
          // Check that non-linkable sessions are not in the result
          for (const session of normalizedSessions) {
            if (!isSessionLinkable(session)) {
              expect(linkableIds.has(session.id)).toBe(false);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtering should preserve all linkable sessions', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(sessionArb(fc.sample(fc.uuid(), 1)[0]!), { minLength: 1, maxLength: 20 }),
        (connectionId, sessions) => {
          // Update all sessions to have the same connectionId
          const normalizedSessions = sessions.map(s => ({ ...s, connectionId }));
          
          const linkable = filterLinkableSessions(normalizedSessions);
          const linkableIds = new Set(linkable.map(s => s.id));
          
          // Check that all linkable sessions are in the result
          for (const session of normalizedSessions) {
            if (isSessionLinkable(session)) {
              expect(linkableIds.has(session.id)).toBe(true);
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary test: completeness exactly 50 with in_progress should be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (sessionId, connectionId) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'in_progress',
            completeness: 50, // Exactly at boundary
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary test: completeness exactly 49 with in_progress should NOT be linkable', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (sessionId, connectionId) => {
          const session: Session = {
            id: sessionId,
            connectionId,
            status: 'in_progress',
            completeness: 49, // Just below boundary
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          expect(isSessionLinkable(session)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isSessionLinkable should be equivalent to the formal specification', () => {
    fc.assert(
      fc.property(
        sessionArb(fc.sample(fc.uuid(), 1)[0]!),
        (session) => {
          const isLinkable = isSessionLinkable(session);
          
          // Formal specification:
          // linkable iff (status === 'ready') OR (status === 'in_progress' AND completeness >= 50)
          const formalSpec = 
            session.status === 'ready' || 
            (session.status === 'in_progress' && session.completeness >= 50);
          
          expect(isLinkable).toBe(formalSpec);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('filtering empty array should return empty array', () => {
    const result = filterLinkableSessions([]);
    expect(result).toEqual([]);
  });

  it('filtering array with no linkable sessions should return empty array', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(
          fc.record({
            id: fc.uuid(),
            connectionId: fc.uuid(),
            status: fc.constantFrom('not_started', 'reviewed') as fc.Arbitrary<SessionStatus>,
            completeness: fc.integer({ min: 0, max: 100 }),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
            updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (connectionId, sessions) => {
          // Also add in_progress sessions with low completeness
          const lowCompletenessSessions = sessions.map(s => ({
            ...s,
            connectionId,
            status: 'in_progress' as SessionStatus,
            completeness: Math.min(s.completeness, 49),
          }));
          
          const allNonLinkable = [
            ...sessions.map(s => ({ ...s, connectionId })),
            ...lowCompletenessSessions,
          ];
          
          const result = filterLinkableSessions(allNonLinkable);
          
          // Result should be empty since all sessions are non-linkable
          expect(result.length).toBe(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
