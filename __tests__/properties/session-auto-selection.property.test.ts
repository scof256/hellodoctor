import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface Session {
  id: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  connectionId: string;
}

function selectSession(
  urlSessionId: string | null,
  existingSessions: Session[],
  connectionId: string
): string | null {
  if (urlSessionId) {
    const validSession = existingSessions.find(
      (s) => s.id === urlSessionId && s.connectionId === connectionId
    );
    if (validSession) {
      return urlSessionId;
    }
  }
  
  const activeSession = 
    existingSessions.find((s) => s.status === 'in_progress' && s.connectionId === connectionId) ??
    existingSessions.find((s) => s.status === 'not_started' && s.connectionId === connectionId) ??
    existingSessions.find((s) => s.status === 'ready' && s.connectionId === connectionId);
  
  return activeSession?.id ?? null;
}

describe('Property 3: Auto-selection when no sessionId', () => {
  const idArb = fc.string({ minLength: 5, maxLength: 10 });

  it('should auto-select in_progress session first', () => {
    fc.assert(
      fc.property(idArb, (connectionId) => {
        const sessions: Session[] = [
          { id: 'ready-session', status: 'ready', connectionId },
          { id: 'in-progress-session', status: 'in_progress', connectionId },
          { id: 'not-started-session', status: 'not_started', connectionId },
        ];
        const selectedId = selectSession(null, sessions, connectionId);
        expect(selectedId).toBe('in-progress-session');
      }),
      { numRuns: 10 }
    );
  });

  it('should auto-select not_started if no in_progress', () => {
    fc.assert(
      fc.property(idArb, (connectionId) => {
        const sessions: Session[] = [
          { id: 'ready-session', status: 'ready', connectionId },
          { id: 'not-started-session', status: 'not_started', connectionId },
        ];
        const selectedId = selectSession(null, sessions, connectionId);
        expect(selectedId).toBe('not-started-session');
      }),
      { numRuns: 10 }
    );
  });

  it('should auto-select ready if no in_progress or not_started', () => {
    fc.assert(
      fc.property(idArb, (connectionId) => {
        const sessions: Session[] = [
          { id: 'ready-session', status: 'ready', connectionId },
        ];
        const selectedId = selectSession(null, sessions, connectionId);
        expect(selectedId).toBe('ready-session');
      }),
      { numRuns: 10 }
    );
  });
});
