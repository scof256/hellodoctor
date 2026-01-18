import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

function generateUrlOnSwitch(connectionId: string, newSessionId: string): string {
  return `/patient/intake/${connectionId}?sessionId=${newSessionId}`;
}

function parseUrl(url: string): { connectionId: string | null; sessionId: string | null } {
  const pathMatch = url.match(/\/patient\/intake\/([^?]+)/);
  const connectionId = pathMatch ? pathMatch[1] ?? null : null;
  const urlObj = new URL(url, 'http://localhost');
  const sessionId = urlObj.searchParams.get('sessionId');
  return { connectionId, sessionId };
}

describe('Property 4: URL updates on session switch', () => {
  const idArb = fc.stringMatching(/^[a-zA-Z0-9_-]{8,20}$/);

  it('should update URL with new sessionId on switch', () => {
    fc.assert(
      fc.property(idArb, idArb, (connectionId, newSessionId) => {
        const url = generateUrlOnSwitch(connectionId, newSessionId);
        const parsed = parseUrl(url);
        expect(parsed.sessionId).toBe(newSessionId);
        expect(parsed.connectionId).toBe(connectionId);
      }),
      { numRuns: 10 }
    );
  });

  it('should preserve connectionId when switching sessions', () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, (connectionId, session1, session2) => {
        const url1 = generateUrlOnSwitch(connectionId, session1);
        const url2 = generateUrlOnSwitch(connectionId, session2);
        const parsed1 = parseUrl(url1);
        const parsed2 = parseUrl(url2);
        expect(parsed1.connectionId).toBe(parsed2.connectionId);
      }),
      { numRuns: 10 }
    );
  });
});
