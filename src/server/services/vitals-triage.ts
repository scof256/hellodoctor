import type { VitalsData } from '~/app/types';

export interface VitalSignThresholds {
  temperature: {
    min: number; // 35°C / 95°F
    max: number; // 39.5°C / 103°F
  };
  bloodPressure: {
    systolic: {
      min: number; // 90 mmHg
      max: number; // 180 mmHg
    };
    diastolic: {
      min: number; // 60 mmHg
      max: number; // 120 mmHg
    };
  };
}

export interface TriageResult {
  decision: 'emergency' | 'normal';
  reason: string;
  recommendations: string[];
}

export class VitalsTriageService {
  private thresholds: VitalSignThresholds;
  private emergencyKeywords: string[];

  constructor() {
    this.thresholds = {
      temperature: {
        min: 35, // Celsius
        max: 39.5
      },
      bloodPressure: {
        systolic: {
          min: 90,
          max: 180
        },
        diastolic: {
          min: 60,
          max: 120
        }
      }
    };

    this.emergencyKeywords = [
      'chest pain',
      'severe pain',
      'difficulty breathing',
      'shortness of breath',
      'bleeding heavily',
      'uncontrolled bleeding',
      'unconscious',
      'loss of consciousness',
      'severe headache',
      'worst headache',
      'confusion',
      'disorientation',
      'seizure',
      'convulsions',
      'suicidal',
      'self-harm'
    ];
  }

  /**
   * Assess vital signs against emergency thresholds
   */
  assessVitals(vitalsData: VitalsData): TriageResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check temperature
    if (vitalsData.temperature.value !== null) {
      let tempInCelsius = vitalsData.temperature.value;
      
      // Convert Fahrenheit to Celsius if needed
      if (vitalsData.temperature.unit === 'fahrenheit') {
        tempInCelsius = (tempInCelsius - 32) * 5 / 9;
      }

      if (tempInCelsius < this.thresholds.temperature.min) {
        issues.push('Temperature below safe range (hypothermia risk)');
        recommendations.push('Seek immediate medical attention for low body temperature');
      } else if (tempInCelsius > this.thresholds.temperature.max) {
        issues.push('High fever detected');
        recommendations.push('Seek immediate medical attention for high fever');
      }
    }

    // Check blood pressure
    if (vitalsData.bloodPressure.systolic !== null || vitalsData.bloodPressure.diastolic !== null) {
      const systolic = vitalsData.bloodPressure.systolic;
      const diastolic = vitalsData.bloodPressure.diastolic;

      if (systolic !== null) {
        if (systolic < this.thresholds.bloodPressure.systolic.min) {
          issues.push('Blood pressure too low (hypotension)');
          recommendations.push('Seek immediate medical attention for low blood pressure');
        } else if (systolic > this.thresholds.bloodPressure.systolic.max) {
          issues.push('Blood pressure critically high (hypertensive crisis)');
          recommendations.push('Seek immediate medical attention for high blood pressure');
        }
      }

      if (diastolic !== null) {
        if (diastolic < this.thresholds.bloodPressure.diastolic.min) {
          issues.push('Diastolic pressure too low');
          recommendations.push('Seek immediate medical attention for low diastolic pressure');
        } else if (diastolic > this.thresholds.bloodPressure.diastolic.max) {
          issues.push('Diastolic pressure critically high (hypertensive emergency)');
          recommendations.push('Seek immediate medical attention for high diastolic pressure');
        }
      }
    }

    if (issues.length > 0) {
      return {
        decision: 'emergency',
        reason: issues.join('; '),
        recommendations
      };
    }

    return {
      decision: 'normal',
      reason: 'All vital signs within normal ranges',
      recommendations: []
    };
  }

  /**
   * Assess patient's symptom description for emergency keywords
   */
  assessSymptoms(statusDescription: string): TriageResult {
    if (!statusDescription || statusDescription.trim().length === 0) {
      return {
        decision: 'normal',
        reason: 'No symptoms reported',
        recommendations: []
      };
    }

    const lowerStatus = statusDescription.toLowerCase();
    const detectedKeywords: string[] = [];

    for (const keyword of this.emergencyKeywords) {
      if (lowerStatus.includes(keyword)) {
        detectedKeywords.push(keyword);
      }
    }

    if (detectedKeywords.length > 0) {
      return {
        decision: 'emergency',
        reason: `Emergency symptoms detected: ${detectedKeywords.join(', ')}`,
        recommendations: [
          'Seek immediate medical attention',
          'Call emergency services or visit the nearest emergency room',
          'Do not delay treatment'
        ]
      };
    }

    return {
      decision: 'normal',
      reason: 'No emergency symptoms detected',
      recommendations: []
    };
  }

  /**
   * Combine vitals and symptoms assessments
   * If either indicates emergency, the final decision is emergency
   */
  combineAssessments(vitalsResult: TriageResult, symptomsResult: TriageResult): TriageResult {
    if (vitalsResult.decision === 'emergency' || symptomsResult.decision === 'emergency') {
      const reasons: string[] = [];
      const recommendations: string[] = [];

      if (vitalsResult.decision === 'emergency') {
        reasons.push(vitalsResult.reason);
        recommendations.push(...vitalsResult.recommendations);
      }

      if (symptomsResult.decision === 'emergency') {
        reasons.push(symptomsResult.reason);
        recommendations.push(...symptomsResult.recommendations);
      }

      // Deduplicate recommendations
      const uniqueRecommendations = Array.from(new Set(recommendations));

      return {
        decision: 'emergency',
        reason: reasons.join('; '),
        recommendations: uniqueRecommendations
      };
    }

    return {
      decision: 'normal',
      reason: 'No emergency conditions detected',
      recommendations: []
    };
  }
}
