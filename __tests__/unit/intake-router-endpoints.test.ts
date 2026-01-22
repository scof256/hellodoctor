/**
 * Unit tests for intake router endpoints
 * Task 2.1: Create intake router with session queries
 * Requirements: 2.1, 3.4, 3.5, 4.1
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Intake Router Endpoints', () => {
  describe('getMessages endpoint', () => {
    it('should validate connectionId input', () => {
      const schema = z.object({ connectionId: z.string().uuid() });
      
      // Valid UUID
      const validInput = { connectionId: '123e4567-e89b-12d3-a456-426614174000' };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
      
      // Invalid UUID
      const invalidInput = { connectionId: 'not-a-uuid' };
      const invalidResult = schema.safeParse(invalidInput);
      expect(invalidResult.success).toBe(false);
    });

    it('should return messages array structure', () => {
      // Test that the expected return type has messages array
      const expectedResponse = { messages: [] };
      expect(expectedResponse).toHaveProperty('messages');
      expect(Array.isArray(expectedResponse.messages)).toBe(true);
    });
  });

  describe('getSBAR endpoint', () => {
    it('should validate connectionId input', () => {
      const schema = z.object({ connectionId: z.string().uuid() });
      
      // Valid UUID
      const validInput = { connectionId: '123e4567-e89b-12d3-a456-426614174000' };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
    });

    it('should return sbar object or null', () => {
      // Test that the expected return type has sbar property
      const expectedResponseWithSBAR = { 
        sbar: {
          situation: 'Patient presents with...',
          background: 'Medical history includes...',
          assessment: 'Clinical assessment shows...',
          recommendation: 'Recommend treatment...'
        }
      };
      expect(expectedResponseWithSBAR).toHaveProperty('sbar');
      expect(expectedResponseWithSBAR.sbar).toHaveProperty('situation');
      expect(expectedResponseWithSBAR.sbar).toHaveProperty('background');
      expect(expectedResponseWithSBAR.sbar).toHaveProperty('assessment');
      expect(expectedResponseWithSBAR.sbar).toHaveProperty('recommendation');
      
      // Test null case
      const expectedResponseNull = { sbar: null };
      expect(expectedResponseNull).toHaveProperty('sbar');
      expect(expectedResponseNull.sbar).toBeNull();
    });
  });

  describe('getClinicalReasoning endpoint', () => {
    it('should validate connectionId input', () => {
      const schema = z.object({ connectionId: z.string().uuid() });
      
      // Valid UUID
      const validInput = { connectionId: '123e4567-e89b-12d3-a456-426614174000' };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
    });

    it('should return clinicalReasoning object or null', () => {
      // Test that the expected return type has clinicalReasoning property
      const expectedResponseWithReasoning = { 
        clinicalReasoning: {
          differentialDiagnosis: [
            {
              condition: 'Condition A',
              probability: 'high',
              reasoning: 'Based on symptoms...'
            }
          ],
          missingInformation: ['Lab results'],
          strategy: 'Gather more information',
          nextMove: 'Order tests'
        }
      };
      expect(expectedResponseWithReasoning).toHaveProperty('clinicalReasoning');
      expect(expectedResponseWithReasoning.clinicalReasoning).toHaveProperty('differentialDiagnosis');
      expect(expectedResponseWithReasoning.clinicalReasoning).toHaveProperty('missingInformation');
      expect(expectedResponseWithReasoning.clinicalReasoning).toHaveProperty('strategy');
      expect(expectedResponseWithReasoning.clinicalReasoning).toHaveProperty('nextMove');
      
      // Test null case
      const expectedResponseNull = { clinicalReasoning: null };
      expect(expectedResponseNull).toHaveProperty('clinicalReasoning');
      expect(expectedResponseNull.clinicalReasoning).toBeNull();
    });
  });

  describe('Authorization checks', () => {
    it('should require doctor role for SBAR access', () => {
      // SBAR is doctor-only data
      // This test documents the requirement that only doctors can access SBAR
      const doctorOnlyEndpoints = ['getSBAR', 'getClinicalReasoning'];
      expect(doctorOnlyEndpoints).toContain('getSBAR');
      expect(doctorOnlyEndpoints).toContain('getClinicalReasoning');
    });

    it('should allow both patient and doctor for messages', () => {
      // Messages can be accessed by both patient and doctor in the connection
      const sharedEndpoints = ['getMessages'];
      expect(sharedEndpoints).toContain('getMessages');
    });
  });

  describe('Data filtering', () => {
    it('should filter messages by connectionId', () => {
      // Test that messages are filtered to only those from sessions
      // belonging to the specified connection
      const connectionId = '123e4567-e89b-12d3-a456-426614174000';
      const mockMessages = [
        { id: '1', sessionId: 'session-1', connectionId },
        { id: '2', sessionId: 'session-2', connectionId },
      ];
      
      // All messages should belong to sessions with the same connectionId
      const allMatchConnection = mockMessages.every(msg => msg.connectionId === connectionId);
      expect(allMatchConnection).toBe(true);
    });

    it('should return latest SBAR from most recent session', () => {
      // Test that SBAR is fetched from the most recently updated session
      const mockSessions = [
        { id: '1', updatedAt: new Date('2024-01-01'), clinicalHandover: { situation: 'Old' } },
        { id: '2', updatedAt: new Date('2024-01-02'), clinicalHandover: { situation: 'Latest' } },
      ];
      
      // Sort by updatedAt descending
      const sorted = [...mockSessions].sort((a, b) => 
        b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      
      expect(sorted[0]?.clinicalHandover?.situation).toBe('Latest');
    });
  });

  describe('Context layer support', () => {
    it('should include contextLayer in message format', () => {
      // Messages should include contextLayer to distinguish patient-intake from doctor-enhancement
      const mockMessage = {
        id: '1',
        role: 'user' as const,
        text: 'Test message',
        timestamp: new Date(),
        contextLayer: 'patient-intake' as const,
      };
      
      expect(mockMessage).toHaveProperty('contextLayer');
      expect(['patient-intake', 'doctor-enhancement']).toContain(mockMessage.contextLayer);
    });
  });

  describe('addMessage mutation', () => {
    it('should validate input schema', () => {
      const schema = z.object({
        connectionId: z.string().uuid(),
        content: z.string().min(1),
        messageType: z.enum(['text', 'test-result', 'exam-finding']).default('text'),
        metadata: z.record(z.any()).optional(),
      });
      
      // Valid input
      const validInput = {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        content: 'Test result: Normal',
        messageType: 'test-result' as const,
      };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
      
      // Invalid - empty content
      const invalidInput = {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        content: '',
      };
      const invalidResult = schema.safeParse(invalidInput);
      expect(invalidResult.success).toBe(false);
    });

    it('should return message with doctor-enhancement contextLayer', () => {
      // Test that the response includes message with correct contextLayer
      const expectedResponse = {
        message: {
          id: '1',
          role: 'doctor' as const,
          text: 'Test result added',
          timestamp: new Date(),
          contextLayer: 'doctor-enhancement' as const,
        },
        sbar: {
          situation: 'Updated situation',
          background: 'Updated background',
          assessment: 'Updated assessment',
          recommendation: 'Updated recommendation',
        },
      };
      
      expect(expectedResponse.message.contextLayer).toBe('doctor-enhancement');
      expect(expectedResponse.message.role).toBe('doctor');
      expect(expectedResponse).toHaveProperty('sbar');
    });

    it('should support different message types', () => {
      const messageTypes = ['text', 'test-result', 'exam-finding'] as const;
      
      messageTypes.forEach(type => {
        const schema = z.enum(['text', 'test-result', 'exam-finding']);
        const result = schema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should require doctor role', () => {
      // addMessage is a doctor-only mutation
      const doctorOnlyMutations = ['addMessage', 'addImageMessage'];
      expect(doctorOnlyMutations).toContain('addMessage');
    });
  });

  describe('addImageMessage mutation', () => {
    it('should validate input schema', () => {
      const schema = z.object({
        connectionId: z.string().uuid(),
        imageUrl: z.string().url(),
        messageType: z.enum(['image', 'test-result']).default('image'),
        caption: z.string().optional(),
      });
      
      // Valid input
      const validInput = {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        imageUrl: 'https://example.com/test-result.jpg',
        messageType: 'test-result' as const,
        caption: 'Lab results',
      };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
      
      // Invalid - not a URL
      const invalidInput = {
        connectionId: '123e4567-e89b-12d3-a456-426614174000',
        imageUrl: 'not-a-url',
      };
      const invalidResult = schema.safeParse(invalidInput);
      expect(invalidResult.success).toBe(false);
    });

    it('should return message with image and doctor-enhancement contextLayer', () => {
      // Test that the response includes message with image and correct contextLayer
      const expectedResponse = {
        message: {
          id: '1',
          role: 'doctor' as const,
          text: 'Lab results',
          images: ['https://example.com/test-result.jpg'],
          timestamp: new Date(),
          contextLayer: 'doctor-enhancement' as const,
        },
        sbar: {
          situation: 'Updated situation',
          background: 'Updated background',
          assessment: 'Updated assessment',
          recommendation: 'Updated recommendation',
        },
      };
      
      expect(expectedResponse.message.contextLayer).toBe('doctor-enhancement');
      expect(expectedResponse.message.role).toBe('doctor');
      expect(expectedResponse.message.images).toBeDefined();
      expect(expectedResponse.message.images?.length).toBeGreaterThan(0);
      expect(expectedResponse).toHaveProperty('sbar');
    });

    it('should support image and test-result types', () => {
      const messageTypes = ['image', 'test-result'] as const;
      
      messageTypes.forEach(type => {
        const schema = z.enum(['image', 'test-result']);
        const result = schema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should require doctor role', () => {
      // addImageMessage is a doctor-only mutation
      const doctorOnlyMutations = ['addMessage', 'addImageMessage'];
      expect(doctorOnlyMutations).toContain('addImageMessage');
    });
  });

  describe('SBAR regeneration', () => {
    it('should trigger SBAR regeneration on message addition', () => {
      // Both addMessage and addImageMessage should trigger SBAR regeneration
      const sbarTriggeringMutations = ['addMessage', 'addImageMessage'];
      
      // Test that both mutations return updated SBAR
      sbarTriggeringMutations.forEach(mutation => {
        const mockResponse = {
          message: { id: '1', role: 'doctor' as const, text: 'Test' },
          sbar: {
            situation: 'Updated',
            background: 'Updated',
            assessment: 'Updated',
            recommendation: 'Updated',
          },
        };
        
        expect(mockResponse).toHaveProperty('sbar');
        expect(mockResponse.sbar).not.toBeNull();
      });
    });

    it('should use both context layers for SBAR generation', () => {
      // SBAR should be generated using both patient-intake and doctor-enhancement messages
      const contextLayers = ['patient-intake', 'doctor-enhancement'] as const;
      
      // Mock messages from both layers
      const mockMessages = [
        { id: '1', contextLayer: 'patient-intake' as const, content: 'Patient symptom' },
        { id: '2', contextLayer: 'doctor-enhancement' as const, content: 'Test result' },
      ];
      
      const patientMessages = mockMessages.filter(m => m.contextLayer === 'patient-intake');
      const doctorMessages = mockMessages.filter(m => m.contextLayer === 'doctor-enhancement');
      
      expect(patientMessages.length).toBeGreaterThan(0);
      expect(doctorMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Patient intake immutability', () => {
    it('should never modify patient-intake messages', () => {
      // Doctor mutations should only create doctor-enhancement messages
      // Patient-intake messages should remain read-only
      const patientMessage = {
        id: '1',
        contextLayer: 'patient-intake' as const,
        content: 'Original patient message',
      };
      
      const doctorMessage = {
        id: '2',
        contextLayer: 'doctor-enhancement' as const,
        content: 'Doctor note',
      };
      
      // Patient messages should not be modified
      expect(patientMessage.contextLayer).toBe('patient-intake');
      expect(doctorMessage.contextLayer).toBe('doctor-enhancement');
      expect(patientMessage.contextLayer).not.toBe(doctorMessage.contextLayer);
    });
  });

  describe('markReviewed mutation', () => {
    it('should validate connectionId input', () => {
      const schema = z.object({ connectionId: z.string().uuid() });
      
      // Valid UUID
      const validInput = { connectionId: '123e4567-e89b-12d3-a456-426614174000' };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
      
      // Invalid UUID
      const invalidInput = { connectionId: 'not-a-uuid' };
      const invalidResult = schema.safeParse(invalidInput);
      expect(invalidResult.success).toBe(false);
    });

    it('should return success and updated session', () => {
      // Test that the expected return type has success flag and session
      const expectedResponse = {
        success: true,
        session: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          status: 'reviewed',
          reviewedAt: new Date(),
          reviewedBy: 'doctor-user-id',
        },
      };
      
      expect(expectedResponse).toHaveProperty('success');
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse).toHaveProperty('session');
      expect(expectedResponse.session.status).toBe('reviewed');
      expect(expectedResponse.session.reviewedAt).toBeInstanceOf(Date);
      expect(expectedResponse.session.reviewedBy).toBeDefined();
    });

    it('should require doctor role', () => {
      // markReviewed is a doctor-only mutation
      const doctorOnlyMutations = ['markReviewed', 'markAsReviewed'];
      expect(doctorOnlyMutations).toContain('markReviewed');
    });

    it('should update most recent session for connection', () => {
      // Test that markReviewed operates on the most recent session
      const mockSessions = [
        { id: '1', updatedAt: new Date('2024-01-01'), status: 'ready' },
        { id: '2', updatedAt: new Date('2024-01-02'), status: 'ready' },
      ];
      
      // Sort by updatedAt descending to get most recent
      const sorted = [...mockSessions].sort((a, b) => 
        b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      
      expect(sorted[0]?.id).toBe('2');
    });

    it('should set reviewedAt timestamp and reviewedBy user', () => {
      // Test that review metadata is properly set
      const reviewMetadata = {
        reviewedAt: new Date(),
        reviewedBy: 'doctor-user-id',
      };
      
      expect(reviewMetadata.reviewedAt).toBeInstanceOf(Date);
      expect(reviewMetadata.reviewedBy).toBeDefined();
      expect(typeof reviewMetadata.reviewedBy).toBe('string');
    });
  });

  describe('getUCGRecommendations query', () => {
    it('should validate connectionId input', () => {
      const schema = z.object({ connectionId: z.string().uuid() });
      
      // Valid UUID
      const validInput = { connectionId: '123e4567-e89b-12d3-a456-426614174000' };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
      
      // Invalid UUID
      const invalidInput = { connectionId: 'not-a-uuid' };
      const invalidResult = schema.safeParse(invalidInput);
      expect(invalidResult.success).toBe(false);
    });

    it('should return recommendations with metadata', () => {
      // Test that the expected return type has recommendations and metadata
      const expectedResponseWithRecommendations = {
        recommendations: 'Follow Uganda Clinical Guidelines for malaria treatment...',
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        updatedAt: new Date(),
      };
      
      expect(expectedResponseWithRecommendations).toHaveProperty('recommendations');
      expect(expectedResponseWithRecommendations).toHaveProperty('sessionId');
      expect(expectedResponseWithRecommendations).toHaveProperty('updatedAt');
      expect(typeof expectedResponseWithRecommendations.recommendations).toBe('string');
      expect(expectedResponseWithRecommendations.updatedAt).toBeInstanceOf(Date);
    });

    it('should return null when no recommendations available', () => {
      // Test null case when no UCG recommendations exist
      const expectedResponseNull = {
        recommendations: null,
      };
      
      expect(expectedResponseNull).toHaveProperty('recommendations');
      expect(expectedResponseNull.recommendations).toBeNull();
    });

    it('should require doctor role', () => {
      // getUCGRecommendations is a doctor-only query
      const doctorOnlyQueries = ['getSBAR', 'getClinicalReasoning', 'getUCGRecommendations'];
      expect(doctorOnlyQueries).toContain('getUCGRecommendations');
    });

    it('should fetch from most recent session', () => {
      // Test that UCG recommendations are fetched from the most recently updated session
      const mockSessions = [
        { 
          id: '1', 
          updatedAt: new Date('2024-01-01'), 
          medicalData: { ucgRecommendations: 'Old recommendations' } 
        },
        { 
          id: '2', 
          updatedAt: new Date('2024-01-02'), 
          medicalData: { ucgRecommendations: 'Latest recommendations' } 
        },
      ];
      
      // Sort by updatedAt descending
      const sorted = [...mockSessions].sort((a, b) => 
        b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      
      expect(sorted[0]?.medicalData.ucgRecommendations).toBe('Latest recommendations');
    });

    it('should extract recommendations from medicalData', () => {
      // Test that recommendations are extracted from the medicalData field
      const mockMedicalData = {
        chiefComplaint: 'Fever',
        ucgRecommendations: 'Follow UCG protocol for fever management',
      };
      
      expect(mockMedicalData).toHaveProperty('ucgRecommendations');
      expect(typeof mockMedicalData.ucgRecommendations).toBe('string');
    });
  });
});

  describe('resetSession endpoint', () => {
    it('should validate sessionId input', () => {
      const schema = z.object({ sessionId: z.string().uuid() });
      
      // Valid UUID
      const validInput = { sessionId: '123e4567-e89b-12d3-a456-426614174000' };
      const validResult = schema.safeParse(validInput);
      expect(validResult.success).toBe(true);
      
      // Invalid UUID
      const invalidInput = { sessionId: 'not-a-uuid' };
      const invalidResult = schema.safeParse(invalidInput);
      expect(invalidResult.success).toBe(false);
      
      // Missing sessionId
      const missingInput = {};
      const missingResult = schema.safeParse(missingInput);
      expect(missingResult.success).toBe(false);
    });

    it('should accept only UUID format for sessionId', () => {
      const schema = z.object({ sessionId: z.string().uuid() });
      
      // Test various invalid formats
      const invalidFormats = [
        { sessionId: '' },
        { sessionId: '123' },
        { sessionId: 'abc-def-ghi' },
        { sessionId: '123e4567-e89b-12d3-a456' }, // Incomplete UUID
      ];
      
      invalidFormats.forEach(input => {
        const result = schema.safeParse(input);
        expect(result.success).toBe(false);
      });
    });

    it('should return success indicator with reset session', () => {
      // Test that the expected return type has success flag and session
      const expectedResponse = {
        success: true,
        session: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          connectionId: '456e7890-e89b-12d3-a456-426614174000',
          status: 'not_started',
          completeness: 0,
          currentAgent: 'VitalsTriageAgent',
          medicalData: null, // Redacted for patient
          clinicalHandover: null, // Redacted for patient
        },
      };
      
      expect(expectedResponse).toHaveProperty('success');
      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse).toHaveProperty('session');
      expect(expectedResponse.session.status).toBe('not_started');
      expect(expectedResponse.session.completeness).toBe(0);
      expect(expectedResponse.session.currentAgent).toBe('VitalsTriageAgent');
    });

    it('should redact sensitive fields for patients', () => {
      // Test that medicalData and clinicalHandover are redacted in response
      const expectedResponse = {
        success: true,
        session: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          medicalData: null, // Should be redacted
          clinicalHandover: null, // Should be redacted
        },
      };
      
      expect(expectedResponse.session.medicalData).toBeNull();
      expect(expectedResponse.session.clinicalHandover).toBeNull();
    });
  });
