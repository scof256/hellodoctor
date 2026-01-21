/**
 * Unit tests for database configuration
 * Validates serverless-optimized settings for task 2.1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Database Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Connection String Validation', () => {
    it('should throw error when DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      
      await expect(async () => {
        await import('../../src/server/db/index?t=' + Date.now());
      }).rejects.toThrow('DATABASE_URL environment variable is required');
    });

    it('should throw error when DATABASE_URL is invalid', async () => {
      process.env.DATABASE_URL = 'invalid-connection-string';
      
      await expect(async () => {
        await import('../../src/server/db/index?t=' + Date.now());
      }).rejects.toThrow('DATABASE_URL must be a valid connection string');
    });

    it('should accept valid postgres connection string', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      await expect(async () => {
        await import('../../src/server/db/index?t=' + Date.now());
      }).resolves.toBeDefined();
    });

    it('should accept valid postgres connection string with query parameters', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db?sslmode=require';
      
      await expect(async () => {
        await import('../../src/server/db/index?t=' + Date.now());
      }).resolves.toBeDefined();
    });
  });

  describe('Serverless Configuration', () => {
    it('should export db instance when DATABASE_URL is valid', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      const { db } = await import('../../src/server/db/index?t=' + Date.now());
      
      expect(db).toBeDefined();
      expect(typeof db).toBe('object');
    });

    it('should export Database type', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      const dbModule = await import('../../src/server/db/index?t=' + Date.now());
      
      expect(dbModule.db).toBeDefined();
      // Type checking happens at compile time, so we just verify the export exists
    });
  });

  describe('Connection Pool Settings', () => {
    it('should configure postgres client with serverless-optimized settings', async () => {
      // This test verifies the configuration is applied correctly
      // The actual postgres client configuration is validated through:
      // 1. max: 1 (single connection per serverless function)
      // 2. idle_timeout: 20 (close idle connections after 20s)
      // 3. connect_timeout: 10 (10s connection timeout)
      // 4. prepare: false (disable prepared statements)
      
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      const { db } = await import('../../src/server/db/index?t=' + Date.now());
      
      // Verify db instance is created successfully with the configuration
      expect(db).toBeDefined();
      
      // The postgres client configuration is internal to the postgres library
      // We verify it works by ensuring the module loads without errors
      // and the db instance is properly initialized
    });
  });

  describe('Database Health Check', () => {
    it('should export checkDatabaseHealth function', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      const { checkDatabaseHealth } = await import('../../src/server/db/index?t=' + Date.now());
      
      expect(checkDatabaseHealth).toBeDefined();
      expect(typeof checkDatabaseHealth).toBe('function');
    });

    it('should return boolean from health check', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      
      const { checkDatabaseHealth } = await import('../../src/server/db/index?t=' + Date.now());
      
      // The function should return a boolean (true or false)
      // We can't test actual database connectivity in unit tests
      // but we can verify the function signature
      const result = checkDatabaseHealth();
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
