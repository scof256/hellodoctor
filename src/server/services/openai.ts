import OpenAI from "openai";
import { env } from "@/env";
import type { 
  AgentResponse, 
  Message, 
  MedicalData, 
  AgentRole,
  SBAR,
  TrackingState
} from "@/types";
import { INITIAL_THOUGHT, VALID_AGENT_ROLES } from "@/types";
import { determineAgent } from "./intake-utils";
import { injectTrackingState } from "./tracking-state-utils";

// --- RELIABILITY CONFIGURATION ---
const OPENAI_CONFIG = {
  timeoutMs: 30000,
  maxAutoRetries: 2,
  retryDelayMs: 1000,
  fallbackMessage: "I apologize, but I'm having trouble processing your message. Please try again.",
};

// --- RESPONSE VALIDATION ---
export interface ResponseValidationResult {
  isValid: boolean;
  reply: string;
  error?: string;
  wasRecovered: boolean;
  parsedData?: any;
  validationDetails?: {
    hasValidReply: boolean;
    hasValidUpdatedData: boolean;
    hasValidActiveAgent: boolean;
  };
}

function parseJsonResponseStatic(text: string): any {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) { /* continue */ }
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (e) { /* continue */ }
  }
  return null;
}

function extractFallbackReply(parsedData: any): string | null {
  const alternativeFields = ['text', 'content', 'response', 'answer', 'output'];
  for (const field of alternativeFields) {
    if (parsedData[field] && typeof parsedData[field] === 'string' && parsedData[field].trim().length > 0) {
      return parsedData[field].trim();
    }
  }
  if (parsedData.thought?.nextMove && typeof parsedData.thought.nextMove === 'string') {
    return parsedData.thought.nextMove;
  }
  return null;
}

function extractPlainTextFallback(text: string): string | null {
  let cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
  cleaned = cleaned.replace(/\{[\s\S]*\}/g, '').trim();
  if (cleaned.length > 10) {
    return cleaned.length > 500 ? cleaned.substring(0, 500) + '...' : cleaned;
  }
  const sentences = text.match(/[A-Z][^.!?]*[.!?]/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, 3).join(' ');
  }
  return null;
}

/**
 * Check if a value is a plain object (not null, not array, not primitive)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is a valid AgentRole
 */
function isValidAgentRole(value: unknown): boolean {
  return typeof value === 'string' && VALID_AGENT_ROLES.includes(value as any);
}

/**
 * Validate AI response and extract reply with fallback mechanisms.
 * Implements Requirements 5.1, 5.2, 5.3, 5.5 - Response validation with fallback
 * 
 * Validates:
 * - reply field is non-empty (Requirement 5.1)
 * - updatedData is an object (Requirement 5.2)
 * - activeAgent is a valid AgentRole (Requirement 5.3)
 * - Uses fallback for malformed responses (Requirement 5.5)
 */
export function validateAIResponse(text: string | null | undefined): ResponseValidationResult {
  if (!text || text.trim().length === 0) {
    console.warn('[validateAIResponse] Empty response received');
    return { 
      isValid: false, 
      reply: OPENAI_CONFIG.fallbackMessage, 
      error: 'Empty response received', 
      wasRecovered: false,
      validationDetails: {
        hasValidReply: false,
        hasValidUpdatedData: false,
        hasValidActiveAgent: false
      }
    };
  }
  
  const parsedData = parseJsonResponseStatic(text);
  if (parsedData) {
    // Validate all required fields
    const reply = parsedData.reply || parsedData.message;
    const hasValidReply = reply && typeof reply === 'string' && reply.trim().length > 0;
    const hasValidUpdatedData = isPlainObject(parsedData.updatedData);
    const hasValidActiveAgent = isValidAgentRole(parsedData.activeAgent);
    
    // Log validation details for debugging
    if (!hasValidReply || !hasValidUpdatedData || !hasValidActiveAgent) {
      console.warn('[validateAIResponse] Validation issues:', {
        hasValidReply,
        hasValidUpdatedData,
        hasValidActiveAgent,
        actualUpdatedData: typeof parsedData.updatedData,
        actualActiveAgent: parsedData.activeAgent
      });
    }
    
    if (hasValidReply) {
      return { 
        isValid: true, 
        reply: reply.trim(), 
        wasRecovered: false, 
        parsedData,
        validationDetails: {
          hasValidReply,
          hasValidUpdatedData,
          hasValidActiveAgent
        }
      };
    }
    const recoveredReply = extractFallbackReply(parsedData);
    if (recoveredReply) {
      return { 
        isValid: true, 
        reply: recoveredReply, 
        wasRecovered: true, 
        parsedData,
        validationDetails: {
          hasValidReply: false,
          hasValidUpdatedData,
          hasValidActiveAgent
        }
      };
    }
  }
  const plainTextReply = extractPlainTextFallback(text);
  if (plainTextReply) {
    return { 
      isValid: true, 
      reply: plainTextReply, 
      error: 'JSON parsing failed, extracted plain text', 
      wasRecovered: true,
      validationDetails: {
        hasValidReply: false,
        hasValidUpdatedData: false,
        hasValidActiveAgent: false
      }
    };
  }
  console.error('[validateAIResponse] Failed to extract valid reply from response');
  return { 
    isValid: false, 
    reply: OPENAI_CONFIG.fallbackMessage, 
    error: 'Failed to extract valid reply from response', 
    wasRecovered: false,
    validationDetails: {
      hasValidReply: false,
      hasValidUpdatedData: false,
      hasValidActiveAgent: false
    }
  };
}


// --- A2A PROTOCOL DEFINITIONS ---
const JSON_SCHEMA_INSTRUCTION = `
**OUTPUT FORMAT:**
You must respond with a JSON object wrapped in \`\`\`json ... \`\`\` code blocks following this exact schema:

{
  "thought": {
    "differentialDiagnosis": [
      { "condition": "Condition Name", "probability": "High/Medium/Low", "reasoning": "Brief explanation" }
    ],
    "strategy": "Name the technique used: 'Funneling', 'Signposting', 'Proxy Physical Exam', 'Batched Question', 'Contextual Weaving', or 'Photo Request'.",
    "missingInformation": ["List of critical data points you are hunting for"],
    "nextMove": "Your immediate next question"
  },
  "reply": "Your message to the user (Markdown supported). Be conversational but efficient.",
  "updatedData": {
    "chiefComplaint": "...",
    "hpi": "...",
    "medicalRecords": ["..."],
    "recordsCheckCompleted": boolean,
    "historyCheckCompleted": boolean,
    "medications": ["..."],
    "allergies": ["..."],
    "pastMedicalHistory": ["..."],
    "familyHistory": "...",
    "socialHistory": "...",
    "clinicalHandover": {
      "situation": "...",
      "background": "...",
      "assessment": "...",
      "recommendation": "..."
    },
    "ucgRecommendations": "Markdown string...",
    "bookingStatus": "collecting" | "ready"
  }
}
`;

const ORCHESTRATOR_PROMPT = `
You are the **A2A Orchestrator**. Analyze the intake state and ROUTE control to the correct Specialist Agent.

**AGENTS:**
1. **Triage**: Active ONLY if 'chiefComplaint' is missing.
2. **ClinicalInvestigator**: The primary engine. Active if symptoms are being explored.
3. **RecordsClerk**: Active if the user mentions having files/results, OR if 'recordsCheckCompleted' is false.
4. **HistorySpecialist**: Active ONLY to fill gaps in Meds/Allergies/History.
5. **HandoverSpecialist**: Active when SBAR is complete and Booking is ready.

**ROUTING RULES:**
- **Contextual Weaving Rule**: If ClinicalInvestigator is exploring a symptom requiring social history, KEEP ClinicalInvestigator active.
- **Urgency Rule**: New symptoms always trigger **ClinicalInvestigator**.
- **Completion Rule**: If the patient says "I'm healthy, no other issues," move to HandoverSpecialist.

**OUTPUT:**
Return ONLY the Agent Name string: "Triage" | "ClinicalInvestigator" | "RecordsClerk" | "HistorySpecialist" | "HandoverSpecialist"
`;

const AGENT_PROMPTS: Record<AgentRole, string> = {
  'Triage': `
    You are the **Triage Specialist Agent**.
    **Goal**: Identify the Chief Complaint efficiently.
    **Technique**: The Broad Start.
    **Task**: Ask "What brings you in today?" or clarify the main issue.
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  'ClinicalInvestigator': `
    You are the **Clinical Investigator Agent** (The Bayesian Interviewer).
    **Goal**: Build a Differential Diagnosis using "Hypothesis-Driven History".
    
    **STRATEGY PROTOCOLS:**
    1. **Hypothesis-Driven**: List top 3 differentials in 'thought' JSON.
    2. **The Funnel**: Start open, then rapid-fire closed questions.
    3. **Batched Questions**: Group yes/no questions together.
    4. **Signposting**: Explain topic changes to the patient.
    5. **Proxy Physical Exam**: Guide patient to self-examine.
    6. **Contextual Weaving**: Link symptoms to history immediately.
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  'RecordsClerk': `
    You are the **Medical Records Specialist Agent**.
    **Goal**: Get objective data without making the patient type.
    **STRATEGY: THE PHOTO FIRST APPROACH**
    - Prompt for photos of discharge letters, lab results, or pill bottles.
    - If user ignores, mark 'recordsCheckCompleted': true and continue.
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  'HistorySpecialist': `
    You are the **Patient History Specialist Agent**.
    **Goal**: Fill gaps in 'background' efficiently.
    **STRATEGY: THE BATCHED NEGATIVE**
    - Ask ONE combined question for meds + allergies + major conditions/surgeries.
    - If "Healthy/No": Set Meds=[], Allergies=[], PMH=[] AND set 'historyCheckCompleted': true.
    - If they list any items: Update the arrays AND set 'historyCheckCompleted': true.
    - NEVER re-ask once 'historyCheckCompleted' is true.
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  'HandoverSpecialist': `
    You are the **Senior Attending Agent**.
    **Goal**: Quality Control, SBAR Generation, and Booking.
    **Task**: 
    - Scan chat history for mentioned symptoms.
    - Final sweep: "Is there anything else worrying you?"
    - If SBAR is solid, set 'bookingStatus': 'ready'.
    - Populate 'ucgRecommendations' with Uganda Clinical Guidelines.
    ${JSON_SCHEMA_INSTRUCTION}
  `
};


export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    
    const config: { apiKey: string; baseURL?: string; defaultHeaders?: Record<string, string> } = { apiKey };
    
    // Support custom base URL for OpenAI-compatible APIs (Azure, Ollama, LM Studio, OpenRouter, etc.)
    if (env.OPENAI_BASE_URL) {
      config.baseURL = env.OPENAI_BASE_URL;
      
      // OpenRouter requires additional headers
      if (env.OPENAI_BASE_URL.includes('openrouter.ai')) {
        config.defaultHeaders = {
          'HTTP-Referer': env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Medical Intake System',
        };
      }
    }
    
    this.client = new OpenAI(config);
    this.model = env.OPENAI_MODEL || "gpt-4o";
  }

  private async analyzeSingleImage(base64: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: "text", text: "Analyze this medical image (lab result, scan, prescription, or symptom photo). Provide a concise professional clinical summary. If it's a medication, list the drug, dose, and frequency." }
          ]
        }],
        max_tokens: 500
      });
      return response.choices[0]?.message?.content || "Image uploaded but analysis failed.";
    } catch (e) {
      console.warn("Image analysis failed", e);
      return "Error analyzing uploaded image.";
    }
  }



  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  parseJsonResponse(text: string): any {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try { return JSON.parse(jsonMatch[1]); } catch (e) { /* continue */ }
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try { return JSON.parse(text.substring(firstBrace, lastBrace + 1)); } catch (e) { /* continue */ }
    }
    return null;
  }

  async sendMessage(
    history: Message[],
    currentMedicalData: MedicalData,
    mode: 'patient' | 'doctor' = 'patient',
    trackingState?: TrackingState
  ): Promise<{ response: AgentResponse; groundingMetadata?: unknown; retryCount?: number; wasRecovered?: boolean }> {
    const lastUserMessage = history[history.length - 1];
    let imageAnalysisContext = "";

    if (lastUserMessage?.role === 'user' && lastUserMessage.images && lastUserMessage.images.length > 0) {
      const analysisResults = [];
      for (let i = 0; i < lastUserMessage.images.length; i++) {
        const image = lastUserMessage.images[i];
        if (image) {
          const result = await this.analyzeSingleImage(image);
          analysisResults.push(`[Image ${i+1} Analysis]: ${result}`);
        }
      }
      imageAnalysisContext = `\n\n**VISUAL DATA INPUT (${lastUserMessage.images.length} images):**\n${analysisResults.join('\n')}\n`;
    }

    const chatHistory: OpenAI.Chat.ChatCompletionMessageParam[] = history.map(msg => {
      const isLast = msg.id === lastUserMessage?.id;
      return {
        role: msg.role === 'doctor' ? 'assistant' as const : msg.role as 'user' | 'assistant',
        content: msg.text + (isLast ? imageAnalysisContext : "")
      };
    });

    let activeAgent: AgentRole = 'ClinicalInvestigator';
    let systemInstruction = "";

    if (mode === 'doctor') {
      systemInstruction = `You are Dr. AI (CDSS Mode).\nContext: Chatting with a colleague.\nData: ${JSON.stringify(currentMedicalData)}\n${JSON_SCHEMA_INSTRUCTION}`;
    } else {
      activeAgent = trackingState?.currentAgent ?? determineAgent(currentMedicalData);
      const basePrompt = AGENT_PROMPTS[activeAgent];
      const injectedPrompt = trackingState
        ? injectTrackingState(basePrompt, { ...trackingState, currentAgent: activeAgent })
        : basePrompt;
      systemInstruction = `${injectedPrompt}\n\n**CONTEXTUAL DATA:**\n${JSON.stringify(currentMedicalData, null, 2)}`;
    }

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= OPENAI_CONFIG.maxAutoRetries) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'system', content: systemInstruction }, ...chatHistory],
          temperature: 0.3,
          max_tokens: 2000
        });

        const text = response.choices[0]?.message?.content || "";
        console.log(`[OpenAIService] Response text length: ${text.length}, retry: ${retryCount}`);

        const validationResult = validateAIResponse(text);
        console.log(`[OpenAIService] Validation result: isValid=${validationResult.isValid}, wasRecovered=${validationResult.wasRecovered}`);

        if (!validationResult.isValid) {
          if (retryCount < OPENAI_CONFIG.maxAutoRetries) {
            retryCount++;
            const delay = OPENAI_CONFIG.retryDelayMs * Math.pow(2, retryCount - 1);
            console.log(`[OpenAIService] Invalid response, retrying (${retryCount}/${OPENAI_CONFIG.maxAutoRetries}) after ${delay}ms`);
            await this.sleep(delay);
            continue;
          }
          console.warn(`[OpenAIService] Max retries reached, using fallback`);
        }

        const parsedData = validationResult.parsedData || this.parseJsonResponse(text);

        if (parsedData) {
          return {
            response: {
              thought: parsedData.thought || INITIAL_THOUGHT,
              reply: validationResult.reply,
              updatedData: { ...parsedData.updatedData, currentAgent: activeAgent },
              activeAgent: activeAgent
            },
            retryCount,
            wasRecovered: validationResult.wasRecovered || retryCount > 0
          };
        }

        return {
          response: {
            thought: INITIAL_THOUGHT,
            reply: validationResult.reply,
            updatedData: { currentAgent: activeAgent },
            activeAgent: activeAgent
          },
          retryCount,
          wasRecovered: validationResult.wasRecovered || retryCount > 0
        };

      } catch (error) {
        lastError = error as Error;
        // Log full error details for debugging
        const errorDetails = error as any;
        console.error(`[OpenAIService] API Error (retry ${retryCount}):`, error);
        if (errorDetails?.error) {
          console.error(`[OpenAIService] Error details:`, JSON.stringify(errorDetails.error, null, 2));
        }
        if (errorDetails?.message) {
          console.error(`[OpenAIService] Error message:`, errorDetails.message);
        }
        if (retryCount < OPENAI_CONFIG.maxAutoRetries) {
          retryCount++;
          const delay = OPENAI_CONFIG.retryDelayMs * Math.pow(2, retryCount - 1);
          await this.sleep(delay);
          continue;
        }
        break;
      }
    }

    console.error(`[OpenAIService] All retries exhausted. Last error:`, lastError);
    return {
      response: {
        thought: INITIAL_THOUGHT,
        reply: OPENAI_CONFIG.fallbackMessage,
        updatedData: { currentAgent: activeAgent },
        activeAgent: activeAgent
      },
      retryCount,
      wasRecovered: false
    };
  }

  async generateClinicalHandover(medicalData: MedicalData): Promise<SBAR> {
    if (medicalData.clinicalHandover) {
      return medicalData.clinicalHandover;
    }

    const prompt = `Generate a clinical SBAR (Situation, Background, Assessment, Recommendation) handover document based on the following patient intake data:\n\n${JSON.stringify(medicalData, null, 2)}\n\nReturn ONLY a JSON object with this exact structure:\n{\n  "situation": "Brief description of the current situation and chief complaint",\n  "background": "Relevant medical history, medications, allergies",\n  "assessment": "Clinical assessment based on the information gathered",\n  "recommendation": "Recommended next steps for the physician"\n}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000
      });

      const text = response.choices[0]?.message?.content || "";
      const parsed = this.parseJsonResponse(text);

      if (parsed && parsed.situation && parsed.background && parsed.assessment && parsed.recommendation) {
        return parsed as SBAR;
      }

      return {
        situation: medicalData.chiefComplaint || "Patient presenting for evaluation",
        background: [
          medicalData.pastMedicalHistory.length > 0 ? `PMH: ${medicalData.pastMedicalHistory.join(', ')}` : '',
          medicalData.medications.length > 0 ? `Medications: ${medicalData.medications.join(', ')}` : '',
          medicalData.allergies.length > 0 ? `Allergies: ${medicalData.allergies.join(', ')}` : '',
        ].filter(Boolean).join('. ') || "No significant medical history reported",
        assessment: medicalData.hpi || "Assessment pending physician review",
        recommendation: medicalData.ucgRecommendations || "Physician evaluation recommended"
      };
    } catch (error) {
      console.error("Failed to generate clinical handover:", error);
      return {
        situation: medicalData.chiefComplaint || "Patient presenting for evaluation",
        background: "Medical history collected during intake",
        assessment: "Assessment pending physician review",
        recommendation: "Physician evaluation recommended"
      };
    }
  }
}

export const openaiService = new OpenAIService();
