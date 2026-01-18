import { AgentRole, MedicalData, IntakeStage } from '../types';

/**
 * Simplified deterministic agent routing based on medical data state.
 * This replaces the complex orchestrator-based routing with simple conditional logic.
 */
export function determineAgent(medicalData: MedicalData): AgentRole {
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
  if (needsHistoryData(medicalData)) {
    return 'HistorySpecialist';
  }

  // Priority 5: HandoverSpecialist - All data present, ready for summary
  return 'HandoverSpecialist';
}

/**
 * Check if medical data needs history information
 */
function needsHistoryData(medicalData: MedicalData): boolean {
  const hasMedications = medicalData.medications.length > 0;
  const hasAllergies = medicalData.allergies.length > 0;
  const hasPastHistory = medicalData.pastMedicalHistory.length > 0;
  const historyCheckCompleted = medicalData.historyCheckCompleted ?? false;
  
  // If any history data is missing, route to HistorySpecialist
  // Note: Empty arrays are valid if patient explicitly said "none"
  return !historyCheckCompleted && !hasMedications && !hasAllergies && !hasPastHistory;
}

/**
 * Check if medical data is complete for handover
 */
function hasCompleteData(medicalData: MedicalData): boolean {
  return (
    !!medicalData.chiefComplaint &&
    !!medicalData.hpi &&
    medicalData.hpi.length >= 50 &&
    medicalData.recordsCheckCompleted &&
    !needsHistoryData(medicalData)
  );
}

/**
 * Map agent role to UI intake stage
 */
export function agentToStage(agent: AgentRole): IntakeStage {
  const agentStageMap: Record<AgentRole, IntakeStage> = {
    'Triage': 'triage',
    'ClinicalInvestigator': 'investigation',
    'RecordsClerk': 'records',
    'HistorySpecialist': 'profile',
    'HandoverSpecialist': 'summary'
  };
  
  return agentStageMap[agent];
}

/**
 * Calculate completeness percentage based on medical data
 */
export function calculateCompleteness(medicalData: MedicalData): number {
  const fields: (keyof MedicalData)[] = [
    'chiefComplaint', 'hpi', 'medications', 'allergies', 
    'pastMedicalHistory', 'familyHistory', 'socialHistory'
  ];
  
  let filled = 0;
  fields.forEach(field => {
    const val = medicalData[field];
    if (Array.isArray(val)) {
      // Only count arrays with non-empty, non-whitespace strings
      if (val.length > 0 && val.some(item => typeof item === 'string' && item.trim().length > 0)) {
        filled++;
      }
    } else {
      // Only count non-null, non-empty, non-whitespace strings
      if (val && typeof val === 'string' && val.trim().length > 0) {
        filled++;
      }
    }
  });
  
  if (medicalData.recordsCheckCompleted) filled += 0.5;
  
  return Math.min(100, Math.round((filled / fields.length) * 100));
}

/**
 * Calculate UI stage based on medical data state
 * This ensures UI stage stays synchronized with currentAgent
 */
export function calculateStageFromData(medicalData: MedicalData): IntakeStage {
  // Use the currentAgent from medical data to determine stage
  // This ensures UI synchronization with the agent routing logic
  return agentToStage(medicalData.currentAgent);
}

/**
 * Calculate stage and completeness for UI display
 * This replaces the inline logic scattered across UI components
 */
export function calculateUIState(medicalData: MedicalData): { stage: IntakeStage; completeness: number } {
  const stage = calculateStageFromData(medicalData);
  const completeness = calculateCompleteness(medicalData);
  
  return { stage, completeness };
}

/**
 * Agent routing priority matrix for testing and validation
 */
export const ROUTING_PRIORITY = {
  'Triage': (data: MedicalData) => !data.chiefComplaint,
  'ClinicalInvestigator': (data: MedicalData) => 
    data.chiefComplaint && (!data.hpi || data.hpi.length < 50),
  'RecordsClerk': (data: MedicalData) => 
    data.hpi && data.hpi.length >= 50 && !data.recordsCheckCompleted,
  'HistorySpecialist': (data: MedicalData) => 
    data.recordsCheckCompleted && needsHistoryData(data),
  'HandoverSpecialist': (data: MedicalData) => 
    hasCompleteData(data)
} as const;