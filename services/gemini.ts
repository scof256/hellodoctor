
import { GoogleGenAI } from "@google/genai";
import { AgentResponse, Message, MedicalData, INITIAL_THOUGHT, AgentRole } from "../types";

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
    // CRITICAL: You can update ANY field. If you learn about smoking during the symptom check, update 'socialHistory' immediately.
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

// 1. ORCHESTRATOR (ROUTER)
const ORCHESTRATOR_PROMPT = `
You are the **A2A Orchestrator**. Analyze the intake state and ROUTE control to the correct Specialist Agent.

**AGENTS:**
1. **Triage**: Active ONLY if 'chiefComplaint' is missing.
2. **ClinicalInvestigator**: The primary engine. Active if symptoms are being explored.
   - *Logic*: Keep this active until the 'clinicalHandover.assessment' is robust. Do not switch to History if the clinical picture is vague.
3. **RecordsClerk**: Active if the user mentions having files/results, OR if 'recordsCheckCompleted' is false and the clinical investigation is stable.
4. **HistorySpecialist**: Active ONLY to fill gaps in Meds/Allergies/History that weren't caught during the investigation.
5. **HandoverSpecialist**: Active when SBAR is complete and Booking is ready.

**ROUTING RULES:**
- **Contextual Weaving Rule**: If the ClinicalInvestigator is currently exploring a symptom that requires social history (e.g., asking about smoking for a cough), KEEP ClinicalInvestigator active. Do not switch to HistorySpecialist yet.
- **Urgency Rule**: New symptoms always trigger **ClinicalInvestigator**.
- **Completion Rule**: If the patient says "I'm healthy, no other issues," move to HandoverSpecialist.

**OUTPUT:**
Return ONLY the Agent Name string: "Triage" | "ClinicalInvestigator" | "RecordsClerk" | "HistorySpecialist" | "HandoverSpecialist"
`;

// 2. SUB-AGENT PERSONAS
const AGENT_PROMPTS: Record<AgentRole, string> = {
  'Triage': `
    You are the **Triage Specialist Agent**.
    **Goal**: Identify the Chief Complaint efficiently.
    **Technique**: The Broad Start.
    **Task**: Ask "What brings you in today?" or clarify the main issue. 
    - If the user starts with a long story, extract the Chief Complaint and immediately pass to the Investigator.
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'ClinicalInvestigator': `
    You are the **Clinical Investigator Agent** (The Bayesian Interviewer).
    **Goal**: Build a Differential Diagnosis using "Hypothesis-Driven History".
    
    **STRATEGY PROTOCOLS (MUST FOLLOW):**
    1. **Hypothesis-Driven**: Before asking, list your top 3 differentials in the 'thought' JSON. Your question MUST be designed to rule one IN or OUT.
    2. **The Funnel**: Start open ("Tell me about the pain"), then rapid-fire closed ("Is it sharp?", "Does it radiate?").
    3. **Batched Questions**: NEVER ask one yes/no question at a time. Group them. 
       - *Bad*: "Do you have fever?" ... "Do you have chills?"
       - *Good*: "Have you noticed any fevers, chills, or night sweats?"
    4. **Signposting**: If you change topics, explain WHY to avoid annoying the patient.
       - *Example*: "I'm going to ask about your arm now to see if this chest pain is radiating."
    5. **Proxy Physical Exam**: You cannot touch. Guide the patient to do it.
       - *Palpation*: "Press gently on the lower right side. Does it hurt more when you push or let go?"
       - *Range of Motion*: "Raise your arms above your head. Does that trigger the pain?"
       - *Visual*: "Look in the mirror. are the whites of your eyes yellow?"
    6. **Contextual Weaving**: If a symptom links to history (e.g., Cough -> Smoking, Joint Pain -> Family History), ASK IT NOW. Update 'socialHistory' or 'familyHistory' immediately. Do not wait for the History agent.

    **DATA UPDATE TASK**:
    - Continuously update 'hpi' with the narrative.
    - Update 'clinicalHandover.assessment' with your evolving differentials.
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'RecordsClerk': `
    You are the **Medical Records Specialist Agent**.
    **Goal**: Get objective data without making the patient type.
    
    **STRATEGY: THE PHOTO FIRST APPROACH**
    - **Do not** ask the patient to list their meds or read lab values.
    - **Prompt**: "Do you have a discharge letter, recent lab result, or your pill bottles handy? If so, just snap a photo of them. I can read the details for you."
    - **Logic**: If the user ignores this or continues talking about symptoms, mark 'recordsCheckCompleted': true and answer their symptom question immediately. Do not block the flow.
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'HistorySpecialist': `
    You are the **Patient History Specialist Agent**.
    **Goal**: Fill the gaps in 'background' efficiently.
    
    **STRATEGY: THE BATCHED NEGATIVE (The "All-Clear")**
    - If the patient seems young/healthy, DO NOT ask 5 separate questions.
    - **The Prompt**: "To wrap up your file: do you have any major medical conditions, take daily medications, or have drug allergies? Or are you generally healthy?"
    - **Logic**: 
      - If they say "Healthy/No": Set Meds=[], Allergies=[], PMH=[] in one go.
      - If they list specific meds: Update 'medications' and infer the 'pastMedicalHistory' (e.g., Metformin -> Diabetes).
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'HandoverSpecialist': `
    You are the **Senior Attending Agent**.
    **Goal**: Quality Control, SBAR Generation, and Booking.
    **Task**: 
    - **Passive ROS**: Scan the entire chat history. Did they mention "fever" in the beginning? Ensure it's in the SBAR.
    - **Final Sweep**: "Aside from what we discussed, is there anything else worrying you?"
    - **Action**: If SBAR is solid, set 'bookingStatus': 'ready'.
    - **UCG Protocol**: Populate 'ucgRecommendations' with the specific Uganda Clinical Guideline for the top differential.
    ${JSON_SCHEMA_INSTRUCTION}
  `
};

export class GeminiService {
  private ai: GoogleGenAI;
  private model: string = "gemini-3-flash-preview";

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Helper: Analyze a single image textually
  private async analyzeSingleImage(base64: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64 } },
            { text: "Analyze this medical image (lab result, scan, prescription, or symptom photo). Provide a concise professional clinical summary of findings. If it's a medication, list the drug, dose, and frequency." }
          ]
        }
      });
      return response.text || "Image uploaded but analysis failed.";
    } catch (e) {
      console.warn("Image analysis failed", e);
      return "Error analyzing uploaded image.";
    }
  }

  // --- THE ORCHESTRATOR ---
  private async determineAgent(history: any[], currentData: MedicalData): Promise<AgentRole> {
    const orchestratorPrompt = `
      ${ORCHESTRATOR_PROMPT}
      
      CURRENT DATA STATE:
      - Chief Complaint: ${currentData.chiefComplaint ? 'Present' : 'Missing'}
      - HPI Word Count: ${currentData.hpi ? currentData.hpi.split(' ').length : 0}
      - Records Checked: ${currentData.recordsCheckCompleted}
      - Meds/History: ${currentData.medications.length > 0 || currentData.pastMedicalHistory.length > 0 ? 'Present' : 'Missing'}
      
      LAST USER MESSAGE: "${history[history.length - 1].parts[0].text}"
    `;

    try {
      // Fast call to determine routing
      const result = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: orchestratorPrompt }] }],
        config: { temperature: 0.1 }
      });
      
      const text = result.text?.trim()?.replace(/['"]/g, '') ?? '';
      const validRoles: AgentRole[] = ['Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist'];
      
      // Validation with fallback
      if (validRoles.includes(text as AgentRole)) {
        return text as AgentRole;
      }
      return 'ClinicalInvestigator'; // Fallback
    } catch (e) {
      console.error("Orchestrator failed, defaulting to Investigator", e);
      return 'ClinicalInvestigator';
    }
  }

  async sendMessage(
    history: Message[],
    currentMedicalData: MedicalData,
    mode: 'patient' | 'doctor' = 'patient'
  ): Promise<{ response: AgentResponse; groundingMetadata?: any }> {
    
    // --- STEP 1: Pre-process Images ---
    const lastUserMessage = history[history.length - 1];
    let imageAnalysisContext = "";

    if (lastUserMessage.role === 'user' && lastUserMessage.images && lastUserMessage.images.length > 0) {
       let analysisResults = [];
       for (let i = 0; i < lastUserMessage.images.length; i++) {
          const imgBase64 = lastUserMessage.images[i];
          const result = await this.analyzeSingleImage(imgBase64);
          analysisResults.push(`[Image ${i+1} Analysis]: ${result}`);
       }
       imageAnalysisContext = `\n\n**VISUAL DATA INPUT (${lastUserMessage.images.length} images):**\n${analysisResults.join('\n')}\n`;
    }

    // --- STEP 2: Prepare Chat History for API ---
    const chatHistory = history.map(msg => {
      const isLast = msg.id === lastUserMessage.id;
      return {
        role: msg.role === 'doctor' ? 'model' : msg.role,
        parts: [{ text: msg.text + (isLast ? imageAnalysisContext : "") }]
      };
    });

    let activeAgent: AgentRole = 'ClinicalInvestigator';
    let systemInstruction = "";

    if (mode === 'doctor') {
      // Doctor mode bypasses A2A routing, acts as a Clinical Decision Support System
      systemInstruction = `
        You are HelloDoctor (CDSS Mode).
        Context: Chatting with a colleague.
        Data: ${JSON.stringify(currentMedicalData)}
        ${JSON_SCHEMA_INSTRUCTION}
      `;
    } else {
      // --- STEP 3: EXECUTE A2A PROTOCOL (PATIENT MODE) ---
      
      // 3a. Call Orchestrator
      activeAgent = await this.determineAgent(chatHistory, currentMedicalData);
      
      // 3b. Load Sub-Agent Persona
      systemInstruction = `
        ${AGENT_PROMPTS[activeAgent]}
        
        **CONTEXTUAL DATA:**
        ${JSON.stringify(currentMedicalData, null, 2)}
      `;
    }

    // --- STEP 4: GENERATE CONTENT ---
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: chatHistory,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
          // tools: [{ googleSearch: {} }] // Grounding disabled
        }
      });

      const text = response.text || "";
      // Grounding disabled - set to undefined
      const groundingMetadata = undefined;

      // --- STEP 5: PARSE JSON ---
      let parsedData: any = null;
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try { parsedData = JSON.parse(jsonMatch[1]); } catch (e) {}
      } else {
        // Fallback brace matching
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
           try { parsedData = JSON.parse(text.substring(firstBrace, lastBrace + 1)); } catch (e) {}
        }
      }

      if (parsedData) {
          return {
              response: {
                  thought: parsedData.thought || INITIAL_THOUGHT,
                  reply: parsedData.reply || parsedData.message || (text.length > 0 ? text : "Thinking..."), 
                  updatedData: { ...parsedData.updatedData, currentAgent: activeAgent },
                  activeAgent: activeAgent
              },
              groundingMetadata
          };
      }

      // Fallback if model fails JSON
      return {
          response: {
            thought: INITIAL_THOUGHT,
            reply: text.length > 0 ? text : "I'm processing your information...",
            updatedData: { currentAgent: activeAgent },
            activeAgent: activeAgent
          },
          groundingMetadata
      };

    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
