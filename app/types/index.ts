export interface Message {
  id: string;
  role: 'user' | 'model' | 'doctor';
  text: string;
  images?: string[]; // base64 strings
  timestamp: Date;
  groundingMetadata?: any;
  activeAgent?: AgentRole;
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

export interface VitalSign<T> {
  value: T | null;
  unit: string;
  collectedAt: string | null;
}

export interface BloodPressureReading {
  systolic: number | null;
  diastolic: number | null;
  collectedAt: string | null;
}

export interface VitalsData {
  patientName: string | null;
  patientAge: number | null;
  patientGender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  vitalsCollected: boolean;
  temperature: VitalSign<number>;
  weight: VitalSign<number>;
  bloodPressure: BloodPressureReading;
  currentStatus: string | null;
  triageDecision: 'emergency' | 'normal' | 'pending';
  triageReason: string | null;
  vitalsStageCompleted: boolean;
}

export type AgentRole = 
  | 'VitalsTriageAgent'
  | 'Triage' 
  | 'ClinicalInvestigator' 
  | 'RecordsClerk' 
  | 'HistorySpecialist' 
  | 'HandoverSpecialist';

export const VALID_AGENT_ROLES: AgentRole[] = [
  'VitalsTriageAgent',
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
  'HandoverSpecialist'
];

export interface MedicalData {
  vitalsData: VitalsData;
  chiefComplaint: string | null;
  hpi: string | null;
  medicalRecords: string[];
  recordsCheckCompleted: boolean;
  historyCheckCompleted?: boolean;
  medications: string[];
  allergies: string[];
  pastMedicalHistory: string[];
  familyHistory: string | null;
  socialHistory: string | null;
  reviewOfSystems: string[];
  currentAgent: AgentRole;
  clinicalHandover: SBAR | null;
  ucgRecommendations: string | null;
  bookingStatus: 'collecting' | 'ready' | 'booked';
  appointmentDate?: string;
}

export type IntakeStage = 
  | 'vitals'
  | 'triage' 
  | 'investigation' 
  | 'records' 
  | 'profile' 
  | 'context' 
  | 'summary';


export interface DoctorThought {
  differentialDiagnosis: {
    condition: string;
    probability: string;
    reasoning: string;
  }[];
  missingInformation: string[];
  strategy: string;
  nextMove: string;
}

export interface AgentResponse {
  thought: DoctorThought;
  reply: string;
  updatedData: Partial<MedicalData>;
  activeAgent: AgentRole;
}

export const INITIAL_MEDICAL_DATA: MedicalData = {
  vitalsData: {
    patientName: null,
    patientAge: null,
    patientGender: null,
    vitalsCollected: false,
    temperature: {
      value: null,
      unit: 'celsius',
      collectedAt: null
    },
    weight: {
      value: null,
      unit: 'kg',
      collectedAt: null
    },
    bloodPressure: {
      systolic: null,
      diastolic: null,
      collectedAt: null
    },
    currentStatus: null,
    triageDecision: 'pending',
    triageReason: null,
    vitalsStageCompleted: false
  },
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
  currentAgent: 'VitalsTriageAgent',
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

// API Request/Response types
export interface ChatRequest {
  history: Message[];
  medicalData: MedicalData;
  mode: 'patient' | 'doctor';
}

export interface ChatResponse {
  response: AgentResponse;
  groundingMetadata?: any;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}
