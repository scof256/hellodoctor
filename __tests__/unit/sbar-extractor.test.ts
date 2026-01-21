/**
 * Unit Tests: SBAR Content Extraction
 * Tests extraction from well-formed markdown, unstructured text,
 * SOAP-to-SBAR mapping, fallback content, and edge cases
 */

import { describe, it, expect } from 'vitest';
import { extractSBARContent } from '../../app/lib/sbar-extractor';

describe('SBAR Content Extraction', () => {
  describe('Well-formed markdown with clear sections', () => {
    it('should extract all SBAR sections from properly formatted summary', () => {
      const content = `
## Situation
Patient presents with acute chest pain

## Background
History of hypertension, currently on medication

## Assessment
Possible cardiac event, requires immediate evaluation

## Recommendation
Admit for observation and cardiac workup
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      expect(result.situation).toContain('acute chest pain');
      expect(result.background).toContain('hypertension');
      expect(result.assessment).toContain('cardiac event');
      expect(result.recommendation).toContain('Admit for observation');
      expect(result.type).toBe('summary');
    });
    
    it('should handle sections with colons after headers', () => {
      const content = `
## Situation:
Patient has fever

## Background:
Recent travel history

## Assessment:
Possible infection

## Recommendation:
Start antibiotics
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      expect(result.situation).toContain('fever');
      expect(result.background).toContain('travel');
      expect(result.assessment).toContain('infection');
      expect(result.recommendation).toContain('antibiotics');
    });
    
    it('should handle single # headers', () => {
      const content = `
# Situation
Patient reports headache

# Background
No prior history

# Assessment
Tension headache likely

# Recommendation
OTC pain relief
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      expect(result.situation).toContain('headache');
      expect(result.background).toContain('No prior');
      expect(result.assessment).toContain('Tension');
      expect(result.recommendation).toContain('OTC');
    });
  });
  
  describe('Unstructured text extraction', () => {
    it('should use fallback content for completely unstructured text', () => {
      const content = 'This is just plain text without any structure or headers.';
      
      const result = extractSBARContent(content, 'summary');
      
      expect(result.situation).toBeTruthy();
      expect(result.background).toBeTruthy();
      expect(result.assessment).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
    
    it('should handle text with random headers', () => {
      const content = `
## Random Header
Some content here

## Another Header
More content
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      // Should use fallback since no SBAR headers found
      expect(result.situation).toBeTruthy();
      expect(result.background).toBeTruthy();
      expect(result.assessment).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
  });
  
  describe('SOAP-to-SBAR mapping', () => {
    it('should map SOAP sections to SBAR correctly', () => {
      const content = `
## Subjective
Patient complains of back pain

## Objective
Vital signs normal, tenderness in lower back

## Assessment
Muscle strain

## Plan
Physical therapy and pain management
      `.trim();
      
      const result = extractSBARContent(content, 'soap');
      
      expect(result.situation).toContain('back pain');
      expect(result.background).toContain('Vital signs');
      expect(result.assessment).toContain('Muscle strain');
      expect(result.recommendation).toContain('Physical therapy');
      expect(result.type).toBe('soap');
    });
    
    it('should handle abbreviated SOAP headers (S, O, A, P)', () => {
      const content = `
## S
Patient reports nausea

## O
Temperature 37.5°C

## A
Viral gastroenteritis

## P
Rest and hydration
      `.trim();
      
      const result = extractSBARContent(content, 'soap');
      
      expect(result.situation).toContain('nausea');
      expect(result.background).toContain('Temperature');
      expect(result.assessment).toContain('gastroenteritis');
      expect(result.recommendation).toContain('hydration');
    });
    
    it('should handle SOAP with colons', () => {
      const content = `
## Subjective:
Cough for 3 days

## Objective:
Lungs clear

## Assessment:
Upper respiratory infection

## Plan:
Symptomatic treatment
      `.trim();
      
      const result = extractSBARContent(content, 'soap');
      
      expect(result.situation).toContain('Cough');
      expect(result.background).toContain('Lungs');
      expect(result.assessment).toContain('respiratory');
      expect(result.recommendation).toContain('Symptomatic');
    });
  });
  
  describe('Focused extraction for action_items', () => {
    it('should place action items in recommendation section', () => {
      const content = `
- Schedule follow-up in 2 weeks
- Order blood work
- Prescribe medication
      `.trim();
      
      const result = extractSBARContent(content, 'action_items');
      
      expect(result.situation).toBe('Action items from consultation');
      expect(result.background).toBe('Based on current appointment discussion');
      expect(result.assessment).toBe('Items requiring follow-up');
      expect(result.recommendation).toContain('Schedule follow-up');
      expect(result.recommendation).toContain('Order blood work');
      expect(result.type).toBe('action_items');
    });
    
    it('should handle action items with various formats', () => {
      const content = `
1. First action item
2. Second action item
* Third action item
      `.trim();
      
      const result = extractSBARContent(content, 'action_items');
      
      expect(result.recommendation).toContain('First action');
      expect(result.recommendation).toContain('Second action');
      expect(result.recommendation).toContain('Third action');
    });
  });
  
  describe('Focused extraction for risk_assessment', () => {
    it('should place risk assessment in assessment section', () => {
      const content = `
High risk factors:
- Diabetes
- Hypertension
- Family history of heart disease
      `.trim();
      
      const result = extractSBARContent(content, 'risk_assessment');
      
      expect(result.situation).toBe('Risk assessment review');
      expect(result.background).toBe('Patient risk factors identified');
      expect(result.assessment).toContain('Diabetes');
      expect(result.assessment).toContain('Hypertension');
      expect(result.recommendation).toBe('Recommended risk mitigation steps');
      expect(result.type).toBe('risk_assessment');
    });
  });
  
  describe('Fallback content generation', () => {
    it('should provide fallback for empty content', () => {
      const result = extractSBARContent('', 'summary');
      
      expect(result.situation).toBe('Clinical situation being assessed...');
      expect(result.background).toBe('Patient background information pending...');
      expect(result.assessment).toBe('Clinical assessment in progress...');
      expect(result.recommendation).toBe('Treatment recommendations to follow...');
    });
    
    it('should provide fallback for missing sections in summary', () => {
      const content = `
## Situation
Patient has symptoms

## Assessment
Diagnosis made
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      expect(result.situation).toContain('symptoms');
      expect(result.background).toBe('Patient background information pending...');
      expect(result.assessment).toContain('Diagnosis');
      expect(result.recommendation).toBe('Treatment recommendations to follow...');
    });
    
    it('should provide fallback for missing SOAP sections', () => {
      const content = `
## Subjective
Patient complaint

## Plan
Treatment plan
      `.trim();
      
      const result = extractSBARContent(content, 'soap');
      
      expect(result.situation).toContain('complaint');
      expect(result.background).toBe('Patient background information pending...');
      expect(result.assessment).toBe('Clinical assessment in progress...');
      expect(result.recommendation).toContain('Treatment');
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty sections', () => {
      const content = `
## Situation

## Background

## Assessment

## Recommendation
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      // Should use fallback for empty sections
      expect(result.situation).toBeTruthy();
      expect(result.background).toBeTruthy();
      expect(result.assessment).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
    
    it('should handle missing headers', () => {
      const content = `
Patient has condition
Some background info
Clinical findings
Treatment needed
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      // Should use fallback when no headers found
      expect(result.situation).toBeTruthy();
      expect(result.background).toBeTruthy();
      expect(result.assessment).toBeTruthy();
      expect(result.recommendation).toBeTruthy();
    });
    
    it('should handle malformed markdown', () => {
      const content = `
##Situation:No space after hash
##Background:Also no space
###Assessment:Three hashes
#Recommendation:One hash
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      expect(result.situation).toContain('No space');
      expect(result.background).toContain('Also no space');
      expect(result.assessment).toContain('Three hashes');
      expect(result.recommendation).toContain('One hash');
    });
    
    it('should clean markdown formatting from content', () => {
      const content = `
## Situation
- Bullet point 1
- Bullet point 2

## Background
* Another bullet
* More bullets

## Assessment
### Subheading
Content here

## Recommendation
#### Another subheading
More content
      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      // Should convert to bullets and remove subheadings
      expect(result.situation).toContain('•');
      expect(result.background).toContain('•');
      expect(result.assessment).not.toContain('###');
      expect(result.recommendation).not.toContain('####');
    });
    
    it('should handle excessive newlines', () => {
      const content = `
## Situation


Patient info


## Background


More info


      `.trim();
      
      const result = extractSBARContent(content, 'summary');
      
      // Should normalize newlines
      expect(result.situation).not.toMatch(/\n{3,}/);
      expect(result.background).not.toMatch(/\n{3,}/);
    });
    
    it('should set timestamp', () => {
      const before = Date.now();
      const result = extractSBARContent('test', 'summary');
      const after = Date.now();
      
      expect(result.generatedAt).toBeGreaterThanOrEqual(before);
      expect(result.generatedAt).toBeLessThanOrEqual(after);
    });
  });
});
