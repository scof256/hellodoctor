/**
 * Unit tests for TRPC context creation
 * Tests Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTRPCContext } from '@/server/api/trpc';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock database
vi.mock('@/server/db', () => ({
  db: { query: {} },
}));

// Mock rate limiting
vi.mock('@/server/services/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}));

describe('TRPC Context Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV to test
    process.env.NODE_ENV = 'test';
  });

  it('should create context with authenticated user', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as any);

    const headers = new Headers({
      'x-forwarded-for': '192.168.1.1',
    });

    const context = await createTRPCContext({ headers });

    expect(context.userId).toBe('user_123');
    expect(context.clientIp).toBe('192.168.1.1');
    expect(context.db).toBeDefined();
  });

  it('should create context with null userId when auth fails', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockRejectedValue(new Error('Auth failed'));

    const headers = new Headers();

    const context = await createTRPCContext({ headers });

    expect(context.userId).toBeNull();
    expect(context.clientIp).toBe('unknown');
    expect(context.db).toBeDefined();
  });

  it('should extract IP from x-forwarded-for header', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const headers = new Headers({
      'x-forwarded-for': '10.0.0.1, 10.0.0.2',
    });

    const context = await createTRPCContext({ headers });

    expect(context.clientIp).toBe('10.0.0.1');
  });

  it('should extract IP from x-real-ip header when x-forwarded-for is missing', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const headers = new Headers({
      'x-real-ip': '172.16.0.1',
    });

    const context = await createTRPCContext({ headers });

    expect(context.clientIp).toBe('172.16.0.1');
  });

  it('should use "unknown" as fallback IP when no headers present', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const headers = new Headers();

    const context = await createTRPCContext({ headers });

    expect(context.clientIp).toBe('unknown');
  });

  it('should log authentication status in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: 'user_456' } as any);

    const headers = new Headers();

    await createTRPCContext({ headers });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[TRPC Context]',
      expect.objectContaining({
        timestamp: expect.any(String),
        hasAuth: true,
        userId: expect.stringContaining('user_456'),
      })
    );

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it('should log errors when auth fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { auth } = await import('@clerk/nextjs/server');
    const authError = new Error('Clerk service unavailable');
    vi.mocked(auth).mockRejectedValue(authError);

    const headers = new Headers();

    await createTRPCContext({ headers });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[TRPC Context Error]',
      expect.objectContaining({
        timestamp: expect.any(String),
        error: 'Clerk service unavailable',
        stack: expect.any(String),
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('should not throw when auth fails - allow public procedures to work', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockRejectedValue(new Error('Auth failed'));

    const headers = new Headers();

    // Should not throw
    await expect(createTRPCContext({ headers })).resolves.toBeDefined();
  });

  it('should handle auth returning null userId', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const headers = new Headers();

    const context = await createTRPCContext({ headers });

    expect(context.userId).toBeNull();
  });

  it('should handle auth returning undefined userId', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    vi.mocked(auth).mockResolvedValue({ userId: undefined } as any);

    const headers = new Headers();

    const context = await createTRPCContext({ headers });

    expect(context.userId).toBeNull();
  });
});
