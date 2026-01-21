// User Roles
export type UserRole = 'super_admin' | 'doctor' | 'clinic_admin' | 'receptionist' | 'patient';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type ConnectionStatus = 'active' | 'disconnected' | 'blocked';
export type IntakeStatus = 'not_started' | 'in_progress' | 'ready' | 'reviewed';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// Stream Video Integration Types
export interface StreamMetadata {
  doctorName: string;
  patientName: string;
  appointmentType: string;
  [key: string]: unknown;
}

// Stream participant data
export interface StreamParticipant {
  user_id: string;
  name: string;
  image?: string;
  role: 'doctor' | 'patient';
}

// Stream call configuration
export interface StreamCallConfig {
  callId: string;
  callType: 'default';
  participants: StreamParticipant[];
  settings: {
    audio: { mic_default_on: boolean };
    video: { camera_default_on: boolean };
    screenshare: { enabled: boolean };
    recording: { mode: 'disabled' | 'available' };
  };
}

// Agent roles from existing demo
export type AgentRole = 
  | 'Triage' 
  | 'ClinicalInvestigator' 
  | 'RecordsClerk' 
  | 'HistorySpecialist' 
  | 'HandoverSpecialist';

export const VALID_AGENT_ROLES: AgentRole[] = [
  'Triage',
  'ClinicalInvestigator',
  'RecordsClerk',
  'HistorySpecialist',
  'HandoverSpecialist'
];

// SBAR Clinical Handover
export interface SBAR {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

// Medical Data from intake
export interface MedicalData {
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
  doctorNotes?: string; // Doctor enhancements (test results, exam findings, notes)
}

// Doctor's clinical reasoning
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

// AI Agent Response
export interface AgentResponse {
  thought: DoctorThought;
  reply: string;
  updatedData: Partial<MedicalData>;
  activeAgent: AgentRole;
}

// Context layer for separating patient intake from doctor enhancements
export type ContextLayer = 'patient-intake' | 'doctor-enhancement';

// Chat Message
export interface Message {
  id: string;
  role: 'user' | 'model' | 'doctor';
  text: string;
  images?: string[];
  timestamp: Date;
  groundingMetadata?: unknown;
  activeAgent?: AgentRole;
  contextLayer?: ContextLayer; // Separates patient-generated intake from doctor enhancements
}

// Message status for optimistic updates and retry functionality
// 'permanently_failed' is used when max retries have been reached
export type MessageStatus = 'sending' | 'sent' | 'failed' | 'permanently_failed';

// Extended message type with status tracking for UI
export interface MessageWithStatus extends Message {
  status: MessageStatus;
  tempId?: string;      // Temporary ID used before server confirmation
  error?: string;       // Error message if status is 'failed'
  retryCount?: number;  // Number of retry attempts
}

// Pending message in the queue waiting to be sent
export interface PendingMessage {
  tempId: string;
  content: string;
  images?: string[];
  timestamp: Date;
  retryCount: number;
}

// Failed message with error details
export interface FailedMessage extends PendingMessage {
  error: string;
  lastAttempt: Date;
}

// Initial states
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

// Intake stage for progress tracking
export type IntakeStage = 
  | 'triage' 
  | 'investigation' 
  | 'records' 
  | 'profile' 
  | 'context' 
  | 'summary';

// Follow-up counts per stage (Requirements: 2.1, 2.4)
export type FollowUpCounts = Record<string, number>;

// Maximum follow-ups allowed per stage before moving on
export const MAX_FOLLOWUPS_PER_STAGE = 2;

// Question optimization tracking state
export interface QuestionTrackingState {
  followUpCounts: FollowUpCounts;
  answeredTopics: string[];
  consecutiveErrors: number;
}

// Initial question tracking state
export const INITIAL_QUESTION_TRACKING: QuestionTrackingState = {
  followUpCounts: {},
  answeredTopics: [],
  consecutiveErrors: 0,
};

// --- TRACKING STATE FOR A2A PROTOCOL ---
// Requirements: 1.1, 1.3, 1.4 - Agent Protocol Fix

/**
 * Tracking state passed to AI service for context-aware agent prompts.
 * Contains all information needed for agents to make intelligent decisions
 * about what questions to ask and when to advance stages.
 */
export interface TrackingState {
  /** Follow-up counts per stage/agent */
  followUpCounts: FollowUpCounts;
  /** List of topics already answered by patient */
  answeredTopics: string[];
  /** Total number of AI messages sent in this session */
  aiMessageCount: number;
  /** Current intake completeness percentage (0-100) */
  completeness: number;
  /** Currently active agent */
  currentAgent: AgentRole;
}

/**
 * Default tracking state for backward compatibility.
 * Used when trackingState is not provided to sendAIMessage.
 */
export const DEFAULT_TRACKING_STATE: TrackingState = {
  followUpCounts: {},
  answeredTopics: [],
  aiMessageCount: 0,
  completeness: 0,
  currentAgent: 'Triage',
};
