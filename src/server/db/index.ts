import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
const globalForDb = globalThis as unknown as { __postgresClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.__postgresClient ??
  postgres(connectionString, {
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 60, // Increased for Neon cold starts
    keep_alive: 60,
    max: 1, // Limit connections in development
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__postgresClient = client;
}

export const db = drizzle(client, { schema });

export type Database = typeof db;
