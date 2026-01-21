/**
 * Unit Tests for Environment Validation
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 * 
 * Tests:
 * - Validation passes with all required variables
 * - Validation fails with missing DATABASE_URL
 * - Validation fails with missing Clerk keys
 * - Validation fails with missing AI provider keys
 * - Validation logs success message
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnvironment } from '@/lib/env-validation';

describe('Environment Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Successful Validation', () => {
    it('should pass validation with all required variables for Gemini provider', () => {
      // Requirements: 8.1, 8.5 - Validate all required variables exist
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Environment Validation] All required variables present'
      );
    });

    it('should pass validation with all required variables for OpenAI provider', () => {
      // Requirements: 8.1, 8.4 - Validate AI provider API key
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'test_openai_key';

      expect(() => validateEnvironment()).not.toThrow();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Environment Validation] All required variables present'
      );
    });

    it('should default to Gemini provider when AI_PROVIDER is not set', () => {
      // Requirements: 8.4 - Default AI provider
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      delete process.env.AI_PROVIDER;
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  describe('Missing DATABASE_URL', () => {
    it('should fail when DATABASE_URL is missing', () => {
      // Requirements: 8.2 - Invalid database connection string
      delete process.env.DATABASE_URL;
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: DATABASE_URL'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Environment Validation]',
        'Missing required environment variables: DATABASE_URL'
      );
    });

    it('should fail when DATABASE_URL is empty string', () => {
      // Requirements: 8.2 - Invalid database connection string
      process.env.DATABASE_URL = '';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: DATABASE_URL'
      );
    });

    it('should fail when DATABASE_URL is whitespace only', () => {
      // Requirements: 8.2 - Invalid database connection string
      process.env.DATABASE_URL = '   ';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: DATABASE_URL'
      );
    });
  });

  describe('Missing Clerk Keys', () => {
    it('should fail when CLERK_SECRET_KEY is missing', () => {
      // Requirements: 8.3 - Clerk secret key is required
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      delete process.env.CLERK_SECRET_KEY;
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: CLERK_SECRET_KEY'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Environment Validation]',
        'Missing required environment variables: CLERK_SECRET_KEY'
      );
    });

    it('should fail when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing', () => {
      // Requirements: 8.3 - Clerk publishable key is required
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
      );
    });

    it('should fail when both Clerk keys are missing', () => {
      // Requirements: 8.3 - Both Clerk keys are required
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
      );
    });
  });

  describe('Missing AI Provider Keys', () => {
    it('should fail when GEMINI_API_KEY is missing for Gemini provider', () => {
      // Requirements: 8.4 - AI provider API key is required
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'gemini';
      delete process.env.GEMINI_API_KEY;

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: GEMINI_API_KEY'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Environment Validation]',
        'Missing required environment variables: GEMINI_API_KEY'
      );
    });

    it('should fail when OPENAI_API_KEY is missing for OpenAI provider', () => {
      // Requirements: 8.4 - AI provider API key is required
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: OPENAI_API_KEY'
      );
    });

    it('should not require OpenAI key when using Gemini provider', () => {
      // Requirements: 8.4 - Only validate required AI provider key
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'gemini';
      process.env.GEMINI_API_KEY = 'test_gemini_key';
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironment()).not.toThrow();
    });

    it('should not require Gemini key when using OpenAI provider', () => {
      // Requirements: 8.4 - Only validate required AI provider key
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'test_openai_key';
      delete process.env.GEMINI_API_KEY;

      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  describe('Multiple Missing Variables', () => {
    it('should report all missing variables in error message', () => {
      // Requirements: 8.1, 8.5 - Comprehensive validation
      delete process.env.DATABASE_URL;
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      delete process.env.GEMINI_API_KEY;

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: DATABASE_URL, CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, GEMINI_API_KEY'
      );
    });

    it('should log all missing variables to console.error', () => {
      // Requirements: 8.1 - Log validation errors
      delete process.env.DATABASE_URL;
      delete process.env.CLERK_SECRET_KEY;

      try {
        validateEnvironment();
      } catch (error) {
        // Expected to throw
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Environment Validation]',
        expect.stringContaining('DATABASE_URL')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Environment Validation]',
        expect.stringContaining('CLERK_SECRET_KEY')
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown AI provider gracefully', () => {
      // Requirements: 8.4 - Handle unknown AI provider
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.AI_PROVIDER = 'unknown_provider';

      // Should not require any AI key for unknown provider
      expect(() => validateEnvironment()).not.toThrow();
    });

    it('should trim whitespace when checking for empty values', () => {
      // Requirements: 8.1 - Validate empty strings
      process.env.DATABASE_URL = '   ';
      process.env.CLERK_SECRET_KEY = 'sk_test_123';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.GEMINI_API_KEY = 'test_gemini_key';

      expect(() => validateEnvironment()).toThrow(
        'Missing required environment variables: DATABASE_URL'
      );
    });
  });
});
