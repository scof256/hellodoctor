import { GoogleGenAI } from "@google/genai";
import { 
  AgentResponse, 
  Message, 
  MedicalData, 
  INITIAL_THOUGHT, 
  AgentRole
} from "../types";
import { determineAgent } from "./agent-router";

// --- SIMPLIFIED A2A PROTOCOL DEFINITIONS ---

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

// Simplified agent prompts based on working demo
const AGENT_PROMPTS: Record<AgentRole, string> = {
  'Triage': `
    You are the **Triage Specialist Agent**.
    **Goal**: Identify the Chief Complaint efficiently.
    **Technique**: The Broad Start.
    **Task**: Ask "What brings you in today?" or clarify the main issue.
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
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'RecordsClerk': `
    You are the **Medical Records Specialist Agent**.
    **Goal**: Get objective data without making the patient type.
    **STRATEGY: THE PHOTO FIRST APPROACH**
    - Prompt for photos of discharge letters, lab results, or pill bottles.
    - If user ignores, mark 'recordsCheckCompleted': true and continue.
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'HistorySpecialist': `
    You are the **Patient History Specialist Agent**.
    **Goal**: Fill gaps in 'background' efficiently.
    **STRATEGY: THE BATCHED NEGATIVE**
    - Ask: "Do you have any major medical conditions, take daily medications, or have drug allergies?"
    - If "Healthy/No": Set Meds=[], Allergies=[], PMH=[] in one go.
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


export class GeminiService {
  private ai: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  }

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

  async sendMessage(
    history: Message[],
    currentMedicalData: MedicalData,
    mode: 'patient' | 'doctor' = 'patient'
  ): Promise<{ response: AgentResponse; groundingMetadata?: any }> {
    
    const lastUserMessage = history[history.length - 1];
    let imageAnalysisContext = "";

    // Process any images in the last message
    if (lastUserMessage?.role === 'user' && lastUserMessage.images && lastUserMessage.images.length > 0) {
      const analysisResults = [];
      for (let i = 0; i < lastUserMessage.images.length; i++) {
        const result = await this.analyzeSingleImage(lastUserMessage.images[i]);
        analysisResults.push(`[Image ${i+1} Analysis]: ${result}`);
      }
      imageAnalysisContext = `\n\n**VISUAL DATA INPUT (${lastUserMessage.images.length} images):**\n${analysisResults.join('\n')}\n`;
    }

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
      activeAgent = determineAgent(currentMedicalData);
      systemInstruction = `
        ${AGENT_PROMPTS[activeAgent]}
        
        **CONTEXTUAL DATA:**
        ${JSON.stringify(currentMedicalData, null, 2)}
      `;
    }

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
      const groundingMetadata = undefined; // No grounding when search is off

      const parsedData = this.parseJsonResponse(text);

      if (parsedData) {
        return {
          response: {
            thought: parsedData.thought || INITIAL_THOUGHT,
            reply: parsedData.reply || parsedData.message || text || "Thinking...",
            updatedData: { ...parsedData.updatedData, currentAgent: activeAgent },
            activeAgent: activeAgent
          },
          groundingMetadata
        };
      }

      // Fallback response processing
      return {
        response: {
          thought: INITIAL_THOUGHT,
          reply: this.extractPlainTextFallback(text) || "I'm processing your information...",
          updatedData: { currentAgent: activeAgent },
          activeAgent: activeAgent
        },
        groundingMetadata
      };

    } catch (error) {
      console.error("Gemini API Error:", error);
      
      // Fallback error response
      return {
        response: {
          thought: INITIAL_THOUGHT,
          reply: "I apologize, but I'm having trouble processing your message. Please try again.",
          updatedData: { currentAgent: activeAgent },
          activeAgent: activeAgent
        },
        groundingMetadata: undefined
      };
    }
  }

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
   * Extract plain text content when JSON parsing fails
   */
  private extractPlainTextFallback(text: string): string | null {
    // Remove code blocks
    let cleaned = text.replace(/```[\s\S]*?```/g, '').trim();
    
    // Remove JSON-like content
    cleaned = cleaned.replace(/\{[\s\S]*\}/g, '').trim();
    
    // If we have meaningful content left, use it
    if (cleaned.length > 10) {
      // Truncate if too long
      return cleaned.length > 500 ? cleaned.substring(0, 500) + '...' : cleaned;
    }

    // Try to extract any sentence-like content from original
    const sentences = text.match(/[A-Z][^.!?]*[.!?]/g);
    if (sentences && sentences.length > 0) {
      return sentences.slice(0, 3).join(' ');
    }

    return null;
  }
}

export const geminiService = new GeminiService();
