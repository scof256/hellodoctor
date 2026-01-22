/**
 * Property-Based Test: VitalsTriageAgent Greeting Recognition
 * 
 * Feature: a2a-protocol-progression-fix
 * Property 7: VitalsTriageAgent Greeting Recognition
 * 
 * For any common greeting input (hi, hello, hey, good morning, etc.) when patientName is null,
 * the VitalsTriageAgent should respond with a welcoming message and ask for the patient's name,
 * not treat the greeting as medical information.
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { determineAgent } from '../../app/lib/agent-router';
import type { MedicalData, AgentRole } from '../../app/types';

describe('Property 7: VitalsTriageAgent Greeting Recognition', () => {
  // Common greetings that should be recognized
  const commonGreetings = [
    'hi',
    'hello',
    'hey',
    'good morning',
    'good afternoon',
    'good evening',
    'hi there',
    'hello there',
    'hey there',
    'greetings',
    'howdy',
    'yo',
    'sup',
    "what's up",
    'hiya',
  ];

  it('should route to VitalsTriageAgent when patientName is null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...commonGreetings),
        (greeting) => {
          // Create medical data with no patient name (initial state)
          const medicalData: MedicalData = {
            vitalsData: {
              patientName: null, // No name yet
              patientAge: null,
              patientGender: null,
              vitalsCollected: false,
              temperature: {
                value: null,
                unit: 'celsius',
                collectedAt: null,
              },
              weight: {
                value: null,
                unit: 'kg',
                collectedAt: null,
              },
              bloodPressure: {
                systolic: null,
                diastolic: null,
                collectedAt: null,
              },
              currentStatus: null,
              triageDecision: 'pending',
              triageReason: null,
              triageFactors: [],
              vitalsStageCompleted: false, // Vitals stage not completed
            },
            chiefComplaint: null,
            hpi: null,
            medicalRecords: [],
            recordsCheckCompleted: false,
            historyCheckCompleted: false,
            medications: [],
            allergies: [],
            pastMedicalHistory: [],
            familyHistory: null,
            socialHistory: null,
            reviewOfSystems: [],
            currentAgent: 'VitalsTriageAgent' as AgentRole,
            clinicalHandover: null,
            ucgRecommendations: null,
            bookingStatus: 'collecting',
          };

          const agent = determineAgent(medicalData);

          // Should route to VitalsTriageAgent to collect name
          expect(agent).toBe('VitalsTriageAgent');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not treat greetings as chief complaints', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...commonGreetings),
        (greeting) => {
          // Medical data after greeting (should not have chief complaint set)
          const medicalData: MedicalData = {
            vitalsData: {
              patientName: null,
              patientAge: null,
              patientGender: null,
              vitalsCollected: false,
              temperature: {
                value: null,
                unit: 'celsius',
                collectedAt: null,
              },
              weight: {
                value: null,
                unit: 'kg',
                collectedAt: null,
              },
              bloodPressure: {
                systolic: null,
                diastolic: null,
                collectedAt: null,
              },
              currentStatus: null,
              triageDecision: 'pending',
              triageReason: null,
              triageFactors: [],
              vitalsStageCompleted: false,
            },
            chiefComplaint: null, // Greeting should NOT set chief complaint
            hpi: null,
            medicalRecords: [],
            recordsCheckCompleted: false,
            historyCheckCompleted: false,
            medications: [],
            allergies: [],
            pastMedicalHistory: [],
            familyHistory: null,
            socialHistory: null,
            reviewOfSystems: [],
            currentAgent: 'VitalsTriageAgent' as AgentRole,
            clinicalHandover: null,
            ucgRecommendations: null,
            bookingStatus: 'collecting',
          };

          // Chief complaint should remain null after greeting
          expect(medicalData.chiefComplaint).toBeNull();
          
          // Should still be in VitalsTriageAgent stage
          const agent = determineAgent(medicalData);
          expect(agent).toBe('VitalsTriageAgent');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prioritize name collection over other data when patientName is null', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...commonGreetings),
        fc.integer({ min: 18, max: 100 }), // Random age
        fc.constantFrom('male', 'female', 'other', 'prefer_not_to_say'), // Random gender
        (greeting, age, gender) => {
          // Even if other data is present, should still ask for name first
          const medicalData: MedicalData = {
            vitalsData: {
              patientName: null, // No name - this is the priority
              patientAge: age, // Age might be present
              patientGender: gender, // Gender might be present
              vitalsCollected: false,
              temperature: {
                value: null,
                unit: 'celsius',
                collectedAt: null,
              },
              weight: {
                value: null,
                unit: 'kg',
                collectedAt: null,
              },
              bloodPressure: {
                systolic: null,
                diastolic: null,
                collectedAt: null,
              },
              currentStatus: null,
              triageDecision: 'pending',
              triageReason: null,
              triageFactors: [],
              vitalsStageCompleted: false,
            },
            chiefComplaint: null,
            hpi: null,
            medicalRecords: [],
            recordsCheckCompleted: false,
            historyCheckCompleted: false,
            medications: [],
            allergies: [],
            pastMedicalHistory: [],
            familyHistory: null,
            socialHistory: null,
            reviewOfSystems: [],
            currentAgent: 'VitalsTriageAgent' as AgentRole,
            clinicalHandover: null,
            ucgRecommendations: null,
            bookingStatus: 'collecting',
          };

          const agent = determineAgent(medicalData);

          // Should still route to VitalsTriageAgent to get name first
          expect(agent).toBe('VitalsTriageAgent');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should move past VitalsTriageAgent only after vitalsStageCompleted is true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...commonGreetings),
        fc.string({ minLength: 1, maxLength: 50 }), // Random name
        (greeting, name) => {
          // Medical data with name but vitals stage not completed
          const medicalData: MedicalData = {
            vitalsData: {
              patientName: name, // Name is present
              patientAge: 25,
              patientGender: 'male',
              vitalsCollected: false,
              temperature: {
                value: null,
                unit: 'celsius',
                collectedAt: null,
              },
              weight: {
                value: null,
                unit: 'kg',
                collectedAt: null,
              },
              bloodPressure: {
                systolic: null,
                diastolic: null,
                collectedAt: null,
              },
              currentStatus: null,
              triageDecision: 'pending',
              triageReason: null,
              triageFactors: [],
              vitalsStageCompleted: false, // Not completed yet
            },
            chiefComplaint: null,
            hpi: null,
            medicalRecords: [],
            recordsCheckCompleted: false,
            historyCheckCompleted: false,
            medications: [],
            allergies: [],
            pastMedicalHistory: [],
            familyHistory: null,
            socialHistory: null,
            reviewOfSystems: [],
            currentAgent: 'VitalsTriageAgent' as AgentRole,
            clinicalHandover: null,
            ucgRecommendations: null,
            bookingStatus: 'collecting',
          };

          const agent = determineAgent(medicalData);

          // Should still be in VitalsTriageAgent until stage is completed
          expect(agent).toBe('VitalsTriageAgent');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should transition to Triage agent after vitalsStageCompleted is true', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // Random name
        (name) => {
          // Medical data with vitals stage completed
          const medicalData: MedicalData = {
            vitalsData: {
              patientName: name,
              patientAge: 25,
              patientGender: 'male',
              vitalsCollected: true,
              temperature: {
                value: 37,
                unit: 'celsius',
                collectedAt: new Date().toISOString(),
              },
              weight: {
                value: 70,
                unit: 'kg',
                collectedAt: new Date().toISOString(),
              },
              bloodPressure: {
                systolic: 120,
                diastolic: 80,
                collectedAt: new Date().toISOString(),
              },
              currentStatus: 'Feeling unwell',
              triageDecision: 'normal',
              triageReason: 'Normal vitals',
              triageFactors: [],
              vitalsStageCompleted: true, // Stage completed
            },
            chiefComplaint: null, // No chief complaint yet
            hpi: null,
            medicalRecords: [],
            recordsCheckCompleted: false,
            historyCheckCompleted: false,
            medications: [],
            allergies: [],
            pastMedicalHistory: [],
            familyHistory: null,
            socialHistory: null,
            reviewOfSystems: [],
            currentAgent: 'VitalsTriageAgent' as AgentRole,
            clinicalHandover: null,
            ucgRecommendations: null,
            bookingStatus: 'collecting',
          };

          const agent = determineAgent(medicalData);

          // Should transition to Triage to collect chief complaint
          expect(agent).toBe('Triage');
        }
      ),
      { numRuns: 100 }
    );
  });
});
