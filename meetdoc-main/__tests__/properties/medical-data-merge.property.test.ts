/**
 * Feature: nextjs-fullstack-conversion, Property 3: Medical Data Array Merge Preservation
 * 
 * For any existing MedicalData with array fields and any update containing new items,
 * merging SHALL result in a MedicalData object containing all original items plus all
 * new items (union with deduplication).
 * 
 * Validates: Requirements 11.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mergeMedicalData } from '@/app/lib/parse-utils';
import { MedicalData, INITIAL_MEDICAL_DATA } from '@/app/types';

// Arbitrary for string arrays (medications, allergies, etc.)
const stringArrayArb = fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 });

// Arbitrary for MedicalData with array fields
const medicalDataArb = fc.record({
  ...Object.fromEntries(
    Object.entries(INITIAL_MEDICAL_DATA).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, stringArrayArb];
      }
      if (typeof value === 'boolean') {
        return [key, fc.boolean()];
      }
      if (value === null) {
        return [key, fc.option(fc.string(), { nil: null })];
      }
      return [key, fc.constant(value)];
    })
  )
}) as fc.Arbitrary<MedicalData>;

// Arbitrary for partial update with array fields
const partialUpdateArb = fc.record({
  medications: fc.option(stringArrayArb, { nil: undefined }),
  allergies: fc.option(stringArrayArb, { nil: undefined }),
  pastMedicalHistory: fc.option(stringArrayArb, { nil: undefined }),
  medicalRecords: fc.option(stringArrayArb, { nil: undefined }),
  reviewOfSystems: fc.option(stringArrayArb, { nil: undefined })
});

describe('Property 3: Medical Data Array Merge Preservation', () => {
  it('merged arrays contain all items from both existing and update', () => {
    fc.assert(
      fc.property(
        stringArrayArb,
        stringArrayArb,
        (existingMeds, newMeds) => {
          const existing: MedicalData = {
            ...INITIAL_MEDICAL_DATA,
            medications: existingMeds
          };
          
          const update = { medications: newMeds };
          const merged = mergeMedicalData(existing, update);
          
          // All existing items should be present
          for (const med of existingMeds) {
            expect(merged.medications).toContain(med);
          }
          
          // All new items should be present
          for (const med of newMeds) {
            expect(merged.medications).toContain(med);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('merged arrays are deduplicated', () => {
    fc.assert(
      fc.property(
        stringArrayArb,
        (items) => {
          const existing: MedicalData = {
            ...INITIAL_MEDICAL_DATA,
            medications: items
          };
          
          // Update with same items (duplicates)
          const update = { medications: items };
          const merged = mergeMedicalData(existing, update);
          
          // Result should have no duplicates
          const uniqueItems = [...new Set(items)];
          expect(merged.medications.length).toBe(uniqueItems.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('non-array fields are overwritten, not merged', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (existingComplaint, newComplaint) => {
          const existing: MedicalData = {
            ...INITIAL_MEDICAL_DATA,
            chiefComplaint: existingComplaint
          };
          
          const update = { chiefComplaint: newComplaint };
          const merged = mergeMedicalData(existing, update);
          
          expect(merged.chiefComplaint).toBe(newComplaint);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('undefined update fields preserve existing values', () => {
    fc.assert(
      fc.property(
        stringArrayArb,
        (existingMeds) => {
          const existing: MedicalData = {
            ...INITIAL_MEDICAL_DATA,
            medications: existingMeds
          };
          
          // Update without medications field
          const update = { chiefComplaint: 'headache' };
          const merged = mergeMedicalData(existing, update);
          
          expect(merged.medications).toEqual(existingMeds);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all array fields are properly merged', () => {
    const arrayFields = ['medications', 'allergies', 'pastMedicalHistory', 'medicalRecords', 'reviewOfSystems'] as const;
    
    fc.assert(
      fc.property(
        partialUpdateArb,
        (update) => {
          const existing = { ...INITIAL_MEDICAL_DATA };
          const merged = mergeMedicalData(existing, update);
          
          for (const field of arrayFields) {
            if (update[field] !== undefined) {
              const existingArr = existing[field] as string[];
              const updateArr = update[field] as string[];
              const expectedUnion = [...new Set([...existingArr, ...updateArr])];
              
              expect((merged[field] as string[]).sort()).toEqual(expectedUnion.sort());
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
