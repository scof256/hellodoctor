/**
 * Property Test: SBAR Section Completeness
 * Feature: realtime-transcription-analysis, Property 3
 * Validates: Requirements 2.1, 4.5
 * 
 * For any generated SBAR content, all four sections (Situation, Background, 
 * Assessment, Recommendation) must contain non-empty strings, using fallback 
 * content when extraction fails.
 */

import { describe, it, expect } from 'vitest';
import { extractSBARContent, type AnalysisType } from '../../app/lib/sbar-extractor';

describe('Property: SBAR Section Completeness', () => {
  const analysisTypes: AnalysisType[] = ['summary', 'soap', 'action_items', 'risk_assessment'];
  
  it('should always return non-empty strings for all four SBAR sections', () => {
    // Generate random test cases
    const testCases = generateRandomAnalysisResponses(100);
    
    testCases.forEach(({ content, type }) => {
      const result = extractSBARContent(content, type);
      
      // Verify all sections are non-empty strings
      expect(result.situation).toBeTruthy();
      expect(result.situation.length).toBeGreaterThan(0);
      expect(typeof result.situation).toBe('string');
      
      expect(result.background).toBeTruthy();
      expect(result.background.length).toBeGreaterThan(0);
      expect(typeof result.background).toBe('string');
      
      expect(result.assessment).toBeTruthy();
      expect(result.assessment.length).toBeGreaterThan(0);
      expect(typeof result.assessment).toBe('string');
      
      expect(result.recommendation).toBeTruthy();
      expect(result.recommendation.length).toBeGreaterThan(0);
      expect(typeof result.recommendation).toBe('string');
      
      // Verify type is preserved
      expect(result.type).toBe(type);
      
      // Verify timestamp is set
      expect(result.generatedAt).toBeGreaterThan(0);
    });
  });
  
  it('should handle completely empty content with fallback', () => {
    analysisTypes.forEach(type => {
      const result = extractSBARContent('', type);
      
      expect(result.situation).toBeTruthy();
      expect(result.background).toBeTruthy();
      expect(result.assessment).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
  });
  
  it('should handle malformed markdown with fallback', () => {
    const malformedCases = [
      '### Random Header\nSome text without proper structure',
      '## Situation\n\n## Background\n\n', // Empty sections
      'Just plain text with no structure at all',
      '##Situation:Missing space\n##Background:Also missing',
      '# Situation\n# # Background\n### Assessment', // Inconsistent headers
    ];
    
    analysisTypes.forEach(type => {
      malformedCases.forEach(content => {
        const result = extractSBARContent(content, type);
        
        expect(result.situation).toBeTruthy();
        expect(result.background).toBeTruthy();
        expect(result.assessment).toBeTruthy();
        expect(result.recommendation).toBeTruthy();
      });
    });
  });
});

/**
 * Generate random analysis responses for property testing
 */
function generateRandomAnalysisResponses(count: number): Array<{ content: string; type: AnalysisType }> {
  const analysisTypes: AnalysisType[] = ['summary', 'soap', 'action_items', 'risk_assessment'];
  const cases: Array<{ content: string; type: AnalysisType }> = [];
  
  for (let i = 0; i < count; i++) {
    const type = analysisTypes[Math.floor(Math.random() * analysisTypes.length)]!;
    const content = generateRandomContent(type);
    cases.push({ content, type });
  }
  
  return cases;
}

/**
 * Generate random content based on analysis type
 */
function generateRandomContent(type: AnalysisType): string {
  const rand = Math.random();
  
  // 20% chance of empty content
  if (rand < 0.2) {
    return '';
  }
  
  // 20% chance of malformed content
  if (rand < 0.4) {
    return generateMalformedContent();
  }
  
  // 60% chance of well-formed content
  if (type === 'summary') {
    return generateSummaryContent();
  } else if (type === 'soap') {
    return generateSOAPContent();
  } else if (type === 'action_items') {
    return generateActionItemsContent();
  } else {
    return generateRiskAssessmentContent();
  }
}

function generateSummaryContent(): string {
  const hasSituation = Math.random() > 0.2;
  const hasBackground = Math.random() > 0.2;
  const hasAssessment = Math.random() > 0.2;
  const hasRecommendation = Math.random() > 0.2;
  
  let content = '';
  
  if (hasSituation) {
    content += `## Situation\n${randomText()}\n\n`;
  }
  if (hasBackground) {
    content += `## Background\n${randomText()}\n\n`;
  }
  if (hasAssessment) {
    content += `## Assessment\n${randomText()}\n\n`;
  }
  if (hasRecommendation) {
    content += `## Recommendation\n${randomText()}\n\n`;
  }
  
  return content;
}

function generateSOAPContent(): string {
  const hasSubjective = Math.random() > 0.2;
  const hasObjective = Math.random() > 0.2;
  const hasAssessment = Math.random() > 0.2;
  const hasPlan = Math.random() > 0.2;
  
  let content = '';
  
  if (hasSubjective) {
    content += `## Subjective\n${randomText()}\n\n`;
  }
  if (hasObjective) {
    content += `## Objective\n${randomText()}\n\n`;
  }
  if (hasAssessment) {
    content += `## Assessment\n${randomText()}\n\n`;
  }
  if (hasPlan) {
    content += `## Plan\n${randomText()}\n\n`;
  }
  
  return content;
}

function generateActionItemsContent(): string {
  return `- ${randomText()}\n- ${randomText()}\n- ${randomText()}`;
}

function generateRiskAssessmentContent(): string {
  return `Risk factors identified:\n- ${randomText()}\n- ${randomText()}`;
}

function generateMalformedContent(): string {
  const options = [
    `### Random Header\n${randomText()}`,
    `${randomText()}\n\n${randomText()}`,
    `## Situation\n\n## Background\n\n`, // Empty sections
    `##Situation:${randomText()}\n##Background:${randomText()}`, // No space after ##
    `# Situation\n${randomText()}\n### Assessment\n${randomText()}`, // Inconsistent headers
  ];
  
  return options[Math.floor(Math.random() * options.length)]!;
}

function randomText(): string {
  const texts = [
    'Patient presents with symptoms',
    'Medical history includes previous conditions',
    'Clinical findings suggest diagnosis',
    'Treatment plan recommended',
    'Follow-up required in 2 weeks',
    'Lab results pending',
    'Vital signs stable',
    'No adverse reactions noted',
  ];
  
  return texts[Math.floor(Math.random() * texts.length)]!;
}
