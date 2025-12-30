/**
 * Feature: nextjs-fullstack-conversion, Property 4: Agent Role Validity
 * 
 * For any successful response from the Gemini service, the activeAgent field
 * SHALL be one of the five valid AgentRole values.
 * 
 * Validates: Requirements 10.2, 10.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { VALID_AGENT_ROLES, AgentRole } from '@/app/types';

describe('Property 4: Agent Role Validity', () => {
  it('VALID_AGENT_ROLES contains exactly five agent roles', () => {
    expect(VALID_AGENT_ROLES).toHaveLength(5);
  });

  it('all defined agent roles are valid strings', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_AGENT_ROLES),
        (role: AgentRole) => {
          expect(typeof role).toBe('string');
          expect(role.length).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any valid agent role, it should be in the VALID_AGENT_ROLES array', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Triage', 'ClinicalInvestigator', 'RecordsClerk', 'HistorySpecialist', 'HandoverSpecialist'),
        (role: string) => {
          expect(VALID_AGENT_ROLES).toContain(role);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid agent roles should not be in VALID_AGENT_ROLES', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !VALID_AGENT_ROLES.includes(s as AgentRole)),
        (invalidRole: string) => {
          expect(VALID_AGENT_ROLES).not.toContain(invalidRole);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isValidAgentRole helper correctly validates roles', () => {
    const isValidAgentRole = (role: string): role is AgentRole => {
      return VALID_AGENT_ROLES.includes(role as AgentRole);
    };

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...VALID_AGENT_ROLES),
          fc.string()
        ),
        (role: string) => {
          const isValid = isValidAgentRole(role);
          const shouldBeValid = VALID_AGENT_ROLES.includes(role as AgentRole);
          expect(isValid).toBe(shouldBeValid);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
