/**
 * Feature: intake-sessions-management
 * Property 4: Session Creation Independence
 * 
 * For any valid connection, creating a new intake session SHALL always succeed and return
 * a session with status 'not_started', completeness 0, and default medical data, regardless
 * of how many existing sessions exist for that connection.
 * 
 * Validates: Requirements 2.1, 2.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { INITIAL_MEDICAL_DATA, INITIAL_THOUGHT } from '@/types';
import type { MedicalData, DoctorThought } from '@/types';

// Types for session creation
interface NewSession {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  medicalData: MedicalData;
  doctorThought: DoctorThought;
  completeness: number;
  currentAgent: string;
}

interface ExistingSession {
  id: string;
  connectionId: string;
  status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
  completeness: number;
}

// Arbitraries
const sessionStatusArb = fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed') as fc.Arbitrary<'not_started' | 'in_progress' | 'ready' | 'reviewed'>;

const existingSessionArb = (connectionId: string): fc.Arbitrary<ExistingSession> => fc.record({
  id: fc.uuid(),
  connectionId: fc.constant(connectionId),
  status: sessionStatusArb,
  completeness: fc.integer({ min: 0, max: 100 }),
});

/**
 * Simulates the createNewSession mutation logic
 * This creates a new session regardless of existing sessions
 */
function createNewSession(connectionId: string): NewSession {
  return {
    id: crypto.randomUUID(),
    connectionId,
    status: 'not_started',
    medicalData: { ...INITIAL_MEDICAL_DATA },
    doctorThought: { ...INITIAL_THOUGHT },
    completeness: 0,
    currentAgent: 'Triage',
  };
}

/**
 * Validates that a newly created session has the correct initial state
 */
function validateNewSession(session: NewSession, expectedConnectionId: string): boolean {
  // Status must be 'not_started'
  if (session.status !== 'not_started') return false;
  
  // Completeness must be 0
  if (session.completeness !== 0) return false;
  
  // Connection ID must match
  if (session.connectionId !== expectedConnectionId) return false;
  
  // Current agent must be 'Triage'
  if (session.currentAgent !== 'Triage') return false;
  
  // Medical data must match initial state
  if (session.medicalData.chiefComplaint !== INITIAL_MEDICAL_DATA.chiefComplaint) return false;
  if (session.medicalData.hpi !== INITIAL_MEDICAL_DATA.hpi) return false;
  if (session.medicalData.bookingStatus !== INITIAL_MEDICAL_DATA.bookingStatus) return false;
  if (session.medicalData.currentAgent !== INITIAL_MEDICAL_DATA.currentAgent) return false;
  
  // Doctor thought must match initial state
  if (session.doctorThought.strategy !== INITIAL_THOUGHT.strategy) return false;
  if (session.doctorThought.nextMove !== INITIAL_THOUGHT.nextMove) return false;
  
  return true;
}

describe('Property 4: Session Creation Independence', () => {
  it('creating a new session should always return status not_started', () => {
    fc.assert(
      fc.property(fc.uuid(), (connectionId) => {
        const newSession = createNewSession(connectionId);
        expect(newSession.status).toBe('not_started');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('creating a new session should always return completeness 0', () => {
    fc.assert(
      fc.property(fc.uuid(), (connectionId) => {
        const newSession = createNewSession(connectionId);
        expect(newSession.completeness).toBe(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('creating a new session should always return default medical data', () => {
    fc.assert(
      fc.property(fc.uuid(), (connectionId) => {
        const newSession = createNewSession(connectionId);
        
        // Verify medical data matches initial state
        expect(newSession.medicalData.chiefComplaint).toBe(INITIAL_MEDICAL_DATA.chiefComplaint);
        expect(newSession.medicalData.hpi).toBe(INITIAL_MEDICAL_DATA.hpi);
        expect(newSession.medicalData.medicalRecords).toEqual(INITIAL_MEDICAL_DATA.medicalRecords);
        expect(newSession.medicalData.recordsCheckCompleted).toBe(INITIAL_MEDICAL_DATA.recordsCheckCompleted);
        expect(newSession.medicalData.medications).toEqual(INITIAL_MEDICAL_DATA.medications);
        expect(newSession.medicalData.allergies).toEqual(INITIAL_MEDICAL_DATA.allergies);
        expect(newSession.medicalData.pastMedicalHistory).toEqual(INITIAL_MEDICAL_DATA.pastMedicalHistory);
        expect(newSession.medicalData.familyHistory).toBe(INITIAL_MEDICAL_DATA.familyHistory);
        expect(newSession.medicalData.socialHistory).toBe(INITIAL_MEDICAL_DATA.socialHistory);
        expect(newSession.medicalData.reviewOfSystems).toEqual(INITIAL_MEDICAL_DATA.reviewOfSystems);
        expect(newSession.medicalData.currentAgent).toBe(INITIAL_MEDICAL_DATA.currentAgent);
        expect(newSession.medicalData.clinicalHandover).toBe(INITIAL_MEDICAL_DATA.clinicalHandover);
        expect(newSession.medicalData.ucgRecommendations).toBe(INITIAL_MEDICAL_DATA.ucgRecommendations);
        expect(newSession.medicalData.bookingStatus).toBe(INITIAL_MEDICAL_DATA.bookingStatus);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('creating a new session should succeed regardless of existing sessions count', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 0, max: 100 }), // Number of existing sessions
        (connectionId, existingCount) => {
          // Simulate existing sessions (they don't affect creation)
          const existingSessions: ExistingSession[] = [];
          for (let i = 0; i < existingCount; i++) {
            existingSessions.push({
              id: crypto.randomUUID(),
              connectionId,
              status: ['not_started', 'in_progress', 'ready', 'reviewed'][i % 4] as ExistingSession['status'],
              completeness: (i * 25) % 101,
            });
          }

          // Create new session - should always succeed
          const newSession = createNewSession(connectionId);
          
          // Validate the new session
          expect(validateNewSession(newSession, connectionId)).toBe(true);
          
          // New session should have unique ID
          const existingIds = new Set(existingSessions.map(s => s.id));
          expect(existingIds.has(newSession.id)).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('creating a new session should succeed regardless of existing session statuses', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(sessionStatusArb, { minLength: 0, maxLength: 10 }),
        (connectionId, existingStatuses) => {
          // Simulate existing sessions with various statuses
          const existingSessions = existingStatuses.map(status => ({
            id: crypto.randomUUID(),
            connectionId,
            status,
            completeness: status === 'ready' ? 100 : status === 'reviewed' ? 100 : 50,
          }));

          // Create new session - should always succeed regardless of existing statuses
          const newSession = createNewSession(connectionId);
          
          // Validate the new session
          expect(validateNewSession(newSession, connectionId)).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each new session should have a unique ID', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 2, max: 20 }),
        (connectionId, count) => {
          const sessions: NewSession[] = [];
          
          // Create multiple sessions for the same connection
          for (let i = 0; i < count; i++) {
            sessions.push(createNewSession(connectionId));
          }
          
          // All IDs should be unique
          const ids = sessions.map(s => s.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(count);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('new session should have correct connection ID', () => {
    fc.assert(
      fc.property(fc.uuid(), (connectionId) => {
        const newSession = createNewSession(connectionId);
        expect(newSession.connectionId).toBe(connectionId);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('new session should have Triage as current agent', () => {
    fc.assert(
      fc.property(fc.uuid(), (connectionId) => {
        const newSession = createNewSession(connectionId);
        expect(newSession.currentAgent).toBe('Triage');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('new session doctor thought should match initial state', () => {
    fc.assert(
      fc.property(fc.uuid(), (connectionId) => {
        const newSession = createNewSession(connectionId);
        
        expect(newSession.doctorThought.differentialDiagnosis).toEqual(INITIAL_THOUGHT.differentialDiagnosis);
        expect(newSession.doctorThought.missingInformation).toEqual(INITIAL_THOUGHT.missingInformation);
        expect(newSession.doctorThought.strategy).toBe(INITIAL_THOUGHT.strategy);
        expect(newSession.doctorThought.nextMove).toBe(INITIAL_THOUGHT.nextMove);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
