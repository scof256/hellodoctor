/**
 * Tracking State Utility Functions
 * 
 * Pure functions for tracking state manipulation and prompt injection.
 * Separated from gemini.ts to avoid env dependencies in tests.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 5.1, 5.2, 5.3, 5.4
 */

import type { TrackingState, AgentRole, FollowUpCounts } from '@/types';

/**
 * Format answered topics for prompt injection.
 * Returns a bulleted list or "None yet" message.
 * Requirements: 2.4, 2.5, 4.1
 */
export function formatAnsweredTopics(topics: string[] | null | undefined): string {
  if (!topics || topics.length === 0) {
    return "None yet - this is the start of the conversation";
  }
  return topics.map(topic => `• ${topic}`).join('\n');
}

/**
 * Map agent role to stage name for follow-up count lookup.
 */
export const AGENT_TO_STAGE_MAP: Record<AgentRole, string> = {
  'Triage': 'triage',
  'ClinicalInvestigator': 'symptoms',
  'RecordsClerk': 'records',
  'HistorySpecialist': 'history',
  'HandoverSpecialist': 'review',
};

/**
 * Get follow-up count for a specific agent.
 * Requirements: 2.2, 3.3
 */
export function getAgentFollowUpCount(
  followUpCounts: FollowUpCounts,
  agent: AgentRole
): number {
  const stageName = AGENT_TO_STAGE_MAP[agent] ?? 'symptoms';
  return followUpCounts[stageName] ?? 0;
}

/**
 * Build dynamic instructions based on tracking state.
 * Generates context-aware warnings and instructions.
 * Requirements: 3.1, 3.2, 3.4, 5.1, 5.2, 5.4
 */
export function buildDynamicInstructions(trackingState: TrackingState): string {
  const instructions: string[] = [];
  const followUpCount = getAgentFollowUpCount(
    trackingState.followUpCounts,
    trackingState.currentAgent
  );

  // Follow-up limit warnings (Requirements: 3.1, 3.2, 3.4)
  if (followUpCount >= 2) {
    instructions.push(
      "⚠️ FOLLOW-UP LIMIT REACHED (2/2) - You MUST wrap up this topic NOW.",
      "Batch any remaining questions into ONE final message, then move to the next stage."
    );
  } else if (followUpCount === 1) {
    instructions.push(
      "📝 Follow-up count: 1/2 - You have ONE more follow-up allowed on this topic."
    );
  }

  // Message count warnings (Requirements: 5.1, 5.2)
  if (trackingState.aiMessageCount > 20) {
    instructions.push(
      "🚨 MESSAGE LIMIT EXCEEDED - Transition to HandoverSpecialist IMMEDIATELY."
    );
  } else if (trackingState.aiMessageCount > 15) {
    instructions.push(
      "⏰ Approaching message limit - Offer to conclude the intake."
    );
  }

  // Completeness-based instructions (Requirement: 5.4)
  if (trackingState.completeness >= 80) {
    instructions.push(
      "✅ Intake is 80%+ complete - Offer to wrap up and proceed to booking."
    );
  }

  return instructions.length > 0
    ? `\n**DYNAMIC INSTRUCTIONS:**\n${instructions.join('\n')}\n`
    : '';
}

/**
 * Inject tracking state into an agent prompt.
 * Replaces all placeholders with actual values.
 * Requirements: 2.1, 2.2, 2.3
 */
export function injectTrackingState(
  prompt: string,
  trackingState: TrackingState
): string {
  const followUpCount = getAgentFollowUpCount(
    trackingState.followUpCounts,
    trackingState.currentAgent
  );

  // Format values - escape special regex replacement characters ($)
  const answeredTopicsFormatted = formatAnsweredTopics(trackingState.answeredTopics)
    .replace(/\$/g, '$$$$'); // Escape $ for use in replace()
  const followUpCountStr = `${followUpCount}`;
  const aiMessageCountStr = `${trackingState.aiMessageCount}`;
  const completenessStr = `${trackingState.completeness}%`;

  // Replace placeholders
  let injectedPrompt = prompt
    .replace(/\{answeredQuestions\}/g, answeredTopicsFormatted)
    .replace(/\{followUpCount\}/g, followUpCountStr)
    .replace(/\{aiMessageCount\}/g, aiMessageCountStr)
    .replace(/\{completeness\}/g, completenessStr);

  // Add dynamic instructions
  const dynamicInstructions = buildDynamicInstructions(trackingState);
  if (dynamicInstructions) {
    // Insert before OUTPUT FORMAT section if it exists
    if (injectedPrompt.includes('**OUTPUT FORMAT:**')) {
      injectedPrompt = injectedPrompt.replace(
        '**OUTPUT FORMAT:**',
        `${dynamicInstructions}\n**OUTPUT FORMAT:**`
      );
    } else {
      // Append at the end if no OUTPUT FORMAT section
      injectedPrompt += dynamicInstructions;
    }
  }

  return injectedPrompt;
}
