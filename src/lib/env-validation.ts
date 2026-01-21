/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at application startup.
 * Throws descriptive errors if any required variables are missing.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

/**
 * Validates required environment variables at application startup.
 * Throws descriptive errors if any required variables are missing.
 * 
 * @throws {Error} If any required environment variables are missing
 */
export function validateEnvironment(): void {
  const required: Record<string, string | undefined> = {
    DATABASE_URL: process.env.DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  };
  
  // Validate AI provider configuration
  const aiProvider = process.env.AI_PROVIDER || 'gemini';
  if (aiProvider === 'gemini') {
    required['GEMINI_API_KEY'] = process.env.GEMINI_API_KEY;
  } else if (aiProvider === 'openai') {
    required['OPENAI_API_KEY'] = process.env.OPENAI_API_KEY;
  }
  
  const missing: string[] = [];
  for (const [key, value] of Object.entries(required)) {
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    const error = `Missing required environment variables: ${missing.join(', ')}`;
    console.error('[Environment Validation]', error);
    throw new Error(error);
  }
  
  console.log('[Environment Validation] All required variables present');
}
