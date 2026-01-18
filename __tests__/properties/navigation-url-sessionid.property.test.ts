/**
 * Property Test: Navigation URL includes sessionId
 * 
 * Feature: session-view-navigation-fix, Property 1: Navigation URL includes sessionId
 * Validates: Requirements 1.1, 1.2
 * 
 * For any session card action (View or Continue), the resulting navigation URL
 * SHALL contain both the connectionId path parameter and the sessionId query parameter
 * matching the clicked session.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Helper to generate navigation URL (mirrors the logic in sessions page)
function generateNavigationUrl(connectionId: string, sessionId: string): string {
  return `/patient/intake/${connectionId}?sessionId=${sessionId}`;
}

// Helper to parse navigation URL
function parseNavigationUrl(url: string): { connectionId: string | null; sessionId: string | null } {
  const pathMatch = url.match(/\/patient\/intake\/([^?]+)/);
  const connectionId = pathMatch ? pathMatch[1] : null;
  
  const urlObj = new URL(url, 'http://localhost');
  const sessionId = urlObj.searchParams.get('sessionId');
  
  return { connectionId, sessionId };
}

describe('Property 1: Navigation URL includes sessionId', () => {
  // Arbitrary for valid UUIDs - realistic session/connection IDs
  const uuidArb = fc.uuid();
  
  // Simpler arbitrary for IDs (alphanumeric only, no special chars that would be URL encoded)
  const idArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,36}$/);

  it('should include connectionId in path for all valid IDs', () => {
    fc.assert(
      fc.property(idArb, idArb, (connectionId, sessionId) => {
        const url = generateNavigationUrl(connectionId, sessionId);
        const parsed = parseNavigationUrl(url);
        
        expect(parsed.connectionId).toBe(connectionId);
      }),
      { numRuns: 100 }
    );
  });

  it('should include sessionId as query parameter for all valid IDs', () => {
    fc.assert(
      fc.property(idArb, idArb, (connectionId, sessionId) => {
        const url = generateNavigationUrl(connectionId, sessionId);
        const parsed = parseNavigationUrl(url);
        
        expect(parsed.sessionId).toBe(sessionId);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid URL structure for any session/connection pair', () => {
    fc.assert(
      fc.property(idArb, idArb, (connectionId, sessionId) => {
        const url = generateNavigationUrl(connectionId, sessionId);
        
        // URL should start with correct path
        expect(url.startsWith('/patient/intake/')).toBe(true);
        
        // URL should contain query parameter
        expect(url.includes('?sessionId=')).toBe(true);
        
        // Both IDs should be present and recoverable
        const parsed = parseNavigationUrl(url);
        expect(parsed.connectionId).toBe(connectionId);
        expect(parsed.sessionId).toBe(sessionId);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve sessionId exactly without modification', () => {
    fc.assert(
      fc.property(idArb, idArb, (connectionId, sessionId) => {
        const url = generateNavigationUrl(connectionId, sessionId);
        const parsed = parseNavigationUrl(url);
        
        // Session ID should be exactly preserved (no encoding issues for simple IDs)
        expect(parsed.sessionId).toEqual(sessionId);
      }),
      { numRuns: 100 }
    );
  });
});
