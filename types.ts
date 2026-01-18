
export interface Message {
  id: string;
  role: 'user' | 'model' | 'doctor';
  text: string;
  images?: string[]; // base64 strings
  timestamp: Date;
  groundingMetadata?: any;
  activeAgent?: AgentRole; // Visual indicator of which sub-agent generated this
}

export interface DirectMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: Date;
  read: boolean;
}

export interface SBAR {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export type AgentRole = 'Triage' | 'ClinicalInvestigator' | 'RecordsClerk' | 'HistorySpecialist' | 'HandoverSpecialist';

export interface MedicalData {
  chiefComplaint: string | null;
  hpi: string | null; // History of Present Illness
  medicalRecords: string[]; // Findings from uploaded docs/images
  recordsCheckCompleted: boolean; // Flag to track if we have finished asking/collecting records
  historyCheckCompleted?: boolean;
  medications: string[];
  allergies: string[];
  pastMedicalHistory: string[];
  familyHistory: string | null;
  socialHistory: string | null;
  reviewOfSystems: string[];
  
  // A2A State
  currentAgent: AgentRole;
  
  // New fields for Appointment & Analysis
  clinicalHandover: SBAR | null; // The professional analysis structured as SBAR
  ucgRecommendations: string | null; // Treatment based on Uganda Clinical Guidelines
  bookingStatus: 'collecting' | 'ready' | 'booked';
  appointmentDate?: string;
}

export type IntakeStage = 'triage' | 'investigation' | 'records' | 'profile' | 'context' | 'summary';

export interface DoctorThought {
  differentialDiagnosis: { condition: string; probability: string; reasoning: string }[];
  missingInformation: string[];
  strategy: string; // e.g., "Funneling", "Signposting", "Batched Negative"
  nextMove: string;
}

export interface AgentResponse {
  thought: DoctorThought;
  reply: string;
  updatedData: Partial<MedicalData>;
  activeAgent: AgentRole;
}

export const INITIAL_MEDICAL_DATA: MedicalData = {
  chiefComplaint: null,
  hpi: null,
  medicalRecords: [],
  recordsCheckCompleted: false,
  historyCheckCompleted: false,
  medications: [],
  allergies: [],
  pastMedicalHistory: [],
  familyHistory: null,
  socialHistory: null,
  reviewOfSystems: [],
  currentAgent: 'Triage',
  clinicalHandover: null,
  ucgRecommendations: null,
  bookingStatus: 'collecting'
};

export const INITIAL_THOUGHT: DoctorThought = {
  differentialDiagnosis: [],
  missingInformation: ["Chief Complaint"],
  strategy: "A2A Handshake: Triage Agent",
  nextMove: "Identify Chief Complaint"
};
