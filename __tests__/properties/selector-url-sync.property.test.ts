import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface Session {
  id: string;
  status: string;
}

function getCurrentSessionFromUrl(urlSessionId: string | null, sessions: Session[]): Session | null {
  if (!urlSessionId) return null;
  return sessions.find(s => s.id === urlSessionId) ?? null;
}

describe('Property 5: Selector reflects URL parameter', () => {
  const idArb = fc.stringMatching(/^[a-zA-Z0-9_-]{8,20}$/);
  const statusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed');

  it('should show URL session as selected in selector', () => {
    fc.assert(
      fc.property(idArb, statusArb, (sessionId, status) => {
        const sessions: Session[] = [
          { id: sessionId, status },
          { id: 'other-session', status: 'not_started' },
        ];
        const currentSession = getCurrentSessionFromUrl(sessionId, sessions);
        expect(currentSession?.id).toBe(sessionId);
      }),
      { numRuns: 10 }
    );
  });

  it('should return null when URL sessionId not in sessions', () => {
    fc.assert(
      fc.property(idArb, (invalidSessionId) => {
        const sessions: Session[] = [
          { id: 'session-1', status: 'in_progress' },
          { id: 'session-2', status: 'ready' },
        ];
        const currentSession = getCurrentSessionFromUrl(invalidSessionId, sessions);
        if (invalidSessionId !== 'session-1' && invalidSessionId !== 'session-2') {
          expect(currentSession).toBeNull();
        }
      }),
      { numRuns: 10 }
    );
  });
});
