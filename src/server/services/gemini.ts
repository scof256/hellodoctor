import { GoogleGenAI } from "@google/genai";
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
const GEMINI_CONFIG = {
  timeoutMs: 30000,           // 30 second timeout
  maxAutoRetries: 2,          // Auto-retry empty responses up to 2 times
  retryDelayMs: 1000,         // Base delay between retries (exponential backoff)
  fallbackMessage: "I apologize, but I'm having trouble processing your message. Please try again.",
};

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

const AGENT_PROMPTS: Record<AgentRole, string> = {
  'VitalsTriageAgent': `
    You are the **Vitals & Basic Information Specialist Agent**.
    **Goal**: Collect patient name, age, gender, vital signs, and current status warmly and efficiently.
    **Technique**: The Gentle Onboarding - One question at a time.
    
    **CRITICAL: GREETING RECOGNITION**
    - If the user says "hi", "hello", "hey", "good morning", or any greeting, recognize it as a friendly greeting
    - DO NOT treat greetings as symptoms or medical information
    - Respond warmly to the greeting and immediately ask for their name
    - Example: User says "hi" → You respond: "Hello! Welcome to HelloDoctor. I'm here to help you today. To get started, what's your name?"
    
    **STRATEGY PROTOCOLS:**
    1. **Sequential Flow**: name → age → gender → temperature → weight → blood pressure → current status
    2. **One Question at a Time**: Never overwhelm the patient with multiple questions
    3. **Graceful Skipping**: Accept "I don't have it" or similar responses for vitals without judgment
    4. **Warm & Brief**: Keep responses to 2-3 sentences maximum
    5. **Reassurance**: Explicitly mention it's okay to skip vitals if they don't have equipment
    
    **STAGE DETECTION (Check in this order):**
    - If patientName is null/empty: Ask for their name warmly (this is ALWAYS the first question)
    - If patientAge is null: Ask for their age
    - If patientGender is null/empty: Ask for gender (offer: male, female, other, prefer not to say)
    - If temperature.value is null: Ask for temperature (mention it's okay to skip)
    - If weight.value is null: Ask for weight (mention it's okay to skip)
    - If bloodPressure.systolic is null: Ask for blood pressure (mention it's okay to skip)
    - If currentStatus is null/empty: Ask how they're feeling and about symptoms
    - If all collected: Thank them and set vitalsStageCompleted to true
    
    **IMPORTANT DATA UPDATES:**
    In your updatedData, include a "vitalsData" object with:
    - patientName, patientAge, patientGender (as collected)
    - temperature: { value: number, unit: "celsius" or "fahrenheit" }
    - weight: { value: number, unit: "kg" or "lbs" }
    - bloodPressure: { systolic: number, diastolic: number }
    - currentStatus: string (their symptoms/how they feel)
    - vitalsCollected: true (if any vitals were provided)
    - vitalsStageCompleted: true (when all questions asked or skipped)
    
    **TONE**: Warm, empathetic, patient-centered. Never rush. Never make them feel bad for not having vitals.
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
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

// --- TRACKING STATE INJECTION FUNCTIONS ---
// Removed complex tracking state injection - using simplified approach

/**
 * GeminiService - Simplified AI-powered medical intake service using Google's Gemini API.
 * Implements simplified A2A (Agent-to-Agent) orchestration with deterministic routing.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class GeminiService {
  private ai: GoogleGenAI;
  private model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.model = env.GEMINI_MODEL;
  }

  /**
   * Analyze a single image using Gemini's vision capabilities.
   */
  private async analyzeSingleImage(base64: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: "Analyze this medical image (lab result, scan, prescription, or symptom photo). Provide a concise professional clinical summary. If it's a medication, list the drug, dose, and frequency." }
          ]
        }
      });
      return response.text || "Image uploaded but analysis failed.";
    } catch (e) {
      console.warn("Image analysis failed", e);
      return "Error analyzing uploaded image.";
    }
  }

  /**
   * Send a message to the AI and get a response.
   * Simplified implementation without complex tracking state injection.
   * 
   * @param history - Chat history
   * @param currentMedicalData - Current state of medical data
   * @param mode - 'patient' for intake, 'doctor' for CDSS consultation
   * @returns AI response with updated medical data and retry metadata
   */
  async sendMessage(
    history: Message[],
    currentMedicalData: MedicalData,
    mode: 'patient' | 'doctor' = 'patient',
    trackingState?: TrackingState
  ): Promise<{ response: AgentResponse; groundingMetadata?: unknown; retryCount?: number; wasRecovered?: boolean }> {
    
    const lastUserMessage = history[history.length - 1];
    let imageAnalysisContext = "";

    // Process any images in the last message
    if (lastUserMessage?.role === 'user' && lastUserMessage.images && lastUserMessage.images.length > 0) {
      const analysisResults = [];
      const images = lastUserMessage.images;
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (image) {
          const result = await this.analyzeSingleImage(image);
          analysisResults.push(`[Image ${i+1} Analysis]: ${result}`);
        }
      }
      imageAnalysisContext = `\n\n**VISUAL DATA INPUT (${images.length} images):**\n${analysisResults.join('\n')}\n`;
    }

    // Build chat history for the AI
    const chatHistory = history.map(msg => {
      const isLast = msg.id === lastUserMessage?.id;
      return {
        role: msg.role === 'doctor' ? 'model' : msg.role,
        parts: [{ text: msg.text + (isLast ? imageAnalysisContext : "") }]
      };
    });

    let activeAgent: AgentRole = 'ClinicalInvestigator';
    let systemInstruction = "";

    if (mode === 'doctor') {
      // Doctor consultation mode (CDSS)
      systemInstruction = `
        You are HelloDoctor (CDSS Mode).
        Context: Chatting with a colleague.
        Data: ${JSON.stringify(currentMedicalData)}
        ${JSON_SCHEMA_INSTRUCTION}
      `;
    } else {
      // Patient intake mode - use simplified deterministic routing
      activeAgent = trackingState?.currentAgent ?? determineAgent(currentMedicalData);
      
      const basePrompt = AGENT_PROMPTS[activeAgent];
      const injectedPrompt = trackingState
        ? injectTrackingState(basePrompt, { ...trackingState, currentAgent: activeAgent })
        : basePrompt;
      
      systemInstruction = `
        ${injectedPrompt}
        
        **CONTEXTUAL DATA:**
        ${JSON.stringify(currentMedicalData, null, 2)}
      `;
    }

    // Implement auto-retry for empty responses with exponential backoff
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= GEMINI_CONFIG.maxAutoRetries) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: chatHistory,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.3,
          }
        });

        const text = response.text || "";
        console.log(`[GeminiService] Response text length: ${text.length}, retry: ${retryCount}`);
        const groundingMetadata = undefined; // No grounding when search is off

        // Simplified response processing - focus on reliable JSON extraction
        const parsedData = this.parseJsonResponse(text);

        if (parsedData) {
          return {
            response: {
              thought: parsedData.thought || INITIAL_THOUGHT,
              reply: parsedData.reply || parsedData.message || text || "Thinking...",
              updatedData: { ...parsedData.updatedData, currentAgent: activeAgent },
              activeAgent: activeAgent
            },
            groundingMetadata,
            retryCount,
            wasRecovered: retryCount > 0
          };
        }

        // Fallback for non-JSON responses
        return {
          response: {
            thought: INITIAL_THOUGHT,
            reply: text.length > 0 ? text : "I'm processing your information...",
            updatedData: { currentAgent: activeAgent },
            activeAgent: activeAgent
          },
          groundingMetadata,
          retryCount,
          wasRecovered: retryCount > 0
        };

      } catch (error) {
        lastError = error as Error;
        console.error(`[GeminiService] API Error (retry ${retryCount}):`, error);
        
        // For API errors, retry with backoff
        if (retryCount < GEMINI_CONFIG.maxAutoRetries) {
          retryCount++;
          const delay = GEMINI_CONFIG.retryDelayMs * Math.pow(2, retryCount - 1);
          console.log(`[GeminiService] Error occurred, retrying (${retryCount}/${GEMINI_CONFIG.maxAutoRetries}) after ${delay}ms`);
          await this.sleep(delay);
          continue;
        }
        break;
      }
    }

    // All retries exhausted - return fallback response
    console.error(`[GeminiService] All retries exhausted. Last error:`, lastError);
    return {
      response: {
        thought: INITIAL_THOUGHT,
        reply: GEMINI_CONFIG.fallbackMessage,
        updatedData: { currentAgent: activeAgent },
        activeAgent: activeAgent
      },
      groundingMetadata: undefined,
      retryCount,
      wasRecovered: false
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse JSON response from the AI, handling various formats.
   */
  parseJsonResponse(text: string): any {
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
   * Generate a clinical handover (SBAR) document from the medical data.
   * Called when intake reaches "ready" status.
   * 
   * Requirements: 7.6, 8.4
   */
  async generateClinicalHandover(medicalData: MedicalData): Promise<SBAR> {
    // If SBAR already exists in medical data, return it
    if (medicalData.clinicalHandover) {
      return medicalData.clinicalHandover;
    }

    const prompt = `
      Generate a clinical SBAR (Situation, Background, Assessment, Recommendation) handover document
      based on the following patient intake data:
      
      ${JSON.stringify(medicalData, null, 2)}
      
      Return ONLY a JSON object with this exact structure:
      {
        "situation": "Brief description of the current situation and chief complaint",
        "background": "Relevant medical history, medications, allergies",
        "assessment": "Clinical assessment based on the information gathered",
        "recommendation": "Recommended next steps for the physician"
      }
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { temperature: 0.2 }
      });

      const text = response.text || "";
      const parsed = this.parseJsonResponse(text);

      if (parsed && parsed.situation && parsed.background && parsed.assessment && parsed.recommendation) {
        return parsed as SBAR;
      }

      // Fallback: generate basic SBAR from available data
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
      // Return basic SBAR on error
      return {
        situation: medicalData.chiefComplaint || "Patient presenting for evaluation",
        background: "Medical history collected during intake",
        assessment: "Assessment pending physician review",
        recommendation: "Physician evaluation recommended"
      };
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
