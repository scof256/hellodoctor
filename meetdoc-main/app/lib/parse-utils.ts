import { AgentResponse, DoctorThought, MedicalData, INITIAL_THOUGHT } from "../types";

/**
 * Parse JSON response from AI model with fallback strategies
 * 1. Try markdown code block extraction
 * 2. Fallback to brace matching
 * 3. Return null if all parsing fails
 */
export function parseJsonResponse(text: string): any {
  // Try markdown code block first
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Continue to fallback
    }
  }

  // Fallback: brace matching
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (e) {
      // Return null if all parsing fails
    }
  }

  return null;
}

/**
 * Extract thought, reply, and updatedData from parsed response
 */
export function extractResponseFields(parsed: any): {
  thought: DoctorThought;
  reply: string;
  updatedData: Partial<MedicalData>;
} {
  return {
    thought: parsed?.thought || INITIAL_THOUGHT,
    reply: parsed?.reply || parsed?.message || "",
    updatedData: parsed?.updatedData || {}
  };
}

/**
 * Merge updated medical data with existing data, preserving arrays
 */
export function mergeMedicalData(
  existing: MedicalData,
  update: Partial<MedicalData>
): MedicalData {
  const arrayFields: (keyof MedicalData)[] = [
    'medicalRecords',
    'medications',
    'allergies',
    'pastMedicalHistory',
    'reviewOfSystems'
  ];

  const merged = { ...existing };

  for (const key of Object.keys(update) as (keyof MedicalData)[]) {
    if (arrayFields.includes(key)) {
      const existingArray = (existing[key] as string[]) || [];
      const updateArray = (update[key] as string[]) || [];
      // Union with deduplication
      (merged as any)[key] = [...new Set([...existingArray, ...updateArray])];
    } else if (update[key] !== undefined) {
      (merged as any)[key] = update[key];
    }
  }

  return merged;
}
