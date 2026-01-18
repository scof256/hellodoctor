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

describe('Property 2: Session loads from URL parameter', () => {
  const idArb = fc.string({ minLength: 5, maxLength: 10 });
  const statusArb = fc.constantFrom('not_started' as const, 'in_progress' as const, 'ready' as const, 'reviewed' as const);

  it('should load the exact session specified in URL when valid', () => {
    fc.assert(
      fc.property(idArb, idArb, statusArb, (connectionId, sessionId, status) => {
        const sessions: Session[] = [{ id: sessionId, status, connectionId }];
        const selectedId = selectSession(sessionId, sessions, connectionId);
        expect(selectedId).toBe(sessionId);
      }),
      { numRuns: 10 }
    );
  });

  it('should fall back to auto-selection when URL sessionId is invalid', () => {
    fc.assert(
      fc.property(idArb, (connectionId) => {
        const sessions: Session[] = [
          { id: 'valid-session', status: 'in_progress', connectionId },
        ];
        const selectedId = selectSession('invalid-id', sessions, connectionId);
        expect(selectedId).toBe('valid-session');
      }),
      { numRuns: 10 }
    );
  });
});
