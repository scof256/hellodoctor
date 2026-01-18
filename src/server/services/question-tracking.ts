/**
 * Question Tracking Service
 * 
 * Implements follow-up counting, answered topic tracking, and termination
 * detection to reduce patient irritation from excessive questions.
 * 
 * Requirements: 1.2, 2.1, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.3, 6.1, 6.2
 */

import type { FollowUpCounts, AgentRole } from '@/types';
import { MAX_FOLLOWUPS_PER_STAGE } from '@/types';

// --- TERMINATION DETECTION CONFIGURATION ---
// Requirements: 1.2, 3.3, 6.1, 6.2

/**
 * Categorized termination phrases for detecting patient intent to end intake.
 */
export const TERMINATION_PHRASES = {
  /** Phrases indicating patient has shared all information */
  completion: [
    "that's all", "thats all", "that is all",
    "nothing else", "no more", "i'm done", "im done",
    "that's it", "thats it", "no other", "nothing more",
    "i think that's everything", "that covers it",
    "i'm healthy", "im healthy", "no issues", "no problems",
    "no concerns", "that's everything", "thats everything"
  ],
  /** Phrases explicitly requesting to finish/book */
  explicit_finish: [
    "can we wrap up", "i want to book", "let's book", "lets book",
    "ready to book", "finish up", "wrap this up",
    "i'm ready", "im ready", "book now", "schedule now",
    "can i book", "want to schedule", "ready for appointment"
  ],
  /** Commands to skip current section */
  skip: ["skip", "next", "move on", "next question", "next section"],
  /** Commands to end intake immediately */
  done: ["done", "finish", "end", "complete", "stop", "enough"]
} as const;

/**
 * Phrases indicating uncertainty - system should accept and move on.
 * Requirements: 3.1
 */
export const UNCERTAINTY_PHRASES = [
  "i don't know", "i dont know", "not sure", "unsure",
  "no idea", "can't remember", "cant remember",
  "i forget", "maybe", "possibly", "i think so",
  "not certain", "hard to say", "difficult to say"
] as const;

/**
 * Negative responses - mark topic as answered and don't re-ask.
 * Requirements: 3.2
 */
export const NEGATIVE_RESPONSES = [
  "no", "none", "nothing", "nope", "n/a", "na",
  "not really", "not that i know of", "negative",
  "no i don't", "no i dont", "i don't think so",
  "i dont think so", "not at all",
  // Additional patterns for records/documents
  "i don't have any", "i dont have any", "don't have any", "dont have any",
  "i have none", "have none", "i have no", "have no",
  "i don't have", "i dont have", "don't have", "dont have",
  // Proceed/skip patterns
  "proceed", "skip", "move on", "next", "continue",
  "no records", "no documents", "no files", "no photos",
  "nothing to upload", "nothing to share"
] as const;

/**
 * Message count limits for intake duration control.
 * Requirements: 4.1, 4.2
 */
export const MESSAGE_LIMITS = {
  /** Offer to conclude at this many AI messages */
  OFFER_CONCLUSION: 15,
  /** Force transition to HandoverSpecialist at this many AI messages */
  FORCE_HANDOVER: 20,
} as const;

/**
 * Result of termination signal detection.
 */
export interface TerminationResult {
  /** Whether a termination signal was detected */
  shouldTerminate: boolean;
  /** The type of termination signal detected */
  reason: 'completion_phrase' | 'explicit_request' | 'skip_command' | 'done_command' | 'message_limit' | 'completeness_threshold' | null;
  /** The agent to transition to (if applicable) */
  targetAgent: AgentRole | null;
  /** Acknowledgment message to show the patient */
  acknowledgment: string | null;
}

/**
 * Detect termination signals in a patient message.
 * Checks for completion phrases, explicit finish requests, skip/done commands,
 * message limits, and completeness thresholds.
 * 
 * Requirements: 1.2, 2.1, 3.3, 4.1, 4.2, 6.1, 6.2
 */
export function detectTerminationSignal(
  message: string,
  currentAgent: AgentRole,
  aiMessageCount: number,
  completeness: number,
  hasChiefComplaint: boolean,
  hasHpi: boolean
): TerminationResult {
  const lowerMessage = message.toLowerCase().trim();
  
  // Priority 1: Check for explicit "done" commands (highest priority)
  if (TERMINATION_PHRASES.done.some(phrase => lowerMessage === phrase || lowerMessage.startsWith(phrase + ' '))) {
    return {
      shouldTerminate: true,
      reason: 'done_command',
      targetAgent: 'HandoverSpecialist',
      acknowledgment: "Wrapping up your intake. Let me prepare your summary..."
    };
  }
  
  // Priority 2: Check for "skip" commands
  if (TERMINATION_PHRASES.skip.some(phrase => lowerMessage === phrase || lowerMessage.startsWith(phrase + ' '))) {
    const nextAgent = getNextAgentOnLimitReached(currentAgent);
    return {
      shouldTerminate: true,
      reason: 'skip_command',
      targetAgent: nextAgent,
      acknowledgment: `Skipping to ${nextAgent === 'HandoverSpecialist' ? 'final review' : 'next section'}...`
    };
  }
  
  // Priority 3: Check for explicit finish requests
  if (TERMINATION_PHRASES.explicit_finish.some(phrase => lowerMessage.includes(phrase))) {
    return {
      shouldTerminate: true,
      reason: 'explicit_request',
      targetAgent: 'HandoverSpecialist',
      acknowledgment: "Great! Let me wrap up your intake and prepare for booking..."
    };
  }
  
  // Priority 4: Check for completion phrases
  if (TERMINATION_PHRASES.completion.some(phrase => lowerMessage.includes(phrase))) {
    // If completeness >= 60% or we have essential data, allow termination
    if (completeness >= 60 || (hasChiefComplaint && hasHpi)) {
      return {
        shouldTerminate: true,
        reason: 'completion_phrase',
        targetAgent: 'HandoverSpecialist',
        acknowledgment: null // Let AI handle the transition naturally
      };
    }
  }
  
  // Priority 5: Check message limit - force handover at 20 messages
  if (aiMessageCount >= MESSAGE_LIMITS.FORCE_HANDOVER && currentAgent !== 'HandoverSpecialist') {
    return {
      shouldTerminate: true,
      reason: 'message_limit',
      targetAgent: 'HandoverSpecialist',
      acknowledgment: "I have enough information to proceed. Let me summarize what we've discussed..."
    };
  }
  
  // Priority 6: Check completeness threshold - offer conclusion at 80%
  if (completeness >= 80 && currentAgent !== 'HandoverSpecialist') {
    return {
      shouldTerminate: true,
      reason: 'completeness_threshold',
      targetAgent: 'HandoverSpecialist',
      acknowledgment: null // Let AI offer to conclude naturally
    };
  }
  
  // No termination signal detected
  return {
    shouldTerminate: false,
    reason: null,
    targetAgent: null,
    acknowledgment: null
  };
}

/**
 * Check if message limit suggests offering conclusion (15 messages).
 * Requirements: 4.1
 */
export function shouldOfferConclusion(aiMessageCount: number): boolean {
  return aiMessageCount >= MESSAGE_LIMITS.OFFER_CONCLUSION && aiMessageCount < MESSAGE_LIMITS.FORCE_HANDOVER;
}

/**
 * Check if message limit requires forcing handover (20 messages).
 * Requirements: 4.2
 */
export function shouldForceHandover(aiMessageCount: number): boolean {
  return aiMessageCount >= MESSAGE_LIMITS.FORCE_HANDOVER;
}

/**
 * Detect if message contains an uncertainty phrase.
 * Requirements: 3.1
 */
export function detectUncertaintyPhrase(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return UNCERTAINTY_PHRASES.some(phrase => lowerMessage.includes(phrase));
}

/**
 * Detect if message is a negative response.
 * Requirements: 3.2
 */
export function detectNegativeResponse(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  // Check for exact matches or phrases that start with negative responses
  return NEGATIVE_RESPONSES.some(phrase => 
    lowerMessage === phrase || 
    lowerMessage.startsWith(phrase + ' ') ||
    lowerMessage.startsWith(phrase + ',') ||
    lowerMessage.startsWith(phrase + '.')
  );
}

/**
 * Check if a message is brief (< 10 characters) indicating minimal response.
 * Requirements: 5.2
 */
export function isBriefResponse(message: string): boolean {
  return message.trim().length < 10;
}

// Map agent roles to intake stages for tracking
const AGENT_TO_STAGE: Record<AgentRole, string> = {
  'Triage': 'triage',
  'ClinicalInvestigator': 'symptoms',
  'RecordsClerk': 'records',
  'HistorySpecialist': 'history',
  'HandoverSpecialist': 'review',
};

/**
 * Get the current follow-up count for a stage.
 * Requirements: 2.4
 */
export function getFollowUpCount(
  followUpCounts: FollowUpCounts,
  stage: string
): number {
  return followUpCounts[stage] ?? 0;
}

/**
 * Get follow-up count for an agent role.
 * Requirements: 2.4
 */
export function getFollowUpCountForAgent(
  followUpCounts: FollowUpCounts,
  agent: AgentRole
): number {
  const stage = AGENT_TO_STAGE[agent];
  return getFollowUpCount(followUpCounts, stage);
}

/**
 * Increment the follow-up count for a stage.
 * Returns a new FollowUpCounts object (immutable).
 * Requirements: 2.4
 */
export function incrementFollowUpCount(
  followUpCounts: FollowUpCounts,
  stage: string
): FollowUpCounts {
  return {
    ...followUpCounts,
    [stage]: (followUpCounts[stage] ?? 0) + 1,
  };
}

/**
 * Increment follow-up count for an agent role.
 * Requirements: 2.4
 */
export function incrementFollowUpCountForAgent(
  followUpCounts: FollowUpCounts,
  agent: AgentRole
): FollowUpCounts {
  const stage = AGENT_TO_STAGE[agent];
  return incrementFollowUpCount(followUpCounts, stage);
}

/**
 * Reset the follow-up count for a stage (when new info is provided).
 * Returns a new FollowUpCounts object (immutable).
 * Requirements: 2.2
 */
export function resetFollowUpCount(
  followUpCounts: FollowUpCounts,
  stage: string
): FollowUpCounts {
  const newCounts = { ...followUpCounts };
  delete newCounts[stage];
  return newCounts;
}

/**
 * Check if the follow-up limit has been reached for a stage.
 * Requirements: 2.1
 */
export function isFollowUpLimitReached(
  followUpCounts: FollowUpCounts,
  stage: string
): boolean {
  return getFollowUpCount(followUpCounts, stage) >= MAX_FOLLOWUPS_PER_STAGE;
}

/**
 * Check if follow-up limit reached for an agent role.
 * Requirements: 2.1
 */
export function isFollowUpLimitReachedForAgent(
  followUpCounts: FollowUpCounts,
  agent: AgentRole
): boolean {
  const stage = AGENT_TO_STAGE[agent];
  return isFollowUpLimitReached(followUpCounts, stage);
}

/**
 * Get the next agent when follow-up limit is reached.
 * Requirements: 2.3
 */
export function getNextAgentOnLimitReached(currentAgent: AgentRole): AgentRole {
  const agentOrder: AgentRole[] = [
    'Triage',
    'ClinicalInvestigator',
    'RecordsClerk',
    'HistorySpecialist',
    'HandoverSpecialist',
  ];
  
  const currentIndex = agentOrder.indexOf(currentAgent);
  if (currentIndex === -1 || currentIndex >= agentOrder.length - 1) {
    return 'HandoverSpecialist';
  }
  
  const nextAgent = agentOrder[currentIndex + 1];
  return nextAgent ?? 'HandoverSpecialist';
}

// --- Answered Topics Tracking ---

/**
 * Mark a topic as answered.
 * Returns a new array (immutable).
 * Requirements: 3.4
 */
export function markTopicAnswered(
  answeredTopics: string[],
  topic: string
): string[] {
  if (answeredTopics.includes(topic)) {
    return answeredTopics;
  }
  return [...answeredTopics, topic];
}

/**
 * Mark multiple topics as answered.
 * Requirements: 3.4
 */
export function markTopicsAnswered(
  answeredTopics: string[],
  topics: string[]
): string[] {
  const newTopics = topics.filter(t => !answeredTopics.includes(t));
  if (newTopics.length === 0) {
    return answeredTopics;
  }
  return [...answeredTopics, ...newTopics];
}

/**
 * Check if a topic has been answered.
 * Requirements: 3.1
 */
export function isTopicAnswered(
  answeredTopics: string[],
  topic: string
): boolean {
  return answeredTopics.includes(topic);
}

/**
 * Extract answered topics from a patient message.
 * Looks for common symptom/history keywords.
 * Requirements: 3.4
 */
export function extractAnsweredTopics(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const topics: string[] = [];
  
  // Symptom-related topics
  const symptomKeywords: Record<string, string[]> = {
    'fever': ['fever', 'temperature', 'hot', 'burning up'],
    'chills': ['chills', 'shivering', 'cold'],
    'cough': ['cough', 'coughing'],
    'congestion': ['runny nose', 'stuffy', 'congestion', 'blocked nose'],
    'headache': ['headache', 'head pain', 'head hurts'],
    'fatigue': ['tired', 'fatigue', 'exhausted', 'weak'],
    'nausea': ['nausea', 'nauseous', 'sick to stomach'],
    'pain': ['pain', 'hurts', 'ache', 'sore'],
    'rash': ['rash', 'skin', 'spots', 'bumps'],
    'swelling': ['swelling', 'swollen', 'lumps', 'lymph nodes'],
  };
  
  for (const [topic, keywords] of Object.entries(symptomKeywords)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      topics.push(topic);
    }
  }
  
  // Negative responses - mark as answered even if negative
  const negativePatterns = [
    /no (fever|chills|cough|headache|nausea|rash|swelling)/gi,
    /don'?t have (fever|chills|cough|headache|nausea|rash|swelling)/gi,
    /haven'?t (had|been)/gi,
  ];
  
  for (const pattern of negativePatterns) {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      for (const match of matches) {
        const symptom = match.replace(/no |don'?t have |haven'?t (had|been) /gi, '').trim();
        if (symptom && !topics.includes(symptom)) {
          topics.push(symptom);
        }
      }
    }
  }
  
  // History-related topics
  if (lowerMessage.includes('medication') || lowerMessage.includes('medicine') || lowerMessage.includes('pills')) {
    topics.push('medications');
  }
  if (lowerMessage.includes('allerg')) {
    topics.push('allergies');
  }
  if (lowerMessage.includes('smoke') || lowerMessage.includes('smoking') || lowerMessage.includes('tobacco')) {
    topics.push('smoking');
  }
  if (lowerMessage.includes('drink') || lowerMessage.includes('alcohol')) {
    topics.push('alcohol');
  }
  
  return topics;
}

/**
 * Detect if patient message contains new information.
 * Used to determine if follow-up limit should be extended.
 * Requirements: 2.2
 */
export function containsNewInformation(
  message: string,
  answeredTopics: string[]
): boolean {
  const extractedTopics = extractAnsweredTopics(message);
  return extractedTopics.some(topic => !answeredTopics.includes(topic));
}

/**
 * Detect completion phrases that indicate patient wants to move on.
 * Requirements: 5.3
 */
export function detectCompletionPhrase(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  const completionPhrases = [
    "that's all",
    "thats all",
    "that is all",
    "nothing else",
    "no more",
    "i'm done",
    "im done",
    "that's it",
    "thats it",
    "no other",
    "nothing more",
    "i think that's everything",
    "that covers it",
    "i'm healthy",
    "im healthy",
    "no issues",
    "no problems",
    "no concerns",
  ];
  
  return completionPhrases.some(phrase => lowerMessage.includes(phrase));
}

// --- Consecutive Error Tracking ---

/**
 * Increment consecutive error count.
 * Requirements: 4.5
 */
export function incrementConsecutiveErrors(count: number): number {
  return count + 1;
}

/**
 * Reset consecutive error count (on successful response).
 * Requirements: 4.5
 */
export function resetConsecutiveErrors(): number {
  return 0;
}

/**
 * Check if should suggest rephrasing (3+ consecutive errors).
 * Requirements: 4.5
 */
export function shouldSuggestRephrasing(consecutiveErrors: number): boolean {
  return consecutiveErrors >= 3;
}


// --- Contextual Fallback Messages ---
// Requirements: 4.1, 4.2

/**
 * Stage-aware fallback messages for when AI fails to generate a response.
 * These provide context-appropriate prompts instead of generic error messages.
 * Requirements: 4.1, 4.2
 */
const CONTEXTUAL_FALLBACKS: Record<string, string> = {
  'triage': "I understand you're not feeling well. Could you describe your main concern in a few words?",
  'symptoms': "Thanks for sharing that. To help narrow things down, are you experiencing any other symptoms?",
  'records': "Got it. Do you have any recent test results or medical records to share?",
  'history': "Thanks. Do you have any ongoing medical conditions or take any regular medications?",
  'lifestyle': "Almost done. Any relevant lifestyle factors like smoking or recent travel?",
  'review': "I have the information I need. Let me summarize what you've told me.",
};

/**
 * Get a contextual fallback message for a stage.
 * Requirements: 4.1
 */
export function getContextualFallback(stage: string): string {
  const fallback = CONTEXTUAL_FALLBACKS[stage];
  if (fallback) return fallback;
  // Default fallback for unknown stages
  return "Thanks for sharing that. To help narrow things down, are you experiencing any other symptoms?";
}

/**
 * Get a contextual fallback message for an agent role.
 * Requirements: 4.1
 */
export function getContextualFallbackForAgent(agent: AgentRole): string {
  const stage = AGENT_TO_STAGE[agent] ?? 'symptoms';
  return getContextualFallback(stage);
}

/**
 * Get a contextual fallback that acknowledges the patient's message.
 * Extracts a snippet from the patient's message for personalization.
 * Requirements: 4.2, 4.3
 */
export function getPersonalizedFallback(
  stage: string,
  patientMessage: string
): string {
  const baseFallback = getContextualFallback(stage);
  
  // Extract a meaningful snippet from the patient's message
  const snippet = extractMessageSnippet(patientMessage);
  
  if (snippet) {
    return `I heard you mention "${snippet}". ${baseFallback}`;
  }
  
  return baseFallback;
}

/**
 * Extract a meaningful snippet from a patient message for fallback personalization.
 * Requirements: 4.3
 */
function extractMessageSnippet(message: string): string | null {
  if (!message || message.trim().length === 0) {
    return null;
  }
  
  // Clean and truncate the message
  const cleaned = message.trim();
  
  // If message is short enough, use it directly
  if (cleaned.length <= 50) {
    return cleaned;
  }
  
  // Otherwise, take first 50 chars and add ellipsis
  return cleaned.substring(0, 47) + '...';
}

/**
 * Get the appropriate fallback message based on error state.
 * Handles consecutive errors by suggesting rephrasing.
 * Requirements: 4.2, 4.5
 */
export function getFallbackMessage(
  stage: string,
  patientMessage: string,
  consecutiveErrors: number
): string {
  // After 3 consecutive errors, suggest rephrasing
  if (shouldSuggestRephrasing(consecutiveErrors)) {
    return "I'm having some difficulty understanding. Could you try rephrasing your response in simpler terms?";
  }
  
  // Otherwise, return a personalized contextual fallback
  return getPersonalizedFallback(stage, patientMessage);
}

/**
 * Get fallback message for an agent role.
 * Requirements: 4.2, 4.5
 */
export function getFallbackMessageForAgent(
  agent: AgentRole,
  patientMessage: string,
  consecutiveErrors: number
): string {
  const stage = AGENT_TO_STAGE[agent];
  return getFallbackMessage(stage, patientMessage, consecutiveErrors);
}
