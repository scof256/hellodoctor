/**
 * Unit tests for health check endpoint
 * Tests the /api/health endpoint functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/health/route';
import { checkDatabaseHealth } from '@/server/db';
import { auth } from '@clerk/nextjs/server';

// Mock dependencies
vi.mock('@/server/db', () => ({
  checkDatabaseHealth: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

const mockCheckDatabaseHealth = checkDatabaseHealth as ReturnType<typeof vi.fn>;
const mockAuth = auth as ReturnType<typeof vi.fn>;

describe('Health Check Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 with healthy status when all services are operational', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(true);
      mockAuth.mockResolvedValue({ userId: 'test-user' } as any);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.checks.database).toBe(true);
      expect(data.checks.auth).toBe(true);
      expect(data.checks.timestamp).toBeDefined();
      expect(typeof data.checks.timestamp).toBe('string');
      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.reason).toBeUndefined();
    });

    it('should return 503 with unhealthy status when database is down', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(false);
      mockAuth.mockResolvedValue({ userId: 'test-user' } as any);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.checks.database).toBe(false);
      expect(data.checks.auth).toBe(true);
      expect(data.reason).toBe('database');
      expect(data.uptime).toBeDefined();
    });

    it('should return 503 with unhealthy status when auth service is down', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(true);
      mockAuth.mockRejectedValue(new Error('Auth service unavailable'));

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.checks.database).toBe(true);
      expect(data.checks.auth).toBe(false);
      expect(data.reason).toBe('auth');
      expect(data.uptime).toBeDefined();
    });

    it('should return 503 with unhealthy status when both services are down', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(false);
      mockAuth.mockRejectedValue(new Error('Auth service unavailable'));

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.checks.database).toBe(false);
      expect(data.checks.auth).toBe(false);
      expect(data.reason).toBe('database,auth');
      expect(data.uptime).toBeDefined();
    });

    it('should handle database check throwing an error', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockRejectedValue(new Error('Database connection failed'));
      mockAuth.mockResolvedValue({ userId: 'test-user' } as any);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.checks.database).toBe(false);
      expect(data.checks.auth).toBe(true);
      expect(data.reason).toBe('database');
      expect(console.error).toHaveBeenCalledWith(
        '[Health Check] Database check failed',
        expect.objectContaining({
          timestamp: expect.any(String),
          error: 'Database connection failed',
        })
      );
    });

    it('should include timestamp in ISO 8601 format', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(true);
      mockAuth.mockResolvedValue({ userId: 'test-user' } as any);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(data.checks.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should log errors when database check fails', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      mockCheckDatabaseHealth.mockRejectedValue(dbError);
      mockAuth.mockResolvedValue({ userId: 'test-user' } as any);

      // Act
      await GET();

      // Assert
      expect(console.error).toHaveBeenCalledWith(
        '[Health Check] Database check failed',
        expect.objectContaining({
          error: 'Connection timeout',
        })
      );
    });

    it('should log errors when auth check fails', async () => {
      // Arrange
      const authError = new Error('Auth service timeout');
      mockCheckDatabaseHealth.mockResolvedValue(true);
      mockAuth.mockRejectedValue(authError);

      // Act
      await GET();

      // Assert
      expect(console.error).toHaveBeenCalledWith(
        '[Health Check] Auth check failed',
        expect.objectContaining({
          error: 'Auth service timeout',
        })
      );
    });

    it('should handle auth returning null (no user logged in)', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(true);
      mockAuth.mockResolvedValue({ userId: null } as any);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.checks.auth).toBe(true);
    });

    it('should include uptime in seconds', async () => {
      // Arrange
      mockCheckDatabaseHealth.mockResolvedValue(true);
      mockAuth.mockResolvedValue({ userId: 'test-user' } as any);

      // Act
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
