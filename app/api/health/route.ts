import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/server/db';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * Health check endpoint for monitoring system availability
 * 
 * Checks:
 * - Database connectivity
 * - Clerk authentication service availability
 * 
 * Returns:
 * - 200 with status "healthy" if all services are operational
 * - 503 with status "unhealthy" if any critical service is down
 * 
 * Response includes:
 * - timestamp: ISO 8601 timestamp of the check
 * - database: boolean indicating database health
 * - auth: boolean indicating auth service health
 * - uptime: server uptime in seconds
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const checks = {
    database: false,
    auth: false,
    timestamp,
  };
  
  // Check database connectivity
  try {
    checks.database = await checkDatabaseHealth();
  } catch (error) {
    console.error('[Health Check] Database check failed', {
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  // Check Clerk authentication service availability
  try {
    await auth();
    checks.auth = true;
  } catch (error) {
    console.error('[Health Check] Auth check failed', {
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  
  // Determine overall health status
  const allHealthy = checks.database && checks.auth;
  const status = allHealthy ? 'healthy' : 'unhealthy';
  
  // Calculate uptime in seconds
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  
  // Build response with reason if unhealthy
  const response: any = {
    status,
    checks,
    uptime: uptimeSeconds,
  };
  
  // Add reason field if unhealthy
  if (!allHealthy) {
    if (!checks.database && !checks.auth) {
      response.reason = 'database,auth';
    } else if (!checks.database) {
      response.reason = 'database';
    } else if (!checks.auth) {
      response.reason = 'auth';
    }
  }
  
  return NextResponse.json(response, { status: allHealthy ? 200 : 503 });
}
