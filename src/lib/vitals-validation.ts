/**
 * Vitals Validation Module
 * 
 * Validates patient vital signs and demographic data against reasonable human ranges.
 * Requirements: 1.5, 2.4
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates temperature reading
 * Valid range: 20-50°C (68-122°F)
 * Requirements: 2.4
 */
export function validateTemperature(
  value: number,
  unit: 'celsius' | 'fahrenheit'
): ValidationResult {
  let celsius = value;
  
  if (unit === 'fahrenheit') {
    celsius = (value - 32) * (5 / 9);
  }
  
  if (celsius < 20 || celsius > 50) {
    return {
      isValid: false,
      error: 'Temperature must be between 20-50°C (68-122°F)'
    };
  }
  
  return { isValid: true };
}

/**
 * Validates weight reading
 * Valid range: 2-500kg (4.4-1100lbs)
 * Requirements: 2.4
 */
export function validateWeight(
  value: number,
  unit: 'kg' | 'lbs'
): ValidationResult {
  let kg = value;
  
  if (unit === 'lbs') {
    kg = value * 0.453592;
  }
  
  if (kg < 2 || kg > 500) {
    return {
      isValid: false,
      error: 'Weight must be between 2-500kg (4.4-1100lbs)'
    };
  }
  
  return { isValid: true };
}

/**
 * Validates blood pressure reading
 * Valid ranges:
 * - Systolic: 40-250 mmHg
 * - Diastolic: 20-150 mmHg
 * Requirements: 2.4
 */
export function validateBloodPressure(
  systolic: number,
  diastolic: number
): ValidationResult {
  if (systolic < 40 || systolic > 250) {
    return {
      isValid: false,
      error: 'Systolic pressure must be between 40-250 mmHg'
    };
  }
  
  if (diastolic < 20 || diastolic > 150) {
    return {
      isValid: false,
      error: 'Diastolic pressure must be between 20-150 mmHg'
    };
  }
  
  if (diastolic >= systolic) {
    return {
      isValid: false,
      error: 'Diastolic pressure must be lower than systolic pressure'
    };
  }
  
  return { isValid: true };
}

/**
 * Validates age
 * Valid range: 0-120 years
 * Requirements: 1.5
 */
export function validateAge(age: number): ValidationResult {
  if (!Number.isInteger(age)) {
    return {
      isValid: false,
      error: 'Age must be a whole number'
    };
  }
  
  if (age < 0 || age > 120) {
    return {
      isValid: false,
      error: 'Age must be between 0-120 years'
    };
  }
  
  return { isValid: true };
}
