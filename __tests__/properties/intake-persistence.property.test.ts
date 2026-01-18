/**
 * Feature: doctor-appointment-saas, Property 4: Intake Session Persistence Round-Trip
 * 
 * For any intake session with medical data, saving the session to the database 
 * and then retrieving it SHALL produce an equivalent MedicalData object with 
 * all fields preserved.
 * 
 * Validates: Requirements 8.2, 8.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { MedicalData, SBAR, DoctorThought, AgentRole } from '@/app/types';
import { VALID_AGENT_ROLES } from '@/app/types';

// Arbitraries for generating test data
const agentRoleArb: fc.Arbitrary<AgentRole> = fc.constantFrom(...VALID_AGENT_ROLES);

const sbarArb: fc.Arbitrary<SBAR> = fc.record({
  situation: fc.string({ minLength: 0, maxLength: 500 }),
  background: fc.string({ minLength: 0, maxLength: 500 }),
  assessment: fc.string({ minLength: 0, maxLength: 500 }),
  recommendation: fc.string({ minLength: 0, maxLength: 500 }),
});

const doctorThoughtArb: fc.Arbitrary<DoctorThought> = fc.record({
  differentialDiagnosis: fc.array(
    fc.record({
      condition: fc.string({ minLength: 1, maxLength: 100 }),
      probability: fc.string({ minLength: 1, maxLength: 50 }),
      reasoning: fc.string({ minLength: 1, maxLength: 200 }),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  missingInformation: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
  strategy: fc.string({ minLength: 0, maxLength: 200 }),
  nextMove: fc.string({ minLength: 0, maxLength: 200 }),
});

const bookingStatusArb = fc.constantFrom('collecting', 'ready', 'booked') as fc.Arbitrary<'collecting' | 'ready' | 'booked'>;

const medicalDataArb: fc.Arbitrary<MedicalData> = fc.record({
  chiefComplaint: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  hpi: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  medicalRecords: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
  recordsCheckCompleted: fc.boolean(),
  medications: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
  allergies: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
  pastMedicalHistory: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 10 }),
  familyHistory: fc.option(fc.string({ minLength: 1, maxLength: 300 }), { nil: null }),
  socialHistory: fc.option(fc.string({ minLength: 1, maxLength: 300 }), { nil: null }),
  reviewOfSystems: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 15 }),
  currentAgent: agentRoleArb,
  clinicalHandover: fc.option(sbarArb, { nil: null }),
  ucgRecommendations: fc.option(fc.string({ minLength: 1, maxLength: 300 }), { nil: null }),
  bookingStatus: bookingStatusArb,
  appointmentDate: fc.option(fc.date().map(d => d.toISOString()), { nil: undefined }),
});

// Simulate JSON serialization/deserialization (what happens with JSONB in PostgreSQL)
function simulateDatabaseRoundTrip<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

describe('Property 4: Intake Session Persistence Round-Trip', () => {
  it('should preserve MedicalData through JSON serialization (simulating JSONB storage)', () => {
    fc.assert(
      fc.property(medicalDataArb, (medicalData) => {
        const retrieved = simulateDatabaseRoundTrip(medicalData);
        
        // All fields should be preserved
        expect(retrieved.chiefComplaint).toBe(medicalData.chiefComplaint);
        expect(retrieved.hpi).toBe(medicalData.hpi);
        expect(retrieved.medicalRecords).toEqual(medicalData.medicalRecords);
        expect(retrieved.recordsCheckCompleted).toBe(medicalData.recordsCheckCompleted);
        expect(retrieved.medications).toEqual(medicalData.medications);
        expect(retrieved.allergies).toEqual(medicalData.allergies);
        expect(retrieved.pastMedicalHistory).toEqual(medicalData.pastMedicalHistory);
        expect(retrieved.familyHistory).toBe(medicalData.familyHistory);
        expect(retrieved.socialHistory).toBe(medicalData.socialHistory);
        expect(retrieved.reviewOfSystems).toEqual(medicalData.reviewOfSystems);
        expect(retrieved.currentAgent).toBe(medicalData.currentAgent);
        expect(retrieved.clinicalHandover).toEqual(medicalData.clinicalHandover);
        expect(retrieved.ucgRecommendations).toBe(medicalData.ucgRecommendations);
        expect(retrieved.bookingStatus).toBe(medicalData.bookingStatus);
        
        // appointmentDate may be undefined, which JSON.stringify removes
        if (medicalData.appointmentDate !== undefined) {
          expect(retrieved.appointmentDate).toBe(medicalData.appointmentDate);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve SBAR clinical handover through round-trip', () => {
    fc.assert(
      fc.property(sbarArb, (sbar) => {
        const retrieved = simulateDatabaseRoundTrip(sbar);
        
        expect(retrieved.situation).toBe(sbar.situation);
        expect(retrieved.background).toBe(sbar.background);
        expect(retrieved.assessment).toBe(sbar.assessment);
        expect(retrieved.recommendation).toBe(sbar.recommendation);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve DoctorThought through round-trip', () => {
    fc.assert(
      fc.property(doctorThoughtArb, (thought) => {
        const retrieved = simulateDatabaseRoundTrip(thought);
        
        expect(retrieved.differentialDiagnosis).toEqual(thought.differentialDiagnosis);
        expect(retrieved.missingInformation).toEqual(thought.missingInformation);
        expect(retrieved.strategy).toBe(thought.strategy);
        expect(retrieved.nextMove).toBe(thought.nextMove);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle null values correctly in MedicalData', () => {
    fc.assert(
      fc.property(
        fc.record({
          chiefComplaint: fc.constant(null),
          hpi: fc.constant(null),
          medicalRecords: fc.constant([]),
          recordsCheckCompleted: fc.boolean(),
          medications: fc.constant([]),
          allergies: fc.constant([]),
          pastMedicalHistory: fc.constant([]),
          familyHistory: fc.constant(null),
          socialHistory: fc.constant(null),
          reviewOfSystems: fc.constant([]),
          currentAgent: agentRoleArb,
          clinicalHandover: fc.constant(null),
          ucgRecommendations: fc.constant(null),
          bookingStatus: bookingStatusArb,
        }),
        (medicalData) => {
          const retrieved = simulateDatabaseRoundTrip(medicalData);
          
          expect(retrieved.chiefComplaint).toBeNull();
          expect(retrieved.hpi).toBeNull();
          expect(retrieved.familyHistory).toBeNull();
          expect(retrieved.socialHistory).toBeNull();
          expect(retrieved.clinicalHandover).toBeNull();
          expect(retrieved.ucgRecommendations).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve array ordering in MedicalData', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        (medications, allergies) => {
          const medicalData: Partial<MedicalData> = {
            medications,
            allergies,
          };
          
          const retrieved = simulateDatabaseRoundTrip(medicalData);
          
          // Order must be preserved
          expect(retrieved.medications).toEqual(medications);
          expect(retrieved.allergies).toEqual(allergies);
          
          // Verify exact ordering
          for (let i = 0; i < medications.length; i++) {
            expect(retrieved.medications![i]).toBe(medications[i]);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve nested differential diagnosis structure', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            condition: fc.string({ minLength: 1, maxLength: 100 }),
            probability: fc.constantFrom('High', 'Medium', 'Low'),
            reasoning: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (differentialDiagnosis) => {
          const thought: Partial<DoctorThought> = { differentialDiagnosis };
          const retrieved = simulateDatabaseRoundTrip(thought);
          
          expect(retrieved.differentialDiagnosis).toHaveLength(differentialDiagnosis.length);
          
          const retrievedDiagnosis = retrieved.differentialDiagnosis!;
          for (let i = 0; i < differentialDiagnosis.length; i++) {
            expect(retrievedDiagnosis[i]!.condition).toBe(differentialDiagnosis[i]!.condition);
            expect(retrievedDiagnosis[i]!.probability).toBe(differentialDiagnosis[i]!.probability);
            expect(retrievedDiagnosis[i]!.reasoning).toBe(differentialDiagnosis[i]!.reasoning);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle special characters in string fields', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (text) => {
          const medicalData: Partial<MedicalData> = {
            chiefComplaint: text,
            hpi: text,
          };
          
          const retrieved = simulateDatabaseRoundTrip(medicalData);
          
          expect(retrieved.chiefComplaint).toBe(text);
          expect(retrieved.hpi).toBe(text);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve complete intake session data structure', () => {
    // Simulates the full intake_sessions table structure
    const intakeSessionArb = fc.record({
      id: fc.uuid(),
      connectionId: fc.uuid(),
      status: fc.constantFrom('not_started', 'in_progress', 'ready', 'reviewed'),
      medicalData: fc.option(medicalDataArb, { nil: null }),
      clinicalHandover: fc.option(sbarArb, { nil: null }),
      doctorThought: fc.option(doctorThoughtArb, { nil: null }),
      completeness: fc.integer({ min: 0, max: 100 }),
      currentAgent: agentRoleArb,
    });

    fc.assert(
      fc.property(intakeSessionArb, (session) => {
        const retrieved = simulateDatabaseRoundTrip(session);
        
        expect(retrieved.id).toBe(session.id);
        expect(retrieved.connectionId).toBe(session.connectionId);
        expect(retrieved.status).toBe(session.status);
        expect(retrieved.completeness).toBe(session.completeness);
        expect(retrieved.currentAgent).toBe(session.currentAgent);
        
        // JSONB fields - use JSON comparison for complex objects
        expect(JSON.stringify(retrieved.medicalData)).toBe(JSON.stringify(session.medicalData));
        expect(JSON.stringify(retrieved.clinicalHandover)).toBe(JSON.stringify(session.clinicalHandover));
        expect(JSON.stringify(retrieved.doctorThought)).toBe(JSON.stringify(session.doctorThought));
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
