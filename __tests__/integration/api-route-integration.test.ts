import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { NextRequest } from 'next/server';
import { 
  ChatRequest, 
  ChatResponse, 
  ErrorResponse, 
  INITIAL_MEDICAL_DATA, 
  Message,
  MedicalData,
  AgentRole 
} from '@/app/types';

// Mock the AI service
vi.mock('@/app/lib/ai-service', () => ({
  sendAIMessage: vi.fn()
}));

import { sendAIMessage } from '@/app/lib/ai-service';

describe('API Route Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: any): NextRequest => {
    return new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  const createMessage = (text: string, role: 'user' | 'model' = 'user'): Message => ({
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    text,
    timestamp: new Date(),
  });

  describe('End-to-End Agent Progression', () => {
    it('should progress through all agent stages in correct order', async () => {
      // Test progression: Triage -> ClinicalInvestigator -> RecordsClerk -> HistorySpecialist -> HandoverSpecialist
      
      const stages = [
        {
          stage: 'Triage',
          input: 'I have a headache',
          expectedAgent: 'ClinicalInvestigator',
          mockResponse: {
            thought: {
              differentialDiagnosis: [{ condition: 'Tension headache', probability: 'High', reasoning: 'Common presentation' }],
              missingInformation: ['Duration', 'Severity'],
              strategy: 'Funneling',
              nextMove: 'Ask about duration and severity'
            },
            reply: 'How long have you had this headache?',
            updatedData: { 
              chiefComplaint: 'Headache',
              currentAgent: 'ClinicalInvestigator' as AgentRole
            },
            activeAgent: 'ClinicalInvestigator' as AgentRole
          }
        },
        {
          stage: 'ClinicalInvestigator',
          input: 'It started 2 days ago and is getting worse',
          expectedAgent: 'RecordsClerk',
          mockResponse: {
            thought: {
              differentialDiagnosis: [{ condition: 'Migraine', probability: 'Medium', reasoning: 'Progressive worsening' }],
              missingInformation: ['Medical records'],
              strategy: 'Photo Request',
              nextMove: 'Request medical records'
            },
            reply: 'Can you upload any recent medical records or lab results?',
            updatedData: { 
              hpi: 'Headache started 2 days ago, progressively worsening',
              currentAgent: 'RecordsClerk' as AgentRole
            },
            activeAgent: 'RecordsClerk' as AgentRole
          }
        },
        {
          stage: 'RecordsClerk',
          input: 'I don\'t have any records with me',
          expectedAgent: 'HistorySpecialist',
          mockResponse: {
            thought: {
              differentialDiagnosis: [],
              missingInformation: ['Medical history', 'Medications'],
              strategy: 'Batched Questions',
              nextMove: 'Collect medical history'
            },
            reply: 'Do you have any medical conditions, take medications, or have allergies?',
            updatedData: { 
              recordsCheckCompleted: true,
              currentAgent: 'HistorySpecialist' as AgentRole
            },
            activeAgent: 'HistorySpecialist' as AgentRole
          }
        },
        {
          stage: 'HistorySpecialist',
          input: 'No medical conditions, no medications, no allergies',
          expectedAgent: 'HandoverSpecialist',
          mockResponse: {
            thought: {
              differentialDiagnosis: [],
              missingInformation: [],
              strategy: 'Final Review',
              nextMove: 'Prepare handover'
            },
            reply: 'Thank you. Let me prepare your summary for the doctor.',
            updatedData: { 
              medications: [],
              allergies: [],
              pastMedicalHistory: [],
              currentAgent: 'HandoverSpecialist' as AgentRole
            },
            activeAgent: 'HandoverSpecialist' as AgentRole
          }
        },
        {
          stage: 'HandoverSpecialist',
          input: 'Is there anything else I should mention?',
          expectedAgent: 'HandoverSpecialist',
          mockResponse: {
            thought: {
              differentialDiagnosis: [],
              missingInformation: [],
              strategy: 'Quality Control',
              nextMove: 'Complete intake'
            },
            reply: 'Your intake is complete. You can now book an appointment.',
            updatedData: { 
              bookingStatus: 'ready' as const,
              clinicalHandover: {
                situation: 'Patient with 2-day progressive headache',
                background: 'No significant medical history',
                assessment: 'Likely tension headache or migraine',
                recommendation: 'Clinical evaluation needed'
              }
            },
            activeAgent: 'HandoverSpecialist' as AgentRole
          }
        }
      ];

      let currentMedicalData: MedicalData = { ...INITIAL_MEDICAL_DATA };
      const history: Message[] = [];

      for (const stage of stages) {
        // Mock the AI service response for this stage
        (sendAIMessage as any).mockResolvedValueOnce({
          response: stage.mockResponse,
          groundingMetadata: undefined
        });

        // Add user message to history
        const userMessage = createMessage(stage.input);
        history.push(userMessage);

        // Create request
        const request: ChatRequest = {
          history: [...history],
          medicalData: currentMedicalData,
          mode: 'patient'
        };

        // Call API
        const response = await POST(createRequest(request));
        const result = await response.json() as ChatResponse;

        // Verify response structure
        expect(result.response).toBeDefined();
        expect(result.response.reply).toBe(stage.mockResponse.reply);
        expect(result.response.activeAgent).toBe(stage.expectedAgent);

        // Update medical data for next iteration
        currentMedicalData = {
          ...currentMedicalData,
          ...stage.mockResponse.updatedData
        };

        // Add AI response to history
        const aiMessage = createMessage(stage.mockResponse.reply, 'model');
        aiMessage.activeAgent = stage.mockResponse.activeAgent;
        history.push(aiMessage);
      }

      // Verify final state
      expect(currentMedicalData.bookingStatus).toBe('ready');
      expect(currentMedicalData.clinicalHandover).toBeDefined();
      expect(currentMedicalData.chiefComplaint).toBe('Headache');
    });

    it('should handle error recovery scenarios gracefully', async () => {
      const testCases = [
        {
          name: 'AI service throws error',
          mockError: new Error('API rate limit exceeded'),
          expectedErrorType: 'Internal server error'
        },
        {
          name: 'AI service throws API key error',
          mockError: new Error('API_KEY not configured'),
          expectedErrorType: 'Configuration error'
        }
      ];

      for (const testCase of testCases) {
        // Mock AI service to throw error
        (sendAIMessage as any).mockRejectedValueOnce(testCase.mockError);

        const request: ChatRequest = {
          history: [createMessage('Test message')],
          medicalData: INITIAL_MEDICAL_DATA,
          mode: 'patient'
        };

        const response = await POST(createRequest(request));
        const result = await response.json() as ErrorResponse;

        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(result.error).toBe(testCase.expectedErrorType);
        
        // Check for specific error message patterns
        if (testCase.name.includes('API key')) {
          expect(result.details).toContain('API key not configured');
        } else {
          expect(result.details).toContain(testCase.mockError.message);
        }
      }
    });

    it('should validate request parameters correctly', async () => {
      const invalidRequests = [
        {
          name: 'missing history',
          body: { medicalData: INITIAL_MEDICAL_DATA, mode: 'patient' },
          expectedError: 'history must be an array of messages'
        },
        {
          name: 'invalid history type',
          body: { history: 'not-an-array', medicalData: INITIAL_MEDICAL_DATA, mode: 'patient' },
          expectedError: 'history must be an array of messages'
        },
        {
          name: 'missing medicalData',
          body: { history: [], mode: 'patient' },
          expectedError: 'medicalData is required'
        },
        {
          name: 'invalid mode',
          body: { history: [], medicalData: INITIAL_MEDICAL_DATA, mode: 'invalid' },
          expectedError: 'mode must be "patient" or "doctor"'
        },
        {
          name: 'missing mode',
          body: { history: [], medicalData: INITIAL_MEDICAL_DATA },
          expectedError: 'mode must be "patient" or "doctor"'
        }
      ];

      for (const invalidRequest of invalidRequests) {
        const response = await POST(createRequest(invalidRequest.body));
        const result = await response.json() as ErrorResponse;

        expect(response.status).toBe(400);
        expect(result.error).toBe('Missing required field');
        expect(result.details).toBe(invalidRequest.expectedError);
      }
    });

    it('should handle both patient and doctor modes', async () => {
      const modes: Array<'patient' | 'doctor'> = ['patient', 'doctor'];

      for (const mode of modes) {
        const mockResponse = {
          thought: {
            differentialDiagnosis: [],
            missingInformation: [],
            strategy: 'Test',
            nextMove: 'Test'
          },
          reply: `Response in ${mode} mode`,
          updatedData: {},
          activeAgent: 'ClinicalInvestigator' as AgentRole
        };

        (sendAIMessage as any).mockResolvedValueOnce({
          response: mockResponse,
          groundingMetadata: undefined
        });

        const request: ChatRequest = {
          history: [createMessage('Test message')],
          medicalData: INITIAL_MEDICAL_DATA,
          mode
        };

        const response = await POST(createRequest(request));
        const result = await response.json() as ChatResponse;

        expect(response.status).toBe(200);
        expect(result.response.reply).toBe(`Response in ${mode} mode`);

        // Verify sendAIMessage was called with correct mode
        expect(sendAIMessage).toHaveBeenCalledWith(
          expect.any(Array),
          INITIAL_MEDICAL_DATA,
          mode
        );
      }
    });

    it('should preserve message history and medical data state', async () => {
      const mockResponse = {
        thought: {
          differentialDiagnosis: [],
          missingInformation: [],
          strategy: 'Test',
          nextMove: 'Test'
        },
        reply: 'Test response',
        updatedData: { chiefComplaint: 'Test complaint' },
        activeAgent: 'ClinicalInvestigator' as AgentRole
      };

      (sendAIMessage as any).mockResolvedValueOnce({
        response: mockResponse,
        groundingMetadata: undefined
      });

      const initialHistory = [
        createMessage('First message'),
        createMessage('Second message', 'model')
      ];

      const updatedMedicalData = {
        ...INITIAL_MEDICAL_DATA,
        chiefComplaint: 'Existing complaint'
      };

      const request: ChatRequest = {
        history: initialHistory,
        medicalData: updatedMedicalData,
        mode: 'patient'
      };

      const response = await POST(createRequest(request));
      const result = await response.json() as ChatResponse;

      expect(response.status).toBe(200);
      
      // Verify sendAIMessage received the correct history and medical data
      expect(sendAIMessage).toHaveBeenCalledWith(
        expect.any(Array),
        updatedMedicalData,
        'patient'
      );
      
      // Verify the history structure
      const callArgs = (sendAIMessage as any).mock.calls[0];
      expect(callArgs[0]).toHaveLength(2);
      expect(callArgs[0][0]).toMatchObject({
        role: 'user',
        text: 'First message'
      });
      expect(callArgs[0][1]).toMatchObject({
        role: 'model',
        text: 'Second message'
      });
    });
  });
});