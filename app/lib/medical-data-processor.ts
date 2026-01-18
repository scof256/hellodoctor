import { MedicalData, AgentRole } from '../types';
import { determineAgent } from './agent-router';

/**
 * Reliable medical data merging function that preserves existing data
 * and ensures currentAgent is set correctly after updates.
 */
export function mergeMedicalData(
  currentData: MedicalData,
  updates: Partial<MedicalData>,
  activeAgent?: AgentRole
): MedicalData {
  // Merge arrays by combining and deduplicating
  const mergeArrays = <T>(current: T[], updates?: T[]): T[] => {
    if (!updates || updates.length === 0) return current;
    return [...new Set([...current, ...updates])];
  };

  // Merge string fields, preserving existing non-null values and only accepting non-null updates
  const mergeString = (current: string | null, update?: string | null): string | null => {
    // If update is null or undefined, preserve the current value
    if (update === null || update === undefined) {
      return current;
    }
    
    // If update is a non-empty string, use it
    if (typeof update === 'string' && update.trim().length > 0) {
      return update;
    }
    
    // If update is an empty string and current is non-null, preserve current
    if (current !== null && update.trim().length === 0) {
      return current;
    }
    
    // Otherwise use the update (handles case where current is null and update is empty string)
    return update;
  };

  // Create merged data
  const mergedData: MedicalData = {
    ...currentData,
    chiefComplaint: mergeString(currentData.chiefComplaint, updates.chiefComplaint),
    hpi: mergeString(currentData.hpi, updates.hpi),
    familyHistory: mergeString(currentData.familyHistory, updates.familyHistory),
    socialHistory: mergeString(currentData.socialHistory, updates.socialHistory),
    ucgRecommendations: mergeString(currentData.ucgRecommendations, updates.ucgRecommendations),
    
    // Array fields - merge and deduplicate
    medicalRecords: mergeArrays(currentData.medicalRecords, updates.medicalRecords),
    medications: mergeArrays(currentData.medications, updates.medications),
    allergies: mergeArrays(currentData.allergies, updates.allergies),
    pastMedicalHistory: mergeArrays(currentData.pastMedicalHistory, updates.pastMedicalHistory),
    reviewOfSystems: mergeArrays(currentData.reviewOfSystems, updates.reviewOfSystems),
    
    // Boolean fields - prefer explicit updates
    recordsCheckCompleted: updates.recordsCheckCompleted !== undefined 
      ? updates.recordsCheckCompleted 
      : currentData.recordsCheckCompleted,

    historyCheckCompleted: (currentData.historyCheckCompleted ?? false) || (updates.historyCheckCompleted ?? false),
    
    // Object fields - prefer updates if provided
    clinicalHandover: updates.clinicalHandover || currentData.clinicalHandover,
    
    // Booking status - prefer updates
    bookingStatus: updates.bookingStatus || currentData.bookingStatus,
    appointmentDate: updates.appointmentDate || currentData.appointmentDate,
    
    // Current agent - temporarily set to current, will be determined below
    currentAgent: currentData.currentAgent
  };

  // Determine the correct agent based on the merged data state
  // Only use explicit activeAgent or updates.currentAgent if provided
  const finalAgent = activeAgent || updates.currentAgent || determineAgent(mergedData);
  mergedData.currentAgent = finalAgent;

  return mergedData;
}

/**
 * Validate medical data consistency
 */
export function validateMedicalData(data: MedicalData, allowExplicitAgent: boolean = false): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check agent consistency with data state (unless explicitly allowed)
  if (!allowExplicitAgent) {
    const expectedAgent = determineAgent(data);
    if (data.currentAgent !== expectedAgent) {
      errors.push(`Current agent ${data.currentAgent} doesn't match expected agent ${expectedAgent} for data state`);
    }
  }

  // Check booking status consistency
  if (data.bookingStatus === 'ready') {
    if (!data.chiefComplaint) {
      errors.push('Booking ready but missing chief complaint');
    }
    if (!data.hpi || data.hpi.length < 50) {
      errors.push('Booking ready but HPI is incomplete');
    }
    if (!data.recordsCheckCompleted) {
      errors.push('Booking ready but records check not completed');
    }
  }

  // Check data type consistency
  if (data.chiefComplaint !== null && typeof data.chiefComplaint !== 'string') {
    errors.push('Chief complaint must be string or null');
  }
  
  if (!Array.isArray(data.medications)) {
    errors.push('Medications must be an array');
  }
  
  if (!Array.isArray(data.allergies)) {
    errors.push('Allergies must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if medical data has sensitive information that affects routing
 */
export function hasSensitiveData(data: MedicalData): boolean {
  const sensitiveKeywords = [
    'suicide', 'self-harm', 'overdose', 'abuse', 'assault', 
    'chest pain', 'shortness of breath', 'severe pain',
    'bleeding', 'unconscious', 'emergency'
  ];

  const textFields = [
    data.chiefComplaint,
    data.hpi,
    data.familyHistory,
    data.socialHistory,
    ...data.medicalRecords,
    ...data.pastMedicalHistory,
    ...data.reviewOfSystems
  ].filter(Boolean);

  return textFields.some(text => 
    sensitiveKeywords.some(keyword => 
      text!.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}