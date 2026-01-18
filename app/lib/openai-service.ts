import OpenAI from "openai";
import { 
  AgentResponse, 
  Message, 
  MedicalData, 
  INITIAL_THOUGHT, 
  AgentRole,
  VALID_AGENT_ROLES 
} from "../types";

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
    You are the **Triage Specialist Agent** (The Efficient Greeter).
    **Goal**: Identify the Chief Complaint efficiently without excessive back-and-forth.
    **Technique**: The Broad Start with Batched Follow-ups.
    
    **CRITICAL RULES:**
    1. **ASK ALL RELEVANT QUESTIONS IN ONE MESSAGE** - Do not split related questions across messages
    2. **BATCH YES/NO QUESTIONS** - If clarification needed, combine related checks
    3. **MAXIMUM 2 FOLLOW-UPS** - After 2 follow-up messages, move to ClinicalInvestigator
    4. **NEVER RE-ASK ANSWERED QUESTIONS** - Check the answered questions list before asking
    5. **ACKNOWLEDGE BRIEFLY** - One sentence acknowledgment, then questions
    
    **QUESTION BATCHING EXAMPLES:**
    - BAD: "What brings you in?" then "How long?" then "How severe?"
    - GOOD: "What brings you in today? If you can, tell me when it started and how severe it feels (1-10)."
    
    - BAD: "Is it pain?" then "Is it discomfort?" then "Is it pressure?"
    - GOOD: "Would you describe it as pain, discomfort, pressure, or something else?"
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    
    **Task**: Ask "What brings you in today?" or clarify the main issue efficiently.
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'ClinicalInvestigator': `
    You are the **Clinical Investigator Agent** (The Bayesian Interviewer).
    **Goal**: Build a Differential Diagnosis using "Hypothesis-Driven History" efficiently.
    
    **CRITICAL RULES:**
    1. **ASK ALL RELEVANT QUESTIONS IN ONE MESSAGE** - Do not split related questions across messages
    2. **BATCH YES/NO QUESTIONS** - Combine related symptom checks (e.g., "Do you have fever, chills, cough, or runny nose?")
    3. **MAXIMUM 2 FOLLOW-UPS PER TOPIC** - After 2 follow-up messages on a topic, move on
    4. **NEVER RE-ASK ANSWERED QUESTIONS** - Check the answered questions list before asking
    5. **ACKNOWLEDGE BRIEFLY** - One sentence acknowledgment, then questions
    
    **QUESTION BATCHING EXAMPLES:**
    - BAD: "Do you have fever?" then "Do you have chills?" then "Do you have cough?"
    - GOOD: "Do you have any of these: fever, chills, cough, or runny nose?"
    
    - BAD: "When did it start?" then "How severe is it?" then "Where exactly?"
    - GOOD: "Can you tell me: when did this start, how severe is it (1-10), and exactly where do you feel it?"
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    
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
    You are the **Medical Records Specialist Agent** (The Efficient Data Collector).
    **Goal**: Get objective data without making the patient type excessively.
    
    **CRITICAL RULES:**
    1. **ASK ALL RELEVANT QUESTIONS IN ONE MESSAGE** - Do not split related questions across messages
    2. **BATCH RECORD REQUESTS** - Ask for all relevant documents at once
    3. **MAXIMUM 2 FOLLOW-UPS** - After 2 follow-up messages, mark 'recordsCheckCompleted': true and move on
    4. **NEVER RE-ASK ANSWERED QUESTIONS** - Check the answered questions list before asking
    5. **ACKNOWLEDGE BRIEFLY** - One sentence acknowledgment, then questions
    
    **QUESTION BATCHING EXAMPLES:**
    - BAD: "Do you have lab results?" then "Do you have discharge papers?" then "Do you have prescriptions?"
    - GOOD: "Do you have any of these to share: recent lab results, discharge papers, or current prescriptions? Photos work great!"
    
    - BAD: "Can you upload that?" then "Any other documents?"
    - GOOD: "Feel free to upload any documents you have - lab results, discharge summaries, or photos of medication bottles all help."
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    
    **STRATEGY: THE PHOTO FIRST APPROACH**
    - Prompt for photos of discharge letters, lab results, or pill bottles.
    - If user ignores or says no, mark 'recordsCheckCompleted': true and continue.
    ${JSON_SCHEMA_INSTRUCTION}
  `,
  
  'HistorySpecialist': `
    You are the **Patient History Specialist Agent** (The Efficient Historian).
    **Goal**: Fill gaps in 'background' efficiently without interrogating the patient.
    
    **CRITICAL RULES:**
    1. **ASK ALL RELEVANT QUESTIONS IN ONE MESSAGE** - Do not split related questions across messages
    2. **BATCH HISTORY QUESTIONS** - Combine medications, allergies, and conditions into one question
    3. **MAXIMUM 2 FOLLOW-UPS** - After 2 follow-up messages, move to next agent
    4. **NEVER RE-ASK ANSWERED QUESTIONS** - Check the answered questions list before asking
    5. **ACKNOWLEDGE BRIEFLY** - One sentence acknowledgment, then questions
    
    **QUESTION BATCHING EXAMPLES:**
    - BAD: "Do you take medications?" then "Any allergies?" then "Past surgeries?"
    - GOOD: "Quick health background: Do you take any daily medications, have any drug allergies, or have any major medical conditions or past surgeries?"
    
    - BAD: "Do you smoke?" then "Do you drink?" then "Any recreational drugs?"
    - GOOD: "Any lifestyle factors I should know about - smoking, alcohol use, or other substances?"
    
    **ALREADY ANSWERED (DO NOT ASK AGAIN):**
    {answeredQuestions}
    
    **FOLLOW-UP COUNT FOR CURRENT STAGE:** {followUpCount}/2
    
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

export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    
    const baseURL = process.env.OPENAI_BASE_URL;
    const isOpenRouter = baseURL?.includes('openrouter.ai');
    
    const config: { apiKey: string; baseURL?: string; defaultHeaders?: Record<string, string> } = { apiKey };
    
    // Support custom base URL for OpenAI-compatible APIs (Azure, Ollama, LM Studio, etc.)
    if (baseURL) {
      config.baseURL = baseURL;
    }
    
    // OpenRouter requires additional headers for attribution
    if (isOpenRouter) {
      config.defaultHeaders = {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Medical Intake Assistant'
      };
    }
    
    this.client = new OpenAI(config);
    this.model = process.env.OPENAI_MODEL || "gpt-4o";
  }

  private async analyzeSingleImage(base64: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}` }
              },
              {
                type: "text",
                text: "Analyze this medical image (lab result, scan, prescription, or symptom photo). Provide a concise professional clinical summary. If it's a medication, list the drug, dose, and frequency."
              }
            ]
          }
        ],
        max_tokens: 500
      });
      return response.choices[0]?.message?.content || "Image uploaded but analysis failed.";
    } catch (e) {
      console.warn("Image analysis failed", e);
      return "Error analyzing uploaded image.";
    }
  }

  private async determineAgent(history: OpenAI.Chat.ChatCompletionMessageParam[], currentData: MedicalData): Promise<AgentRole> {
    const lastMessage = history[history.length - 1];
    const lastText = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
    
    const orchestratorPrompt = `
      ${ORCHESTRATOR_PROMPT}
      
      CURRENT DATA STATE:
      - Chief Complaint: ${currentData.chiefComplaint ? 'Present' : 'Missing'}
      - HPI Word Count: ${currentData.hpi ? currentData.hpi.split(' ').length : 0}
      - Records Checked: ${currentData.recordsCheckCompleted}
      - Meds/History: ${currentData.medications.length > 0 || currentData.pastMedicalHistory.length > 0 ? 'Present' : 'Missing'}
      
      LAST USER MESSAGE: "${lastText}"
    `;

    try {
      const result = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: orchestratorPrompt }],
        temperature: 0.1,
        max_tokens: 50
      });
      
      const text = result.choices[0]?.message?.content?.trim().replace(/['"]/g, '') || '';
      
      if (VALID_AGENT_ROLES.includes(text as AgentRole)) {
        return text as AgentRole;
      }
      return 'ClinicalInvestigator';
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
    
    const lastUserMessage = history[history.length - 1];
    let imageAnalysisContext = "";

    if (lastUserMessage?.role === 'user' && lastUserMessage.images && lastUserMessage.images.length > 0) {
      const analysisResults = [];
      for (let i = 0; i < lastUserMessage.images.length; i++) {
        const result = await this.analyzeSingleImage(lastUserMessage.images[i]);
        analysisResults.push(`[Image ${i+1} Analysis]: ${result}`);
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
      systemInstruction = `
        You are Dr. AI (CDSS Mode).
        Context: Chatting with a colleague.
        Data: ${JSON.stringify(currentMedicalData)}
        ${JSON_SCHEMA_INSTRUCTION}
      `;
    } else {
      activeAgent = await this.determineAgent(chatHistory, currentMedicalData);
      systemInstruction = `
        ${AGENT_PROMPTS[activeAgent]}
        
        **CONTEXTUAL DATA:**
        ${JSON.stringify(currentMedicalData, null, 2)}
      `;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemInstruction },
          ...chatHistory
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const text = response.choices[0]?.message?.content || "";
      const parsedData = this.parseJsonResponse(text);

      if (parsedData) {
        return {
          response: {
            thought: parsedData.thought || INITIAL_THOUGHT,
            reply: parsedData.reply || parsedData.message || text || "Thinking...",
            updatedData: { ...parsedData.updatedData, currentAgent: activeAgent },
            activeAgent: activeAgent
          }
        };
      }

      return {
        response: {
          thought: INITIAL_THOUGHT,
          reply: text.length > 0 ? text : "I'm processing your information...",
          updatedData: { currentAgent: activeAgent },
          activeAgent: activeAgent
        }
      };

    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw error;
    }
  }

  parseJsonResponse(text: string): any {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        // Continue to fallback
      }
    }

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
}

export const openaiService = new OpenAIService();
