import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Validate DATABASE_URL at module load
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const connectionString = process.env.DATABASE_URL;

// Validate connection string format
try {
  new URL(connectionString);
} catch (error) {
  throw new Error('DATABASE_URL must be a valid connection string');
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const globalForDb = globalThis as unknown as { __postgresClient?: ReturnType<typeof postgres> };

// Configure postgres client with serverless-optimized settings
const client =
  globalForDb.__postgresClient ??
  postgres(connectionString, {
    max: 1, // Single connection per serverless function
    idle_timeout: 20, // Close idle connections after 20s
    connect_timeout: 10, // 10s connection timeout for serverless
    prepare: false, // Disable prepared statements for serverless
    onnotice: () => {}, // Suppress notices in production
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__postgresClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;

/**
 * Health check function to verify database connectivity
 * Executes a simple SELECT 1 query to test the connection
 * @returns Promise<boolean> - true if database is healthy, false otherwise
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[Database Health Check] Failed', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
