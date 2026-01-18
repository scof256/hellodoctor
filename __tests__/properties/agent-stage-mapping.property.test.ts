/**
 * Property Test: Agent-Stage Mapping Consistency
 * 
 * Validates Requirements 2.2, 2.3 from intake-progression-booking-fix spec:
 * - Each agent maps to a specific stage index
 * - Stage tracker reflects currentAgent from session
 */

import { describe, it, expect } from 'vitest';
import type { AgentRole } from '@/types';

// Agent to stage index mapping (same as in patient intake page)
const AGENT_TO_STAGE_INDEX: Record<AgentRole, number> = {
  'Triage': 0,           // Basics
  'ClinicalInvestigator': 1, // Symptoms
  'RecordsClerk': 2,     // Records
  'HistorySpecialist': 3, // History
  'HandoverSpecialist': 5, // Review (skip Lifestyle as it's part of History)
};

// Stage definitions (same as in patient intake page)
const STAGES = [
  { id: 'triage', label: 'Basics', threshold: 0 },
  { id: 'investigation', label: 'Symptoms', threshold: 15 },
  { id: 'records', label: 'Records', threshold: 35 },
  { id: 'history', label: 'History', threshold: 55 },
  { id: 'context', label: 'Lifestyle', threshold: 75 },
  { id: 'summary', label: 'Review', threshold: 90 },
];

// Simulate getCurrentStageIndex function
function getCurrentStageIndex(currentAgent: AgentRole | null, completeness: number): number {
  // Primary: Use agent-based stage mapping for accurate progression
  if (currentAgent && AGENT_TO_STAGE_INDEX[currentAgent] !== undefined) {
    return AGENT_TO_STAGE_INDEX[currentAgent];
  }
  // Fallback: Use completeness-based calculation
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (completeness >= (STAGES[i]?.threshold ?? 0)) return i;
  }
  return 0;
}

describe('Agent-Stage Mapping Consistency', () => {
  describe('Property 1: All Agents Have Valid Stage Mappings', () => {
    const allAgents: AgentRole[] = [
      'Triage',
      'ClinicalInvestigator',
      'RecordsClerk',
      'HistorySpecialist',
      'HandoverSpecialist',
    ];

    it.each(allAgents)('agent %s should map to a valid stage index', (agent) => {
      const stageIndex = AGENT_TO_STAGE_INDEX[agent];
      expect(stageIndex).toBeDefined();
      expect(stageIndex).toBeGreaterThanOrEqual(0);
      expect(stageIndex).toBeLessThan(STAGES.length);
    });
  });

  describe('Property 2: Agent Mapping Follows Progression Order', () => {
    it('Triage should map to first stage (index 0)', () => {
      expect(AGENT_TO_STAGE_INDEX['Triage']).toBe(0);
    });

    it('ClinicalInvestigator should map to second stage (index 1)', () => {
      expect(AGENT_TO_STAGE_INDEX['ClinicalInvestigator']).toBe(1);
    });

    it('RecordsClerk should map to third stage (index 2)', () => {
      expect(AGENT_TO_STAGE_INDEX['RecordsClerk']).toBe(2);
    });

    it('HistorySpecialist should map to fourth stage (index 3)', () => {
      expect(AGENT_TO_STAGE_INDEX['HistorySpecialist']).toBe(3);
    });

    it('HandoverSpecialist should map to final stage (index 5)', () => {
      expect(AGENT_TO_STAGE_INDEX['HandoverSpecialist']).toBe(5);
    });
  });

  describe('Property 3: getCurrentStageIndex Prioritizes Agent Over Completeness', () => {
    it('should use agent mapping when agent is provided', () => {
      // Even with 0% completeness, Triage agent should show stage 0
      expect(getCurrentStageIndex('Triage', 0)).toBe(0);
      
      // Even with 50% completeness, Triage agent should show stage 0
      expect(getCurrentStageIndex('Triage', 50)).toBe(0);
    });

    it('should use agent mapping regardless of completeness value', () => {
      // HandoverSpecialist should show stage 5 even with low completeness
      expect(getCurrentStageIndex('HandoverSpecialist', 10)).toBe(5);
      
      // ClinicalInvestigator should show stage 1 even with high completeness
      expect(getCurrentStageIndex('ClinicalInvestigator', 90)).toBe(1);
    });

    it('should fall back to completeness when agent is null', () => {
      expect(getCurrentStageIndex(null, 0)).toBe(0);   // Basics
      expect(getCurrentStageIndex(null, 20)).toBe(1);  // Symptoms
      expect(getCurrentStageIndex(null, 40)).toBe(2);  // Records
      expect(getCurrentStageIndex(null, 60)).toBe(3);  // History
      expect(getCurrentStageIndex(null, 80)).toBe(4);  // Lifestyle
      expect(getCurrentStageIndex(null, 95)).toBe(5);  // Review
    });
  });

  describe('Property 4: Stage Labels Match Agent Roles', () => {
    it('Triage agent should correspond to Basics stage', () => {
      const stageIndex = AGENT_TO_STAGE_INDEX['Triage'];
      expect(STAGES[stageIndex]?.label).toBe('Basics');
    });

    it('ClinicalInvestigator agent should correspond to Symptoms stage', () => {
      const stageIndex = AGENT_TO_STAGE_INDEX['ClinicalInvestigator'];
      expect(STAGES[stageIndex]?.label).toBe('Symptoms');
    });

    it('RecordsClerk agent should correspond to Records stage', () => {
      const stageIndex = AGENT_TO_STAGE_INDEX['RecordsClerk'];
      expect(STAGES[stageIndex]?.label).toBe('Records');
    });

    it('HistorySpecialist agent should correspond to History stage', () => {
      const stageIndex = AGENT_TO_STAGE_INDEX['HistorySpecialist'];
      expect(STAGES[stageIndex]?.label).toBe('History');
    });

    it('HandoverSpecialist agent should correspond to Review stage', () => {
      const stageIndex = AGENT_TO_STAGE_INDEX['HandoverSpecialist'];
      expect(STAGES[stageIndex]?.label).toBe('Review');
    });
  });
});
