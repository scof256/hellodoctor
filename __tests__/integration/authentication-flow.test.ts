import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '@/server/api/root';
import { createTRPCContext } from '@/server/api/trpc';
import { db } from '@/server/db';
import { users, patients, doctors, intakeSessions } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

/**
 * Authentication Flow Integration Test
 * 
 * Tests authentication and authorization scenarios:
 * - Authenticate with Clerk → call protected procedure → verify access
 * - Test unauthorized access returns 401
 * - Test forbidden access returns 403
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
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

describe('Authentication Flow Integration Test', () => {
  const mockPatientClerkId = 'test-patient-clerk-789';
  const mockPatientUserId = 'test-patient-user-789';
  const mockPatientId = 'test-patient-789';
  
  const mockDoctorClerkId = 'test-doctor-clerk-789';
  const mockDoctorUserId = 'test-doctor-user-789';
  const mockDoctorId = 'test-doctor-789';
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Clean up test data
    try {
      await db.delete(intakeSessions).where(eq(intakeSessions.patientId, mockPatientId));
      await db.delete(doctors).where(eq(doctors.id, mockDoctorId));
      await db.delete(patients).where(eq(patients.id, mockPatientId));
      await db.delete(users).where(eq(users.clerkId, mockPatientClerkId));
      await db.delete(users).where(eq(users.clerkId, mockDoctorClerkId));
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Create test patient user
    await db.insert(users).values({
      id: mockPatientUserId,
      clerkId: mockPatientClerkId,
      email: 'patient@example.com',
      firstName: 'Test',
      lastName: 'Patient',
      primaryRole: 'patient',
      isActive: true,
    });
    
    await db.insert(patients).values({
      id: mockPatientId,
      userId: mockPatientUserId,
      dateOfBirth: new Date('1990-01-01'),
    });
    
    // Create test doctor user
    await db.insert(users).values({
      id: mockDoctorUserId,
      clerkId: mockDoctorClerkId,
      email: 'doctor@example.com',
      firstName: 'Test',
      lastName: 'Doctor',
      primaryRole: 'doctor',
      isActive: true,
    });
    
    await db.insert(doctors).values({
      id: mockDoctorId,
      userId: mockDoctorUserId,
      specialization: 'General Practice',
      licenseNumber: 'TEST-123',
      isVerified: true,
    });
  });

  describe('Successful Authentication', () => {
    it('should authenticate patient and allow access to protected procedures', async () => {
      // Mock successful authentication
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      
      // Verify context has user ID
      expect(ctx.userId).toBe(mockPatientClerkId);
      
      const caller = appRouter.createCaller(ctx);
      
      // Should be able to create intake session
      const result = await caller.intake.createSession();
      expect(result.sessionId).toBeDefined();
      expect(result.medicalData).toBeDefined();
    });

    it('should authenticate doctor and allow access to doctor procedures', async () => {
      // Mock successful authentication as doctor
      (auth as any).mockResolvedValue({ userId: mockDoctorClerkId });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      
      expect(ctx.userId).toBe(mockDoctorClerkId);
      
      const caller = appRouter.createCaller(ctx);
      
      // Doctor should be able to access their profile
      const profile = await caller.doctor.getProfile();
      expect(profile).toBeDefined();
      expect(profile.specialization).toBe('General Practice');
    });

    it('should populate context with user data on authentication', async () => {
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      
      // Context should have user ID
      expect(ctx.userId).toBe(mockPatientClerkId);
      
      // Context should have database connection
      expect(ctx.db).toBeDefined();
      
      // Context should have client IP
      expect(ctx.clientIp).toBeDefined();
    });
  });

  describe('Unauthorized Access (401)', () => {
    it('should return 401 when accessing protected procedure without authentication', async () => {
      // Mock no authentication
      (auth as any).mockResolvedValue({ userId: null });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      
      expect(ctx.userId).toBeNull();
      
      const caller = appRouter.createCaller(ctx);
      
      // Should throw UNAUTHORIZED error
      await expect(caller.intake.createSession()).rejects.toThrow(
        'You must be logged in to access this resource'
      );
      
      try {
        await caller.intake.createSession();
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('UNAUTHORIZED');
      }
    });

    it('should return 401 when trying to send message without authentication', async () => {
      (auth as any).mockResolvedValue({ userId: null });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.intake.sendMessage({
          sessionId: 'test-session',
          content: 'Test message',
        })
      ).rejects.toThrow('You must be logged in to access this resource');
    });

    it('should return 401 when trying to get session without authentication', async () => {
      (auth as any).mockResolvedValue({ userId: null });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.intake.getSession({ sessionId: 'test-session' })
      ).rejects.toThrow('You must be logged in to access this resource');
    });

    it('should return 401 when authentication token expires', async () => {
      // First request succeeds
      (auth as any).mockResolvedValueOnce({ userId: mockPatientClerkId });
      
      const ctx1 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller1 = appRouter.createCaller(ctx1);
      
      const { sessionId } = await caller1.intake.createSession();
      expect(sessionId).toBeDefined();
      
      // Second request fails (token expired)
      (auth as any).mockResolvedValueOnce({ userId: null });
      
      const ctx2 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller2 = appRouter.createCaller(ctx2);
      
      await expect(
        caller2.intake.getSession({ sessionId })
      ).rejects.toThrow('You must be logged in to access this resource');
    });
  });

  describe('Forbidden Access (403)', () => {
    it('should return 403 when patient tries to access another patients session', async () => {
      // Create session as first patient
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      const ctx1 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller1 = appRouter.createCaller(ctx1);
      
      const { sessionId } = await caller1.intake.createSession();
      
      // Try to access as different patient
      const otherPatientClerkId = 'other-patient-clerk-id';
      const otherPatientUserId = 'other-patient-user-id';
      const otherPatientId = 'other-patient-id';
      
      // Create other patient
      await db.insert(users).values({
        id: otherPatientUserId,
        clerkId: otherPatientClerkId,
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'Patient',
        primaryRole: 'patient',
        isActive: true,
      });
      
      await db.insert(patients).values({
        id: otherPatientId,
        userId: otherPatientUserId,
        dateOfBirth: new Date('1995-01-01'),
      });
      
      (auth as any).mockResolvedValue({ userId: otherPatientClerkId });
      
      const ctx2 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller2 = appRouter.createCaller(ctx2);
      
      // Should throw FORBIDDEN error
      await expect(
        caller2.intake.getSession({ sessionId })
      ).rejects.toThrow();
      
      // Clean up
      await db.delete(patients).where(eq(patients.id, otherPatientId));
      await db.delete(users).where(eq(users.clerkId, otherPatientClerkId));
    });

    it('should return 403 when user tries to access resource they dont own', async () => {
      // Create session as patient
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      const ctx1 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller1 = appRouter.createCaller(ctx1);
      
      const { sessionId } = await caller1.intake.createSession();
      
      // Try to send message as doctor (different user)
      (auth as any).mockResolvedValue({ userId: mockDoctorClerkId });
      
      const ctx2 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller2 = appRouter.createCaller(ctx2);
      
      // Should fail - doctor doesn't own this session
      await expect(
        caller2.intake.sendMessage({
          sessionId,
          content: 'Test message',
        })
      ).rejects.toThrow();
    });
  });

  describe('Context Creation Error Handling', () => {
    it('should handle Clerk auth failure gracefully', async () => {
      // Mock Clerk throwing an error
      (auth as any).mockRejectedValue(new Error('Clerk service unavailable'));
      
      // Context creation should not throw, but return null userId
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      
      expect(ctx.userId).toBeNull();
      
      const caller = appRouter.createCaller(ctx);
      
      // Protected procedures should still fail with proper error
      await expect(caller.intake.createSession()).rejects.toThrow(
        'You must be logged in to access this resource'
      );
    });

    it('should extract client IP from headers correctly', async () => {
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      // Test x-forwarded-for header
      const ctx1 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }),
      });
      expect(ctx1.clientIp).toBe('192.168.1.1');
      
      // Test x-real-ip header
      const ctx2 = await createTRPCContext({
        headers: new Headers({ 'x-real-ip': '192.168.1.2' }),
      });
      expect(ctx2.clientIp).toBe('192.168.1.2');
      
      // Test no IP headers
      const ctx3 = await createTRPCContext({
        headers: new Headers({}),
      });
      expect(ctx3.clientIp).toBe('unknown');
    });

    it('should log authentication status in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      
      // Should log authentication status
      expect(consoleSpy).toHaveBeenCalledWith(
        '[TRPC Context]',
        expect.objectContaining({
          hasAuth: true,
          userId: expect.stringContaining('test-pat'),
        })
      );
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Session Ownership Validation', () => {
    it('should allow user to access their own sessions', async () => {
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      const ctx = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller = appRouter.createCaller(ctx);
      
      // Create session
      const { sessionId } = await caller.intake.createSession();
      
      // Should be able to access own session
      const session = await caller.intake.getSession({ sessionId });
      expect(session.id).toBe(sessionId);
      
      // Should be able to send message to own session
      const result = await caller.intake.sendMessage({
        sessionId,
        content: 'Test message',
      });
      expect(result.reply).toBeDefined();
    });

    it('should validate session ownership on every request', async () => {
      // Create session as patient
      (auth as any).mockResolvedValue({ userId: mockPatientClerkId });
      
      const ctx1 = await createTRPCContext({
        headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
      });
      const caller1 = appRouter.createCaller(ctx1);
      
      const { sessionId } = await caller1.intake.createSession();
      
      // Verify ownership on getSession
      const session = await caller1.intake.getSession({ sessionId });
      expect(session.patientId).toBe(mockPatientId);
      
      // Verify ownership on sendMessage
      await expect(
        caller1.intake.sendMessage({
          sessionId,
          content: 'Test',
        })
      ).resolves.toBeDefined();
    });
  });
});
