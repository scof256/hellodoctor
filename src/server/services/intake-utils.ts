import type { MedicalData, AgentRole } from '@/types';

/**
 * Determine which agent should handle the current conversation state.
 * Uses priority-based deterministic routing as per the A2A protocol.
 * 
 * Priority Logic:
 * 0. VitalsTriageAgent: if vitalsStageCompleted is false
 * 1. Triage: if chiefComplaint is null
 * 2. ClinicalInvestigator: if HPI is incomplete (< 50 chars)
 * 3. RecordsClerk: if recordsCheckCompleted is false
 * 4. HistorySpecialist: if medications/allergies/history is missing
 * 5. HandoverSpecialist: if all data is present
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 9.1, 9.2, 9.3, 9.4
 */
export function determineAgent(medicalData: MedicalData): AgentRole {
  // Priority 0: VitalsTriageAgent - No vitals stage completed yet
  if (!medicalData.vitalsData?.vitalsStageCompleted) {
    return 'VitalsTriageAgent';
  }

  // Priority 1: Triage - No chief complaint yet
  if (!medicalData.chiefComplaint || medicalData.chiefComplaint.trim().length === 0) {
    return 'Triage';
  }

  // Priority 2: ClinicalInvestigator - HPI is incomplete
  // HPI is considered incomplete if it's missing or very short (< 50 chars)
  const hpiLength = medicalData.hpi?.trim().length ?? 0;
  if (hpiLength < 50) {
    return 'ClinicalInvestigator';
  }

  // Priority 3: RecordsClerk - Records check not completed
  if (!medicalData.recordsCheckCompleted) {
    return 'RecordsClerk';
  }

  // Priority 4: HistorySpecialist - Missing medications, allergies, or history
  const hasMedications = medicalData.medications.length > 0;
  const hasAllergies = medicalData.allergies.length > 0;
  const hasPastHistory = medicalData.pastMedicalHistory.length > 0;
  const historyCheckCompleted = medicalData.historyCheckCompleted ?? false;
  
  // If all history data is missing AND we haven't explicitly completed history,
  // route to HistorySpecialist. This prevents looping when the patient says "none"
  // (arrays remain empty but historyCheckCompleted becomes true).
  if (!historyCheckCompleted && !hasMedications && !hasAllergies && !hasPastHistory) {
    return 'HistorySpecialist';
  }

  // Priority 5: HandoverSpecialist - All data present, ready for summary
  return 'HandoverSpecialist';
}

/**
 * Calculate the completeness percentage of an intake session based on medical data.
 * 
 * The completeness is calculated based on the presence of key medical data fields:
 * - Chief Complaint (20%)
 * - HPI (20%)
 * - Medical Records Check (10%)
 * - Medications (10%)
 * - Allergies (10%)
 * - Past Medical History (10%)
 * - Family History (5%)
 * - Social History (5%)
 * - Clinical Handover (10%)
 * 
 * Requirements: 7.1, 7.6
 */
export function calculateIntakeCompleteness(medicalData: MedicalData | null): number {
  if (!medicalData) {
    return 0;
  }

  let completeness = 0;

  const historySatisfied =
    medicalData.recordsCheckCompleted || (medicalData.historyCheckCompleted ?? false);

  // Chief Complaint (20%)
  if (medicalData.chiefComplaint && medicalData.chiefComplaint.trim().length > 0) {
    completeness += 20;
  }

  // HPI - History of Present Illness (20%)
  if (medicalData.hpi && medicalData.hpi.trim().length > 0) {
    completeness += 20;
  }

  // Medical Records Check (10%)
  if (medicalData.recordsCheckCompleted) {
    completeness += 10;
  }

  // Medications (10%)
  // Either has medications listed OR explicitly checked (empty array after check is valid)
  if (medicalData.medications.length > 0 || historySatisfied) {
    completeness += 10;
  }

  // Allergies (10%)
  // Either has allergies listed OR explicitly checked
  if (medicalData.allergies.length > 0 || historySatisfied) {
    completeness += 10;
  }

  // Past Medical History (10%)
  if (medicalData.pastMedicalHistory.length > 0 || historySatisfied) {
    completeness += 10;
  }

  // Family History (5%)
  if (medicalData.familyHistory && medicalData.familyHistory.trim().length > 0) {
    completeness += 5;
  }

  // Social History (5%)
  if (medicalData.socialHistory && medicalData.socialHistory.trim().length > 0) {
    completeness += 5;
  }

  // Clinical Handover / SBAR (10%)
  if (medicalData.clinicalHandover) {
    completeness += 10;
  }

  return Math.min(completeness, 100);
}

/**
 * Determine if an intake session is ready for booking based on medical data.
 * 
 * An intake is considered ready when:
 * - Chief complaint is present
 * - HPI is present
 * - Records check is completed
 * - Booking status is 'ready'
 */
export function isIntakeReady(medicalData: MedicalData | null): boolean {
  if (!medicalData) {
    return false;
  }

  return (
    medicalData.bookingStatus === 'ready' ||
    (
      !!medicalData.chiefComplaint &&
      !!medicalData.hpi &&
      medicalData.recordsCheckCompleted &&
      !!medicalData.clinicalHandover
    )
  );
}

/**
 * Merge updated medical data from AI response with existing data.
 * Preserves existing non-null values and ensures currentAgent is set correctly.
 * Only updates fields that are present in the update.
 */
export function mergeMedicalData(
  existing: MedicalData,
  update: Partial<MedicalData>
): MedicalData {
  const mergeArrayOverwrite = <T>(current: T[], updates: unknown): T[] => {
    if (updates === undefined || updates === null) return current;
    if (!Array.isArray(updates)) return current;
    return updates as T[];
  };

  // Merge string fields, preserving existing non-null values and only accepting non-null updates
  const mergeString = (current: string | null, update?: string | null): string | null => {
    if (update === null || update === undefined) return current;
    return update;
  };

  // Merge vitalsData - deep merge to preserve existing values
  const mergeVitalsData = (
    current: MedicalData['vitalsData'],
    update?: Partial<MedicalData['vitalsData']>
  ): MedicalData['vitalsData'] => {
    if (!update) return current;
    
    return {
      patientName: update.patientName !== undefined ? update.patientName : current.patientName,
      patientAge: update.patientAge !== undefined ? update.patientAge : current.patientAge,
      patientGender: update.patientGender !== undefined ? update.patientGender : current.patientGender,
      temperature: update.temperature ? { ...current.temperature, ...update.temperature } : current.temperature,
      weight: update.weight ? { ...current.weight, ...update.weight } : current.weight,
      bloodPressure: update.bloodPressure ? { ...current.bloodPressure, ...update.bloodPressure } : current.bloodPressure,
      currentStatus: update.currentStatus !== undefined ? update.currentStatus : current.currentStatus,
      vitalsCollected: update.vitalsCollected !== undefined ? update.vitalsCollected : current.vitalsCollected,
      vitalsStageCompleted: update.vitalsStageCompleted !== undefined ? update.vitalsStageCompleted : current.vitalsStageCompleted,
      triageDecision: update.triageDecision !== undefined ? update.triageDecision : current.triageDecision,
      triageReason: update.triageReason !== undefined ? update.triageReason : current.triageReason,
      triageFactors: update.triageFactors !== undefined ? update.triageFactors : current.triageFactors,
    };
  };

  // Create merged data
  const mergedData: MedicalData = {
    chiefComplaint: mergeString(existing.chiefComplaint, update.chiefComplaint),
    hpi: mergeString(existing.hpi, update.hpi),
    familyHistory: mergeString(existing.familyHistory, update.familyHistory),
    socialHistory: mergeString(existing.socialHistory, update.socialHistory),
    ucgRecommendations: mergeString(existing.ucgRecommendations, update.ucgRecommendations),
    
    medicalRecords: mergeArrayOverwrite(existing.medicalRecords, update.medicalRecords),
    medications: mergeArrayOverwrite(existing.medications, update.medications),
    allergies: mergeArrayOverwrite(existing.allergies, update.allergies),
    pastMedicalHistory: mergeArrayOverwrite(existing.pastMedicalHistory, update.pastMedicalHistory),
    reviewOfSystems: mergeArrayOverwrite(existing.reviewOfSystems, update.reviewOfSystems),
    
    // Boolean fields - prefer explicit updates
    recordsCheckCompleted: update.recordsCheckCompleted !== undefined 
      ? update.recordsCheckCompleted 
      : existing.recordsCheckCompleted,

    historyCheckCompleted: (existing.historyCheckCompleted ?? false) || (update.historyCheckCompleted ?? false),
    
    // Object fields - prefer updates if provided
    clinicalHandover: update.clinicalHandover || existing.clinicalHandover,
    vitalsData: mergeVitalsData(existing.vitalsData, update.vitalsData),
    
    // Booking status - prefer updates
    bookingStatus: update.bookingStatus || existing.bookingStatus,
    appointmentDate: update.appointmentDate || existing.appointmentDate,
    
    currentAgent: update.currentAgent ?? existing.currentAgent
  };

  return mergedData;
}
