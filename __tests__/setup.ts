import '@testing-library/jest-dom';

// Set required environment variables for tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-clerk-publishable-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
process.env.AI_PROVIDER = 'gemini';