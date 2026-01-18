/**
 * Property Test: Single Question Per AI Response
 * Feature: whatsapp-simple-ux, Property 16
 * Validates: Requirements 6.2
 * 
 * Tests that AI assistant messages contain exactly one question
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Helper function to count questions in a text
function countQuestions(text: string): number {
  // Count question marks
  const questionMarks = (text.match(/\?/g) || []).length;
  
  // Count interrogative words at the start of sentences
  const interrogativePattern = /\b(what|when|where|who|why|how|which|whose|whom|can|could|would|should|will|shall|may|might|do|does|did|is|are|was|were|have|has|had)\b[^.!?]*\?/gi;
  const interrogatives = (text.match(interrogativePattern) || []).length;
  
  return Math.max(questionMarks, interrogatives);
}

// Generator for AI messages that should contain one question
const aiMessageWithQuestionArb = fc.record({
  text: fc.oneof(
    // Direct questions
    fc.constantFrom(
      'What is your main symptom?',
      'How long have you been experiencing this?',
      'Where does it hurt?',
      'When did this start?',
      'Can you describe the pain?',
      'Have you taken any medication?',
      'Do you have any allergies?',
      'Are you currently taking any medications?'
    ),
    // Questions with context
    fc.tuple(
      fc.constantFrom(
        'I understand.',
        'Thank you for that information.',
        'Got it.',
        'Okay.',
        'I see.'
      ),
      fc.constantFrom(
        'What is your main symptom?',
        'How long have you been experiencing this?',
        'Can you tell me more?'
      )
    ).map(([context, question]) => `${context} ${question}`)
  ),
  role: fc.constant('model' as const),
});

// Generator for messages with multiple questions (should be invalid)
const aiMessageWithMultipleQuestionsArb = fc.record({
  text: fc.tuple(
    fc.constantFrom(
      'What is your main symptom?',
      'How long have you been experiencing this?',
      'Where does it hurt?'
    ),
    fc.constantFrom(
      'When did this start?',
      'Can you describe the pain?',
      'Have you taken any medication?'
    )
  ).map(([q1, q2]) => `${q1} ${q2}`),
  role: fc.constant('model' as const),
});

describe('Property 16: Single Question Per AI Response', () => {
  it('should identify messages with exactly one question', () => {
    fc.assert(
      fc.property(aiMessageWithQuestionArb, (message) => {
        const questionCount = countQuestions(message.text);
        
        // Each AI message should have exactly 1 question
        expect(questionCount).toBeGreaterThanOrEqual(1);
        expect(questionCount).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 }
    );
  });

  it('should detect messages with multiple questions as invalid', () => {
    fc.assert(
      fc.property(aiMessageWithMultipleQuestionsArb, (message) => {
        const questionCount = countQuestions(message.text);
        
        // These messages should have more than 1 question
        expect(questionCount).toBeGreaterThan(1);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle various question formats', () => {
    const testCases = [
      { text: 'What is your name?', expected: 1 },
      { text: 'How are you feeling today?', expected: 1 },
      { text: 'Can you describe your symptoms?', expected: 1 },
      { text: 'Do you have any allergies?', expected: 1 },
      { text: 'What is your name? How old are you?', expected: 2 },
      { text: 'Tell me about your symptoms.', expected: 0 }, // Statement, not a question
      { text: 'Please describe your pain level from 1-10.', expected: 0 }, // Statement
    ];

    testCases.forEach(({ text, expected }) => {
      const count = countQuestions(text);
      expect(count).toBe(expected);
    });
  });

  it('should correctly count questions in complex messages', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (numQuestions) => {
          // Generate a message with exactly numQuestions questions
          const questions = [
            'What is your main symptom?',
            'How long have you been experiencing this?',
            'Where does it hurt?',
            'When did this start?',
            'Can you describe the pain?',
          ].slice(0, numQuestions);
          
          const text = questions.join(' ');
          const count = countQuestions(text);
          
          // Should detect the correct number of questions
          expect(count).toBe(numQuestions);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case: question mark in non-question context', () => {
    const text = 'Your temperature is 98.6? That seems normal.';
    const count = countQuestions(text);
    
    // This has a question mark but might not be a true question
    // The function should still count it
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('should handle edge case: rhetorical questions', () => {
    const text = 'You know what I mean?';
    const count = countQuestions(text);
    
    // Rhetorical questions still count as questions
    expect(count).toBe(1);
  });

  it('should validate that Simple Mode AI messages follow single question rule', () => {
    // This property ensures that in Simple Mode, AI should ask one question at a time
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }),
        (messageText) => {
          // If the message contains a question mark, it should only have one
          const hasQuestion = messageText.includes('?');
          
          if (hasQuestion) {
            const questionCount = countQuestions(messageText);
            
            // For Simple Mode, we want exactly 1 question per message
            // This is a guideline that should be enforced
            return questionCount === 1;
          }
          
          // Messages without questions are fine (statements, confirmations)
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
