import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  mergeMedicalData, 
  validateMedicalData, 
  hasSensitiveData 
} from '../../app/lib/medical-data-processor';
import { determineAgent } from '../../app/lib/agent-router';
import { MedicalData, INITIAL_MEDICAL_DATA, AgentRole, VALID_AGENT_ROLES } from '../../app/types';

// Arbitraries for property testing
const arbitraryAgentRole = fc.constantFrom(...VALID_AGENT_ROLES);

const arbitraryMedicalData = fc.record({
  chiefComplaint: fc.option(fc.string(), { nil: null }),
  hpi: fc.option(fc.string(), { nil: null }),
  medicalRecords: fc.array(fc.string()),
  recordsCheckCompleted: fc.boolean(),
  medications: fc.array(fc.string()),
  allergies: fc.array(fc.string()),
  pastMedicalHistory: fc.array(fc.string()),
  familyHistory: fc.option(fc.string(), { nil: null }),
  socialHistory: fc.option(fc.string(), { nil: null }),
  reviewOfSystems: fc.array(fc.string()),
  currentAgent: arbitraryAgentRole,
  clinicalHandover: fc.constant(null), // Simplified for testing
  ucgRecommendations: fc.option(fc.string(), { nil: null }),
  bookingStatus: fc.constantFrom('collecting', 'ready', 'booked'),
  appointmentDate: fc.option(fc.string(), { nil: undefined })
}) as fc.Arbitrary<MedicalData>;

const arbitraryPartialMedicalData = fc.record({
  chiefComplaint: fc.option(fc.option(fc.string(), { nil: null })),
  hpi: fc.option(fc.option(fc.string(), { nil: null })),
  medicalRecords: fc.option(fc.array(fc.string())),
  recordsCheckCompleted: fc.option(fc.boolean()),
  medications: fc.option(fc.array(fc.string())),
  allergies: fc.option(fc.array(fc.string())),
  pastMedicalHistory: fc.option(fc.array(fc.string())),
  familyHistory: fc.option(fc.option(fc.string(), { nil: null })),
  socialHistory: fc.option(fc.option(fc.string(), { nil: null })),
  reviewOfSystems: fc.option(fc.array(fc.string())),
  currentAgent: fc.option(arbitraryAgentRole),
  clinicalHandover: fc.option(fc.constant(null)),
  ucgRecommendations: fc.option(fc.option(fc.string(), { nil: null })),
  bookingStatus: fc.option(fc.constantFrom('collecting', 'ready', 'booked')),
  appointmentDate: fc.option(fc.option(fc.string(), { nil: undefined }))
}, { requiredKeys: [] }) as fc.Arbitrary<Partial<MedicalData>>;

describe('Medical Data Processing Properties', () => {
  describe('Property 4: Medical Data Merge Preservation', () => {
    it('should preserve all existing non-null data when merging with empty updates', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (originalData) => {
          const merged = mergeMedicalData(originalData, {});
          
          // All original non-null/non-empty values should be preserved
          expect(merged.chiefComplaint).toBe(originalData.chiefComplaint);
          expect(merged.hpi).toBe(originalData.hpi);
          expect(merged.familyHistory).toBe(originalData.familyHistory);
          expect(merged.socialHistory).toBe(originalData.socialHistory);
          expect(merged.recordsCheckCompleted).toBe(originalData.recordsCheckCompleted);
          expect(merged.bookingStatus).toBe(originalData.bookingStatus);
          
          // Arrays should be identical
          expect(merged.medicalRecords).toEqual(originalData.medicalRecords);
          expect(merged.medications).toEqual(originalData.medications);
          expect(merged.allergies).toEqual(originalData.allergies);
          expect(merged.pastMedicalHistory).toEqual(originalData.pastMedicalHistory);
          expect(merged.reviewOfSystems).toEqual(originalData.reviewOfSystems);
        }
      ));
    });

    it('should merge arrays without losing existing data', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        arbitraryPartialMedicalData,
        (originalData, updates) => {
          const merged = mergeMedicalData(originalData, updates);
          
          // Original array items should still be present
          if (updates.medications) {
            originalData.medications.forEach(med => {
              expect(merged.medications).toContain(med);
            });
            updates.medications.forEach(med => {
              expect(merged.medications).toContain(med);
            });
          }
          
          if (updates.allergies) {
            originalData.allergies.forEach(allergy => {
              expect(merged.allergies).toContain(allergy);
            });
            updates.allergies.forEach(allergy => {
              expect(merged.allergies).toContain(allergy);
            });
          }
          
          if (updates.pastMedicalHistory) {
            originalData.pastMedicalHistory.forEach(history => {
              expect(merged.pastMedicalHistory).toContain(history);
            });
            updates.pastMedicalHistory.forEach(history => {
              expect(merged.pastMedicalHistory).toContain(history);
            });
          }
        }
      ));
    });

    it('should not create duplicate entries in arrays', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        fc.array(fc.string()),
        (originalData, newMedications) => {
          const updates = { medications: [...originalData.medications, ...newMedications] };
          const merged = mergeMedicalData(originalData, updates);
          
          // Check for duplicates
          const uniqueMeds = [...new Set(merged.medications)];
          expect(merged.medications).toEqual(uniqueMeds);
        }
      ));
    });

    it('should not overwrite existing non-null values with null updates', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (originalData) => {
          // Create updates that try to overwrite non-null values with null
          const nullUpdates: Partial<MedicalData> = {};
          
          if (originalData.chiefComplaint) {
            nullUpdates.chiefComplaint = null;
          }
          if (originalData.hpi) {
            nullUpdates.hpi = null;
          }
          if (originalData.familyHistory) {
            nullUpdates.familyHistory = null;
          }
          if (originalData.socialHistory) {
            nullUpdates.socialHistory = null;
          }
          
          const merged = mergeMedicalData(originalData, nullUpdates);
          
          // Original non-null values should be preserved
          if (originalData.chiefComplaint) {
            expect(merged.chiefComplaint).toBe(originalData.chiefComplaint);
          }
          if (originalData.hpi) {
            expect(merged.hpi).toBe(originalData.hpi);
          }
          if (originalData.familyHistory) {
            expect(merged.familyHistory).toBe(originalData.familyHistory);
          }
          if (originalData.socialHistory) {
            expect(merged.socialHistory).toBe(originalData.socialHistory);
          }
        }
      ));
    });

    it('should correctly set currentAgent based on data state when not explicitly provided', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        arbitraryPartialMedicalData,
        (originalData, updates) => {
          // Don't provide explicit currentAgent in updates
          const updatesWithoutAgent = { ...updates };
          delete updatesWithoutAgent.currentAgent;
          
          // Filter out null updates that would overwrite existing non-null values
          // This aligns with the property: "preserve all existing non-null values"
          const filteredUpdates = Object.fromEntries(
            Object.entries(updatesWithoutAgent).filter(([key, value]) => {
              // Keep the update if:
              // 1. The original value is null/undefined (so we can set it)
              // 2. The update value is not null (so we're not overwriting with null)
              // 3. For arrays, always keep them (they get merged, not overwritten)
              const originalValue = originalData[key as keyof MedicalData];
              return originalValue == null || 
                     value != null || 
                     Array.isArray(value);
            })
          );
          
          const merged = mergeMedicalData(originalData, filteredUpdates);
          const expectedAgent = determineAgent(merged);
          
          expect(merged.currentAgent).toBe(expectedAgent);
        }
      ));
    });
  });

  describe('Property 5: Agent Routing Data Sensitivity', () => {
    it('should detect sensitive data correctly', () => {
      const sensitiveData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'I have chest pain and shortness of breath',
        hpi: 'The pain started suddenly and is severe'
      };
      
      expect(hasSensitiveData(sensitiveData)).toBe(true);
    });

    it('should not flag normal data as sensitive', () => {
      const normalData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'I have a headache',
        hpi: 'It started this morning and is mild'
      };
      
      expect(hasSensitiveData(normalData)).toBe(false);
    });

    it('should handle case-insensitive sensitive keyword detection', () => {
      fc.assert(fc.property(
        fc.constantFrom('CHEST PAIN', 'Suicide', 'OVERDOSE', 'self-harm'),
        (sensitiveKeyword) => {
          const data: MedicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint: `Patient reports ${sensitiveKeyword}`
          };
          
          expect(hasSensitiveData(data)).toBe(true);
        }
      ));
    });

    it('should maintain agent routing consistency after data updates', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        arbitraryPartialMedicalData,
        (originalData, updates) => {
          const merged = mergeMedicalData(originalData, updates);
          
          // If currentAgent was explicitly provided in updates, allow it
          const allowExplicitAgent = updates.currentAgent !== undefined;
          const validation = validateMedicalData(merged, allowExplicitAgent);
          
          // If validation fails due to agent inconsistency, 
          // the merge function should have set the correct agent
          if (!validation.isValid) {
            const agentErrors = validation.errors.filter(e => 
              e.includes('Current agent') && e.includes("doesn't match expected agent")
            );
            expect(agentErrors).toHaveLength(0);
          }
        }
      ));
    });

    it('should preserve data integrity during sensitive data processing', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (data) => {
          const isSensitive = hasSensitiveData(data);
          
          // Sensitive data detection should not modify the original data
          expect(data.chiefComplaint).toBeDefined();
          expect(data.hpi).toBeDefined();
          expect(Array.isArray(data.medications)).toBe(true);
          expect(Array.isArray(data.allergies)).toBe(true);
          expect(Array.isArray(data.pastMedicalHistory)).toBe(true);
          
          // The function should be deterministic
          expect(hasSensitiveData(data)).toBe(isSensitive);
        }
      ));
    });
  });

  describe('Data Validation Properties', () => {
    it('should validate consistent agent-data relationships', () => {
      fc.assert(fc.property(
        arbitraryMedicalData,
        (data) => {
          const expectedAgent = determineAgent(data);
          const consistentData = { ...data, currentAgent: expectedAgent };
          const validation = validateMedicalData(consistentData);
          
          const agentErrors = validation.errors.filter(e => 
            e.includes('Current agent') && e.includes("doesn't match expected agent")
          );
          expect(agentErrors).toHaveLength(0);
        }
      ));
    });

    it('should validate booking status consistency', () => {
      const readyData: MedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Test complaint',
        hpi: 'This is a detailed history of present illness that is longer than 50 characters',
        recordsCheckCompleted: true,
        medications: ['Test medication'],
        bookingStatus: 'ready'
      };
      
      const validation = validateMedicalData(readyData);
      const bookingErrors = validation.errors.filter(e => 
        e.includes('Booking ready but')
      );
      expect(bookingErrors).toHaveLength(0);
    });
  });
});