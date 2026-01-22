/**
 * Triage Service
 * 
 * Analyzes patient vitals and symptoms to determine:
 * 1. Emergency conditions requiring immediate attention
 * 2. Complexity level to route to appropriate care pathway
 * 3. Triage decisions with rationale
 */

import type { VitalsData } from '@/app/types';

export interface EmergencyIndicator {
  type: 'temperature' | 'blood_pressure' | 'symptoms';
  value: string;
  threshold: string;
  message: string;
}

export interface EmergencyResult {
  isEmergency: boolean;
  indicators: EmergencyIndicator[];
  recommendations: string[];
  severity: 'critical' | 'urgent' | 'normal';
}

export interface ComplexityResult {
  isComplex: boolean;
  factors: string[];
  needsAgentAssistance: boolean;
}

export interface TriageResult {
  decision: 'agent-assisted' | 'direct-to-diagnosis' | 'emergency';
  reason: string;
  confidence: number; // 0-1
  factors: string[]; // List of factors that influenced decision
}

export interface TriageService {
  analyzeVitals(vitals: VitalsData): TriageResult;
  detectEmergency(vitals: VitalsData, symptoms?: string): EmergencyResult;
  evaluateComplexity(vitals: VitalsData, symptoms?: string): ComplexityResult;
}

// Emergency thresholds
const EMERGENCY_THRESHOLDS = {
  temperature: {
    high: { celsius: 39.5, fahrenheit: 103.1 },
    low: { celsius: 35.0, fahrenheit: 95.0 }
  },
  bloodPressure: {
    systolic: { high: 180, low: 90 },
    diastolic: { high: 120, low: 60 }
  },
  symptoms: {
    critical: [
      'severe chest pain',
      'chest pain',
      'difficulty breathing',
      'can\'t breathe',
      'cannot breathe',
      'loss of consciousness',
      'unconscious',
      'passed out',
      'severe bleeding',
      'bleeding heavily',
      'stroke symptoms',
      'stroke',
      'face drooping',
      'arm weakness',
      'speech difficulty',
      'severe allergic reaction',
      'anaphylaxis',
      'throat closing',
      'severe headache',
      'worst headache',
      'seizure',
      'convulsion'
    ]
  }
};

/**
 * Convert temperature to Celsius for consistent comparison
 */
function convertToCelsius(value: number, unit: 'celsius' | 'fahrenheit'): number {
  if (unit === 'fahrenheit') {
    return (value - 32) * 5 / 9;
  }
  return value;
}

/**
 * Check if temperature is in emergency range
 */
function checkTemperatureEmergency(
  temperature: { value: number | null; unit: string }
): EmergencyIndicator | null {
  if (temperature.value === null) {
    return null;
  }

  const tempCelsius = convertToCelsius(temperature.value, temperature.unit as 'celsius' | 'fahrenheit');
  const thresholds = EMERGENCY_THRESHOLDS.temperature;

  if (tempCelsius > thresholds.high.celsius) {
    return {
      type: 'temperature',
      value: `${temperature.value}°${temperature.unit === 'celsius' ? 'C' : 'F'}`,
      threshold: `>${thresholds.high.celsius}°C (${thresholds.high.fahrenheit}°F)`,
      message: 'Dangerously high temperature detected'
    };
  }

  if (tempCelsius < thresholds.low.celsius) {
    return {
      type: 'temperature',
      value: `${temperature.value}°${temperature.unit === 'celsius' ? 'C' : 'F'}`,
      threshold: `<${thresholds.low.celsius}°C (${thresholds.low.fahrenheit}°F)`,
      message: 'Dangerously low temperature detected (hypothermia risk)'
    };
  }

  return null;
}

/**
 * Check if blood pressure is in emergency range
 */
function checkBloodPressureEmergency(
  bloodPressure: { systolic: number | null; diastolic: number | null }
): EmergencyIndicator | null {
  if (bloodPressure.systolic === null && bloodPressure.diastolic === null) {
    return null;
  }

  const thresholds = EMERGENCY_THRESHOLDS.bloodPressure;
  const systolic = bloodPressure.systolic;
  const diastolic = bloodPressure.diastolic;

  // Check systolic
  if (systolic !== null) {
    if (systolic > thresholds.systolic.high) {
      return {
        type: 'blood_pressure',
        value: `${systolic}/${diastolic ?? '?'} mmHg`,
        threshold: `Systolic >${thresholds.systolic.high} mmHg`,
        message: 'Dangerously high blood pressure (hypertensive crisis)'
      };
    }

    if (systolic < thresholds.systolic.low) {
      return {
        type: 'blood_pressure',
        value: `${systolic}/${diastolic ?? '?'} mmHg`,
        threshold: `Systolic <${thresholds.systolic.low} mmHg`,
        message: 'Dangerously low blood pressure (hypotension)'
      };
    }
  }

  // Check diastolic
  if (diastolic !== null) {
    if (diastolic > thresholds.diastolic.high) {
      return {
        type: 'blood_pressure',
        value: `${systolic ?? '?'}/${diastolic} mmHg`,
        threshold: `Diastolic >${thresholds.diastolic.high} mmHg`,
        message: 'Dangerously high diastolic pressure'
      };
    }

    if (diastolic < thresholds.diastolic.low) {
      return {
        type: 'blood_pressure',
        value: `${systolic ?? '?'}/${diastolic} mmHg`,
        threshold: `Diastolic <${thresholds.diastolic.low} mmHg`,
        message: 'Dangerously low diastolic pressure'
      };
    }
  }

  return null;
}

/**
 * Check if symptoms contain critical keywords
 */
function checkSymptomEmergency(symptoms?: string): EmergencyIndicator | null {
  if (!symptoms) {
    return null;
  }

  const symptomsLower = symptoms.toLowerCase();
  const criticalKeywords = EMERGENCY_THRESHOLDS.symptoms.critical;

  for (const keyword of criticalKeywords) {
    if (symptomsLower.includes(keyword.toLowerCase())) {
      return {
        type: 'symptoms',
        value: keyword,
        threshold: 'Critical symptom keyword',
        message: `Critical symptom detected: ${keyword}`
      };
    }
  }

  return null;
}

/**
 * Generate emergency recommendations based on detected conditions
 */
function generateEmergencyRecommendations(indicators: EmergencyIndicator[]): string[] {
  const recommendations: string[] = [];

  // Always include general emergency recommendation
  recommendations.push('Seek immediate medical attention');

  // Add specific recommendations based on indicators
  for (const indicator of indicators) {
    switch (indicator.type) {
      case 'temperature':
        if (indicator.message.includes('high')) {
          recommendations.push('Call emergency services or go to the nearest emergency room');
          recommendations.push('Stay hydrated and in a cool environment');
        } else {
          recommendations.push('Call emergency services immediately');
          recommendations.push('Keep warm with blankets while waiting for help');
        }
        break;

      case 'blood_pressure':
        if (indicator.message.includes('high')) {
          recommendations.push('Call emergency services - this may be a hypertensive crisis');
          recommendations.push('Sit down and remain calm while waiting for help');
        } else {
          recommendations.push('Call emergency services - severe hypotension requires immediate care');
          recommendations.push('Lie down with legs elevated if possible');
        }
        break;

      case 'symptoms':
        if (indicator.value.includes('chest pain')) {
          recommendations.push('Call emergency services immediately - possible heart attack');
          recommendations.push('Chew aspirin if available and not allergic');
        } else if (indicator.value.includes('breathing')) {
          recommendations.push('Call emergency services immediately');
          recommendations.push('Sit upright and try to remain calm');
        } else if (indicator.value.includes('stroke')) {
          recommendations.push('Call emergency services immediately - time is critical for stroke');
          recommendations.push('Note the time symptoms started');
        } else {
          recommendations.push('Call emergency services or go to emergency room immediately');
        }
        break;
    }
  }

  // Remove duplicates
  return Array.from(new Set(recommendations));
}

/**
 * Detect emergency conditions from vitals and symptoms
 */
export function detectEmergency(vitals: VitalsData, symptoms?: string): EmergencyResult {
  const indicators: EmergencyIndicator[] = [];

  // Check temperature
  const tempIndicator = checkTemperatureEmergency(vitals.temperature);
  if (tempIndicator) {
    indicators.push(tempIndicator);
  }

  // Check blood pressure
  const bpIndicator = checkBloodPressureEmergency(vitals.bloodPressure);
  if (bpIndicator) {
    indicators.push(bpIndicator);
  }

  // Check symptoms
  const symptomIndicator = checkSymptomEmergency(symptoms || vitals.currentStatus || undefined);
  if (symptomIndicator) {
    indicators.push(symptomIndicator);
  }

  const isEmergency = indicators.length > 0;
  const recommendations = isEmergency ? generateEmergencyRecommendations(indicators) : [];

  return {
    isEmergency,
    indicators,
    recommendations,
    severity: isEmergency ? 'critical' : 'normal'
  };
}

/**
 * Evaluate complexity of the case to determine if agent assistance is needed
 * 
 * This function analyzes:
 * 1. Symptom complexity (text length, keyword count, multiple symptoms)
 * 2. Vitals concern level (near-threshold values)
 * 3. Medical history indicators
 * 4. Age-related factors
 * 
 * Handles incomplete vitals gracefully by making decisions based on available data.
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 7.2, 7.3
 */
export function evaluateComplexity(vitals: VitalsData, symptoms?: string): ComplexityResult {
  const factors: string[] = [];
  let complexityScore = 0; // 0-10 scale
  
  const symptomText = symptoms || vitals.currentStatus || '';
  const symptomTextLower = symptomText.toLowerCase();
  
  // Track which vitals are missing for transparency
  const missingVitals: string[] = [];
  if (vitals.temperature.value === null) missingVitals.push('temperature');
  if (vitals.weight.value === null) missingVitals.push('weight');
  // Blood pressure is considered missing if both values are null OR if only one is provided
  if ((vitals.bloodPressure.systolic === null && vitals.bloodPressure.diastolic === null) ||
      (vitals.bloodPressure.systolic === null && vitals.bloodPressure.diastolic !== null) ||
      (vitals.bloodPressure.systolic !== null && vitals.bloodPressure.diastolic === null)) {
    missingVitals.push('blood pressure');
  }

  // === SYMPTOM COMPLEXITY ANALYSIS ===
  
  // 1. Text length analysis
  if (symptomText.length > 200) {
    factors.push('Detailed symptom description suggests complex case');
    complexityScore += 2;
  } else if (symptomText.length > 100) {
    factors.push('Moderate symptom description length');
    complexityScore += 1;
  }

  // 2. Keyword count analysis
  const medicalKeywords = [
    'pain', 'fever', 'cough', 'nausea', 'vomiting', 'diarrhea', 
    'headache', 'dizziness', 'fatigue', 'weakness', 'swelling',
    'rash', 'bleeding', 'shortness of breath', 'chest', 'abdomen'
  ];
  const keywordCount = medicalKeywords.filter(keyword => 
    symptomTextLower.includes(keyword)
  ).length;
  
  if (keywordCount >= 3) {
    factors.push(`Multiple symptoms reported (${keywordCount} symptom keywords)`);
    complexityScore += 3;
  } else if (keywordCount >= 2) {
    factors.push(`Several symptoms mentioned (${keywordCount} symptom keywords)`);
    complexityScore += 2;
  }

  // 3. Multiple symptoms with conjunctions
  const symptomIndicators = [',', ' and ', ' also ', ' plus ', ' with ', ' along with '];
  const conjunctionCount = symptomIndicators.filter(indicator => 
    symptomTextLower.includes(indicator)
  ).length;
  
  if (conjunctionCount >= 2) {
    factors.push('Multiple interconnected symptoms');
    complexityScore += 1;
  }

  // 4. Chronic condition indicators
  const chronicKeywords = [
    'chronic', 'ongoing', 'persistent', 'recurring', 'history of',
    'diagnosed with', 'taking medication for', 'previously had'
  ];
  const hasChronicIndicators = chronicKeywords.some(keyword => 
    symptomTextLower.includes(keyword)
  );
  if (hasChronicIndicators) {
    factors.push('Chronic or ongoing condition mentioned');
    complexityScore += 2;
  }

  // 5. Medication mentions
  const medicationKeywords = ['medication', 'medicine', 'pills', 'prescription', 'taking', 'on'];
  const hasMedicationMention = medicationKeywords.some(keyword => 
    symptomTextLower.includes(keyword)
  );
  if (hasMedicationMention) {
    factors.push('Current medication use mentioned');
    complexityScore += 1;
  }

  // === VITALS CONCERN LEVEL EVALUATION ===
  
  // Temperature analysis (near-threshold values)
  if (vitals.temperature.value !== null) {
    const tempCelsius = convertToCelsius(vitals.temperature.value, vitals.temperature.unit as 'celsius' | 'fahrenheit');
    
    // High fever (approaching emergency)
    if (tempCelsius > 38.5 && tempCelsius <= 39.5) {
      factors.push(`Elevated temperature (${tempCelsius.toFixed(1)}°C) approaching concerning levels`);
      complexityScore += 2;
    } 
    // Moderate fever
    else if (tempCelsius > 37.5 && tempCelsius <= 38.5) {
      factors.push(`Mild fever detected (${tempCelsius.toFixed(1)}°C)`);
      complexityScore += 1;
    }
    // Low temperature (approaching emergency)
    else if (tempCelsius < 36.0 && tempCelsius >= 35.0) {
      factors.push(`Low temperature (${tempCelsius.toFixed(1)}°C) approaching concerning levels`);
      complexityScore += 2;
    }
  }

  // Blood pressure analysis (near-threshold values)
  if (vitals.bloodPressure.systolic !== null || vitals.bloodPressure.diastolic !== null) {
    const systolic = vitals.bloodPressure.systolic;
    const diastolic = vitals.bloodPressure.diastolic;

    // Systolic analysis
    if (systolic !== null) {
      // High (approaching hypertensive crisis)
      if (systolic > 140 && systolic <= 180) {
        factors.push(`Elevated systolic blood pressure (${systolic} mmHg)`);
        complexityScore += 2;
      }
      // Low (approaching hypotension)
      else if (systolic < 100 && systolic >= 90) {
        factors.push(`Low systolic blood pressure (${systolic} mmHg)`);
        complexityScore += 2;
      }
    }

    // Diastolic analysis
    if (diastolic !== null) {
      // High
      if (diastolic > 90 && diastolic <= 120) {
        factors.push(`Elevated diastolic blood pressure (${diastolic} mmHg)`);
        complexityScore += 2;
      }
      // Low
      else if (diastolic < 70 && diastolic >= 60) {
        factors.push(`Low diastolic blood pressure (${diastolic} mmHg)`);
        complexityScore += 2;
      }
    }
  }

  // === AGE-RELATED FACTORS ===
  
  // Very young or elderly patients may need more careful assessment
  if (vitals.patientAge !== null) {
    if (vitals.patientAge < 5) {
      factors.push('Young child - requires careful assessment');
      complexityScore += 1;
    } else if (vitals.patientAge > 65) {
      factors.push('Elderly patient - may require additional consideration');
      complexityScore += 1;
    }
  }

  // === DECISION LOGIC ===
  
  // Note missing vitals if any
  if (missingVitals.length > 0) {
    factors.push(`Note: ${missingVitals.join(', ')} not collected - decision based on available data`);
  }
  
  // Determine if agent assistance is needed based on complexity score
  // Score >= 3: Complex case, needs agent assistance
  // Score < 3: Simple case, can proceed directly
  const isComplex = complexityScore >= 3;
  const needsAgentAssistance = isComplex;

  // If no factors identified, add default factor
  if (factors.length === 0 || (factors.length === 1 && factors[0]?.includes('not collected'))) {
    factors.push('Simple presentation with available vitals within normal ranges');
  }

  return {
    isComplex,
    factors,
    needsAgentAssistance
  };
}

/**
 * Analyze vitals and make triage decision
 * 
 * This is the main entry point for triage analysis. It:
 * 1. Checks for emergency conditions first
 * 2. Evaluates case complexity
 * 3. Makes routing decision (emergency, agent-assisted, or direct-to-diagnosis)
 * 4. Provides detailed rationale with specific factors
 * 5. Handles incomplete vitals gracefully by making decisions based on available data
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.5, 7.2, 7.3
 */
export function analyzeVitals(vitals: VitalsData): TriageResult {
  // First check for emergency
  const emergencyResult = detectEmergency(vitals, vitals.currentStatus || undefined);
  
  if (emergencyResult.isEmergency) {
    return {
      decision: 'emergency',
      reason: `Emergency condition detected: ${emergencyResult.indicators.map(i => i.message).join(', ')}`,
      confidence: 1.0,
      factors: emergencyResult.indicators.map(i => i.message)
    };
  }

  // Evaluate complexity
  const complexityResult = evaluateComplexity(vitals, vitals.currentStatus || undefined);

  // Decision: Agent-assisted intake for complex cases
  if (complexityResult.needsAgentAssistance) {
    const reason = complexityResult.factors.length > 0
      ? `Case complexity requires agent-assisted intake. ${complexityResult.factors[0]}`
      : 'Case complexity requires agent-assisted intake';
    
    return {
      decision: 'agent-assisted',
      reason,
      confidence: 0.8,
      factors: complexityResult.factors
    };
  }

  // Decision: Direct-to-diagnosis for simple cases
  const simpleFactors: string[] = [];
  
  // Check what makes this case simple (only for vitals that were collected)
  if (vitals.temperature.value !== null) {
    const tempCelsius = convertToCelsius(vitals.temperature.value, vitals.temperature.unit as 'celsius' | 'fahrenheit');
    if (tempCelsius >= 36.0 && tempCelsius <= 37.5) {
      simpleFactors.push('Normal temperature');
    }
  }
  
  if (vitals.bloodPressure.systolic !== null && vitals.bloodPressure.diastolic !== null) {
    const systolic = vitals.bloodPressure.systolic;
    const diastolic = vitals.bloodPressure.diastolic;
    
    if (systolic >= 100 && systolic <= 140 && diastolic >= 70 && diastolic <= 90) {
      simpleFactors.push('Normal blood pressure');
    }
  }
  
  const symptomText = vitals.currentStatus || '';
  if (symptomText.length > 0 && symptomText.length <= 100) {
    simpleFactors.push('Clear, concise symptom description');
  }
  
  // Add note about missing vitals if any
  const missingVitals: string[] = [];
  if (vitals.temperature.value === null) missingVitals.push('temperature');
  if (vitals.weight.value === null) missingVitals.push('weight');
  // Blood pressure is considered missing if both values are null OR if only one is provided
  if ((vitals.bloodPressure.systolic === null && vitals.bloodPressure.diastolic === null) ||
      (vitals.bloodPressure.systolic === null && vitals.bloodPressure.diastolic !== null) ||
      (vitals.bloodPressure.systolic !== null && vitals.bloodPressure.diastolic === null)) {
    missingVitals.push('blood pressure');
  }
  
  if (missingVitals.length > 0) {
    simpleFactors.push(`Note: ${missingVitals.join(', ')} not collected`);
  }
  
  if (simpleFactors.length === 0) {
    simpleFactors.push('Straightforward presentation based on available data');
  }
  
  return {
    decision: 'direct-to-diagnosis',
    reason: 'Straightforward case - proceeding directly to diagnosis based on available data',
    confidence: 0.7,
    factors: simpleFactors
  };
}

/**
 * Default implementation of TriageService
 */
export const triageService: TriageService = {
  analyzeVitals,
  detectEmergency,
  evaluateComplexity
};

// Export individual functions for testing
export {
  convertToCelsius,
  checkTemperatureEmergency,
  checkBloodPressureEmergency,
  checkSymptomEmergency,
  generateEmergencyRecommendations,
  EMERGENCY_THRESHOLDS
};
