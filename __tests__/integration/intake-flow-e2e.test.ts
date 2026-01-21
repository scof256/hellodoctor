import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';
import { db } from '@/server/db';
import { users, patients, intakeSessions, intakeMessages } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * End-to-End Intake Flow Integration Test
 * 
 * Tests the complete intake flow: create session → send message → get session
 * Validates data consistency across operations and proper error handling.
 * 
 * Requirements: 1.1, 1.2, 2.1, 4.1, 4.2
 */

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock AI service
vi.mock('@/app/lib/gemini-service', () => ({
  sendAIMessage: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { sendAIMessage } from '@/app/lib/gemini-service';

describe('End-to-End Intake Flow Integration Test', () => {
  const mockClerkId = 'test-clerk-user-123';
  const mockUserId = 'test-user-id';
  const mockPatientId = 'test-patient-id';
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock successful authentication
    (auth as any).mockResolvedValue({ userId: mockClerkId });
    
    // Clean up test data
    try {
      await db.delete(intakeMessages).where(eq(intakeMessages.sessionId, 'test-session-id'));
      await db.delete(intakeSessions).where(eq(intakeSessions.id, 'test-session-id'));
      await db.delete(patients).where(eq(patients.id, mockPatientId));
      await db.delete(users).where(eq(users.clerkId, mockClerkId));
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Create test user and patient
    await db.insert(users).values({
      id: mockUserId,
      clerkId: mockClerkId,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      primaryRole: 'patient',
      isActive: true,
    });
    
    await db.insert(patients).values({
      id: mockPatientId,
      userId: mockUserId,
      dateOfBirth: new Date('1990-01-01'),
    });
  });

  it('should complete full intake flow: create → send → get', async () => {
    // Create TRPC context
    const ctx = await createTRPCContext({
      headers: new Headers({
        'x-forwarded-for': '127.0.0.1',
      }),
    });
    
    // Create caller
    const caller = appRouter.createCaller(ctx);
    
    // Step 1: Create intake session
    const createResult = await caller.intake.createSession();
    
    expect(createResult).toBeDefined();
    expect(createResult.sessionId).toBeDefined();
    expect(createResult.medicalData).toBeDefined();
    expect(createResult.medicalData.currentAgent).toBe('Triage');
    
    const sessionId = createResult.sessionId;
    
    // Step 2: Send a message
    const mockAIResponse = {
      response: {
        reply: 'Hello! What brings you in today?',
        updatedData: {
          currentAgent: 'ClinicalInvestigator',
        },
        thought: {
          differentialDiagnosis: [],
          missingInformation: ['Chief complaint'],
          strategy: 'Open-ended question',
          nextMove: 'Gather chief complaint',
        },
        activeAgent: 'ClinicalInvestigator',
      },
      groundingMetadata: null,
    };
    
    (sendAIMessage as any).mockResolvedValueOnce(mockAIResponse);
    
    const sendResult = await caller.intake.sendMessage({
      sessionId,
      content: 'I have a headache',
    });
    
    expect(sendResult).toBeDefined();
    expect(sendResult.reply).toBe('Hello! What brings you in today?');
    expect(sendResult.medicalData.currentAgent).toBe('ClinicalInvestigator');
    
    // Step 3: Get session to verify data consistency
    const getResult = await caller.intake.getSession({ sessionId });
    
    expect(getResult).toBeDefined();
    expect(getResult.id).toBe(sessionId);
    expect(getResult.medicalData.currentAgent).toBe('ClinicalInvestigator');
    expect(getResult.messages).toHaveLength(2); // User message + AI response
    
    // Verify message order and content
    expect(getResult.messages[0].role).toBe('user');
    expect(getResult.messages[0].content).toBe('I have a headache');
    expect(getResult.messages[1].role).toBe('assistant');
    expect(getResult.messages[1].content).toBe('Hello! What brings you in today?');
    
    // Verify data consistency
    expect(getResult.medicalData).toMatchObject(sendResult.medicalData);
  });

  it('should handle multiple messages in sequence', async () => {
    const ctx = await createTRPCContext({
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    });
    const caller = appRouter.createCaller(ctx);
    
    // Create session
    const { sessionId } = await caller.intake.createSession();
    
    // Send multiple messages
    const messages = [
      { user: 'I have a headache', ai: 'How long have you had this headache?' },
      { user: 'For 2 days', ai: 'Is it getting worse?' },
      { user: 'Yes, it is', ai: 'Do you have any other symptoms?' },
    ];
    
    for (const msg of messages) {
      (sendAIMessage as any).mockResolvedValueOnce({
        response: {
          reply: msg.ai,
          updatedData: {},
          thought: {
            differentialDiagnosis: [],
            missingInformation: [],
            strategy: 'Test',
            nextMove: 'Test',
          },
          activeAgent: 'ClinicalInvestigator',
        },
        groundingMetadata: null,
      });
      
      await caller.intake.sendMessage({
        sessionId,
        content: msg.user,
      });
    }
    
    // Verify all messages are stored
    const session = await caller.intake.getSession({ sessionId });
    expect(session.messages).toHaveLength(6); // 3 user + 3 AI messages
    
    // Verify message order
    for (let i = 0; i < messages.length; i++) {
      expect(session.messages[i * 2].content).toBe(messages[i].user);
      expect(session.messages[i * 2 + 1].content).toBe(messages[i].ai);
    }
  });

  it('should maintain data consistency across operations', async () => {
    const ctx = await createTRPCContext({
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    });
    const caller = appRouter.createCaller(ctx);
    
    const { sessionId } = await caller.intake.createSession();
    
    // Send message that updates medical data
    (sendAIMessage as any).mockResolvedValueOnce({
      response: {
        reply: 'Thank you for sharing',
        updatedData: {
          chiefComplaint: 'Headache',
          hpi: 'Patient reports headache for 2 days',
          currentAgent: 'ClinicalInvestigator',
        },
        thought: {
          differentialDiagnosis: [
            { condition: 'Tension headache', probability: 'High', reasoning: 'Common' },
          ],
          missingInformation: [],
          strategy: 'Test',
          nextMove: 'Test',
        },
        activeAgent: 'ClinicalInvestigator',
      },
      groundingMetadata: null,
    });
    
    const sendResult = await caller.intake.sendMessage({
      sessionId,
      content: 'I have a headache for 2 days',
    });
    
    // Verify medical data was updated
    expect(sendResult.medicalData.chiefComplaint).toBe('Headache');
    expect(sendResult.medicalData.hpi).toBe('Patient reports headache for 2 days');
    
    // Get session and verify data persisted
    const getResult = await caller.intake.getSession({ sessionId });
    expect(getResult.medicalData.chiefComplaint).toBe('Headache');
    expect(getResult.medicalData.hpi).toBe('Patient reports headache for 2 days');
    expect(getResult.medicalData.currentAgent).toBe('ClinicalInvestigator');
  });

  it('should handle session not found error', async () => {
    const ctx = await createTRPCContext({
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    });
    const caller = appRouter.createCaller(ctx);
    
    // Try to get non-existent session
    await expect(
      caller.intake.getSession({ sessionId: 'non-existent-session' })
    ).rejects.toThrow('Intake session not found');
    
    // Try to send message to non-existent session
    await expect(
      caller.intake.sendMessage({
        sessionId: 'non-existent-session',
        content: 'Test message',
      })
    ).rejects.toThrow('Intake session not found');
  });

  it('should handle unauthorized access', async () => {
    // Mock unauthenticated request
    (auth as any).mockResolvedValue({ userId: null });
    
    const ctx = await createTRPCContext({
      headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    });
    const caller = appRouter.createCaller(ctx);
    
    // All operations should fail with unauthorized error
    await expect(caller.intake.createSession()).rejects.toThrow(
      'You must be logged in to access this resource'
    );
    
    await expect(
      caller.intake.getSession({ sessionId: 'test-session' })
    ).rejects.toThrow('You must be logged in to access this resource');
    
    await expect(
      caller.intake.sendMessage({
        sessionId: 'test-session',
        content: 'Test',
      })
    ).rejects.toThrow('You must be logged in to access this resource');
  });
});
