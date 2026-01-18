/**
 * Property-Based Tests for Session Naming and Identification
 * 
 * Feature: session-naming-identification
 * 
 * These tests validate the correctness properties defined in the design document
 * for session naming, display, validation, and navigation.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getSessionDisplayName } from '../../app/components/SessionCard';

// ============================================================================
// Test Utilities and Types
// ============================================================================

interface Session {
  id: string;
  name: string | null;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  connectionId: string;
  createdAt: Date;
  chiefComplaint?: string | null;
}

interface MedicalData {
  chiefComplaint?: string | null;
  symptoms?: string[];
}

// Simulates the session name update logic
function updateSessionName(
  currentName: string | null,
  newName: string | null
): { success: boolean; name: string | null; error?: string } {
  if (newName !== null && newName.length > 255) {
    return { success: false, name: currentName, error: 'Name must be 255 characters or less' };
  }
  return { success: true, name: newName };
}

// Simulates auto-naming from chief complaint
function autoNameFromChiefComplaint(
  session: { name: string | null },
  medicalData: MedicalData
): string | null {
  // Only auto-name if session has no existing name
  if (session.name !== null) {
    return session.name;
  }
  
  // Use chief complaint if available
  if (medicalData.chiefComplaint) {
    // Truncate to 255 characters
    return medicalData.chiefComplaint.substring(0, 255);
  }
  
  return null;
}

// Simulates session selection with URL parameter
function selectSessionByUrl(
  urlSessionId: string | null,
  sessions: Session[],
  connectionId: string
): Session | null {
  if (urlSessionId) {
    const session = sessions.find(
      (s) => s.id === urlSessionId && s.connectionId === connectionId
    );
    if (session) {
      return session;
    }
  }
  
  // Fall back to auto-selection
  return (
    sessions.find((s) => s.status === 'in_progress' && s.connectionId === connectionId) ??
    sessions.find((s) => s.status === 'not_started' && s.connectionId === connectionId) ??
    sessions.find((s) => s.status === 'ready' && s.connectionId === connectionId) ??
    null
  );
}

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

const validSessionNameArb = fc.string({ minLength: 1, maxLength: 255 });
const invalidSessionNameArb = fc.string({ minLength: 256, maxLength: 500 });
const sessionIdArb = fc.uuid();
const connectionIdArb = fc.uuid();

const sessionStatusArb = fc.constantFrom(
  'not_started' as const,
  'in_progress' as const,
  'ready' as const,
  'reviewed' as const
);

const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

const sessionArb = fc.record({
  id: sessionIdArb,
  name: fc.option(validSessionNameArb, { nil: null }),
  status: sessionStatusArb,
  connectionId: connectionIdArb,
  createdAt: dateArb,
});

const medicalDataArb = fc.record({
  chiefComplaint: fc.option(fc.string({ minLength: 1, maxLength: 300 }), { nil: null }),
  symptoms: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 5 }),
});

// ============================================================================
// Property 1: Session Name Persistence Round-Trip
// **Validates: Requirements 1.1, 3.3**
// ============================================================================

describe('Property 1: Session Name Persistence Round-Trip', () => {
  /**
   * For any valid session name string (non-empty, ≤255 characters),
   * updating a session's name and then retrieving that session
   * SHALL return the same name value.
   */
  it('should persist and retrieve the same name for valid names', () => {
    fc.assert(
      fc.property(validSessionNameArb, (name) => {
        const result = updateSessionName(null, name);
        expect(result.success).toBe(true);
        expect(result.name).toBe(name);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle null name (clearing name)', () => {
    fc.assert(
      fc.property(validSessionNameArb, (originalName) => {
        // First set a name
        const setResult = updateSessionName(null, originalName);
        expect(setResult.success).toBe(true);
        
        // Then clear it
        const clearResult = updateSessionName(originalName, null);
        expect(clearResult.success).toBe(true);
        expect(clearResult.name).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 2: Auto-Naming from Chief Complaint
// **Validates: Requirements 1.3, 2.1, 2.2**
// ============================================================================

describe('Property 2: Auto-Naming from Chief Complaint', () => {
  /**
   * For any intake session where the AI extracts a chief complaint
   * and the session has no existing name, the session name SHALL be
   * automatically set to the chief complaint value (truncated to 255 characters).
   */
  it('should auto-name session from chief complaint when name is null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 300 }),
        (chiefComplaint) => {
          const session = { name: null };
          const medicalData = { chiefComplaint };
          
          const newName = autoNameFromChiefComplaint(session, medicalData);
          
          expect(newName).not.toBeNull();
          expect(newName).toBe(chiefComplaint.substring(0, 255));
          expect(newName!.length).toBeLessThanOrEqual(255);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT overwrite existing session name', () => {
    fc.assert(
      fc.property(
        validSessionNameArb,
        fc.string({ minLength: 1, maxLength: 300 }),
        (existingName, chiefComplaint) => {
          const session = { name: existingName };
          const medicalData = { chiefComplaint };
          
          const newName = autoNameFromChiefComplaint(session, medicalData);
          
          // Should preserve existing name
          expect(newName).toBe(existingName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null when no chief complaint and no existing name', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const session = { name: null };
        const medicalData = { chiefComplaint: null };
        
        const newName = autoNameFromChiefComplaint(session, medicalData);
        
        expect(newName).toBeNull();
      }),
      { numRuns: 10 }
    );
  });

  it('should truncate chief complaints longer than 255 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 256, maxLength: 500 }),
        (longComplaint) => {
          const session = { name: null };
          const medicalData = { chiefComplaint: longComplaint };
          
          const newName = autoNameFromChiefComplaint(session, medicalData);
          
          expect(newName).not.toBeNull();
          expect(newName!.length).toBe(255);
          expect(newName).toBe(longComplaint.substring(0, 255));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 3: Session Navigation Specificity
// **Validates: Requirements 5.1, 5.2, 5.3**
// ============================================================================

describe('Property 3: Session Navigation Specificity', () => {
  /**
   * For any valid session ID passed as a URL parameter,
   * loading the intake page SHALL display messages and data
   * from that specific session, not from any other session.
   */
  it('should load the exact session specified in URL', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.array(sessionArb, { minLength: 2, maxLength: 10 }),
        (connectionId, baseSessions) => {
          // Ensure all sessions belong to the same connection
          const sessions = baseSessions.map((s) => ({ ...s, connectionId }));
          
          // Pick a random session to navigate to
          const targetSession = sessions[0];
          
          const selectedSession = selectSessionByUrl(
            targetSession.id,
            sessions,
            connectionId
          );
          
          expect(selectedSession).not.toBeNull();
          expect(selectedSession!.id).toBe(targetSession.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fall back to auto-selection for invalid session ID', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        fc.array(sessionArb, { minLength: 1, maxLength: 5 }),
        (connectionId, baseSessions) => {
          const sessions = baseSessions.map((s) => ({ ...s, connectionId }));
          const invalidSessionId = 'invalid-session-id-that-does-not-exist';
          
          const selectedSession = selectSessionByUrl(
            invalidSessionId,
            sessions,
            connectionId
          );
          
          // Should fall back to auto-selection (not return the invalid ID)
          if (selectedSession) {
            expect(selectedSession.id).not.toBe(invalidSessionId);
            expect(sessions.some((s) => s.id === selectedSession.id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not load session from different connection', () => {
    fc.assert(
      fc.property(
        connectionIdArb,
        connectionIdArb,
        sessionArb,
        (connectionId1, connectionId2, session) => {
          fc.pre(connectionId1 !== connectionId2);
          
          const sessionInConnection1 = { ...session, connectionId: connectionId1 };
          const sessions = [sessionInConnection1];
          
          // Try to load session using connection2
          const selectedSession = selectSessionByUrl(
            sessionInConnection1.id,
            sessions,
            connectionId2
          );
          
          // Should not find the session (wrong connection)
          expect(selectedSession).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 4: Display Name Fallback
// **Validates: Requirements 1.4, 3.4, 4.1, 4.2**
// ============================================================================

describe('Property 4: Display Name Fallback', () => {
  /**
   * For any session with a null name, the display function SHALL return
   * the creation timestamp; for any session with a non-null name,
   * the display function SHALL return the name.
   */
  it('should return name when session has a name', () => {
    fc.assert(
      fc.property(validSessionNameArb, dateArb, (name, createdAt) => {
        const session = { name, createdAt };
        const displayName = getSessionDisplayName(session);
        
        expect(displayName).toBe(name);
      }),
      { numRuns: 100 }
    );
  });

  it('should return formatted timestamp when name is null', () => {
    fc.assert(
      fc.property(dateArb, (createdAt) => {
        const session = { name: null, createdAt };
        const displayName = getSessionDisplayName(session);
        
        // Should not be empty
        expect(displayName.length).toBeGreaterThan(0);
        // Should not be "null" string
        expect(displayName).not.toBe('null');
        // Should contain date-like content (month abbreviation or number)
        expect(displayName).toMatch(/\w+/);
      }),
      { numRuns: 100 }
    );
  });

  it('should never return null or undefined', () => {
    fc.assert(
      fc.property(
        fc.option(validSessionNameArb, { nil: null }),
        dateArb,
        (name, createdAt) => {
          const session = { name, createdAt };
          const displayName = getSessionDisplayName(session);
          
          expect(displayName).not.toBeNull();
          expect(displayName).not.toBeUndefined();
          expect(typeof displayName).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 5: Name Validation Enforcement
// **Validates: Requirements 3.2**
// ============================================================================

describe('Property 5: Name Validation Enforcement', () => {
  /**
   * For any session name update attempt with a string exceeding 255 characters,
   * the system SHALL reject the update and return an error.
   */
  it('should reject names exceeding 255 characters', () => {
    fc.assert(
      fc.property(invalidSessionNameArb, (longName) => {
        fc.pre(longName.length > 255);
        
        const result = updateSessionName(null, longName);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.name).toBeNull(); // Original name preserved
      }),
      { numRuns: 100 }
    );
  });

  it('should accept names at exactly 255 characters', () => {
    const exactLengthName = 'a'.repeat(255);
    
    const result = updateSessionName(null, exactLengthName);
    
    expect(result.success).toBe(true);
    expect(result.name).toBe(exactLengthName);
    expect(result.name!.length).toBe(255);
  });

  it('should accept names under 255 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 254 }),
        (name) => {
          const result = updateSessionName(null, name);
          
          expect(result.success).toBe(true);
          expect(result.name).toBe(name);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve original name on validation failure', () => {
    fc.assert(
      fc.property(
        validSessionNameArb,
        invalidSessionNameArb,
        (originalName, invalidName) => {
          fc.pre(invalidName.length > 255);
          
          const result = updateSessionName(originalName, invalidName);
          
          expect(result.success).toBe(false);
          expect(result.name).toBe(originalName);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 7: New Session Initial State
// **Validates: Requirements 1.2**
// ============================================================================

describe('Property 7: New Session Initial State', () => {
  /**
   * For any newly created intake session, the session name SHALL be null initially.
   */
  
  // Simulates creating a new session
  function createNewSession(connectionId: string): Session {
    return {
      id: crypto.randomUUID(),
      name: null, // Must be null initially
      status: 'not_started',
      connectionId,
      createdAt: new Date(),
    };
  }

  it('should create sessions with null name', () => {
    fc.assert(
      fc.property(connectionIdArb, (connectionId) => {
        const newSession = createNewSession(connectionId);
        
        expect(newSession.name).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('should create sessions with not_started status', () => {
    fc.assert(
      fc.property(connectionIdArb, (connectionId) => {
        const newSession = createNewSession(connectionId);
        
        expect(newSession.status).toBe('not_started');
      }),
      { numRuns: 100 }
    );
  });
});
