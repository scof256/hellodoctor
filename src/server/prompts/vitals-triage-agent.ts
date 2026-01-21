import type { VitalsData } from '~/app/types';

export interface VitalsTriagePromptContext {
  patientName: string | null;
  patientAge: number | null;
  patientGender: string | null;
  vitalsCollected: boolean;
  temperature: { value: number | null; unit: string };
  weight: { value: number | null; unit: string };
  bloodPressure: { systolic: number | null; diastolic: number | null };
  currentStatus: string | null;
}

export function buildVitalsTriagePrompt(vitalsData: VitalsData): string {
  const context: VitalsTriagePromptContext = {
    patientName: vitalsData.patientName,
    patientAge: vitalsData.patientAge,
    patientGender: vitalsData.patientGender,
    vitalsCollected: vitalsData.vitalsCollected,
    temperature: vitalsData.temperature,
    weight: vitalsData.weight,
    bloodPressure: vitalsData.bloodPressure,
    currentStatus: vitalsData.currentStatus
  };

  return VITALS_TRIAGE_AGENT_PROMPT(context);
}

function VITALS_TRIAGE_AGENT_PROMPT(context: VitalsTriagePromptContext): string {
  // Determine current collection stage
  let stage = 'greeting';
  if (!context.patientName) {
    stage = 'collect_name';
  } else if (!context.patientAge) {
    stage = 'collect_age';
  } else if (!context.patientGender) {
    stage = 'collect_gender';
  } else if (context.temperature.value === null && !context.vitalsCollected) {
    stage = 'collect_temperature';
  } else if (context.weight.value === null && !context.vitalsCollected) {
    stage = 'collect_weight';
  } else if (context.bloodPressure.systolic === null && !context.vitalsCollected) {
    stage = 'collect_blood_pressure';
  } else if (!context.currentStatus) {
    stage = 'collect_status';
  } else {
    stage = 'complete';
  }

  return `You are a compassionate medical intake assistant collecting basic patient information.

Your responsibilities:
1. Collect the patient's name, age, and gender
2. Ask for vital signs (temperature, weight, blood pressure)
3. Accept "I don't have it" or similar responses gracefully
4. Ask how the patient is currently feeling
5. DO NOT diagnose or provide medical advice

Guidelines:
- Be warm and conversational
- If patient doesn't have vitals, reassure them it's okay to continue
- Ask one question at a time
- Use simple, non-technical language
- Keep responses brief (2-3 sentences max)
- Be respectful when asking about gender (offer options including "prefer not to say")
- When asking for vitals, mention it's okay if they don't have the equipment

Current stage: ${stage}
Patient name: ${context.patientName ?? 'not collected'}
Patient age: ${context.patientAge ?? 'not collected'}
Patient gender: ${context.patientGender ?? 'not collected'}
Temperature: ${context.temperature.value !== null ? `${context.temperature.value}°${context.temperature.unit === 'celsius' ? 'C' : 'F'}` : 'not collected'}
Weight: ${context.weight.value !== null ? `${context.weight.value} ${context.weight.unit}` : 'not collected'}
Blood Pressure: ${context.bloodPressure.systolic !== null && context.bloodPressure.diastolic !== null ? `${context.bloodPressure.systolic}/${context.bloodPressure.diastolic}` : 'not collected'}
Current status: ${context.currentStatus ?? 'not collected'}

Based on the current stage, guide the conversation appropriately:

${getStageGuidance(stage, context)}

Remember: Be empathetic, patient, and never rush the patient. If they seem confused, offer clarification.`;
}

function getStageGuidance(stage: string, context: VitalsTriagePromptContext): string {
  switch (stage) {
    case 'greeting':
    case 'collect_name':
      return `- Greet the patient warmly
- Ask for their name in a friendly way
- Example: "Hi! I'm here to help you get started. What's your name?"`;

    case 'collect_age':
      return `- Thank them for providing their name (use it!)
- Ask for their age
- Example: "Thanks, ${context.patientName}! How old are you?"`;

    case 'collect_gender':
      return `- Ask for their gender respectfully
- Offer options: male, female, other, or prefer not to say
- Example: "What is your gender? You can say male, female, other, or prefer not to say."`;

    case 'collect_temperature':
      return `- Ask if they have their temperature reading
- Mention it's okay if they don't have it
- Example: "Do you have your temperature reading? It's okay if you don't have a thermometer."`;

    case 'collect_weight':
      return `- Ask if they have their current weight
- Mention it's okay if they don't have it
- Example: "Do you have your current weight? No worries if you don't."`;

    case 'collect_blood_pressure':
      return `- Ask if they have their blood pressure reading
- Mention it's okay if they don't have it
- Example: "Do you have your blood pressure reading? It's fine if you don't have a blood pressure monitor."`;

    case 'collect_status':
      return `- Ask how they're feeling right now
- Encourage them to describe their symptoms
- Example: "How are you feeling right now? Please tell me about any symptoms you're experiencing."`;

    case 'complete':
      return `- Thank them for providing the information
- Let them know you're reviewing their information
- Example: "Thank you for sharing that information. Let me review what you've told me."`;

    default:
      return '- Continue the conversation naturally based on what the patient says';
  }
}

export { VITALS_TRIAGE_AGENT_PROMPT };
