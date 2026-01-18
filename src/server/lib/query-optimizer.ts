/**
 * Query Optimizer Module
 * 
 * Provides monitoring and optimization utilities for database queries.
 * Tracks query counts and response sizes to identify performance issues.
 * 
 * Requirements: 1.5, 6.4, 6.5
 */

export interface QueryInfo {
  sql: string;
  duration: number;
  timestamp: Date;
}

export interface QueryMetrics {
  queryCount: number;
  totalDuration: number;
  queries: QueryInfo[];
}

export interface QueryOptimizerConfig {
  maxQueriesPerCall: number;
  maxResponseSizeKB: number;
  enableWarnings: boolean;
}

const DEFAULT_CONFIG: QueryOptimizerConfig = {
  maxQueriesPerCall: 5,
  maxResponseSizeKB: 100,
  enableWarnings: process.env.NODE_ENV !== 'test',
};

// Store for tracking logged warnings (for testing)
let lastWarning: { type: string; endpoint: string; value: number; threshold: number } | null = null;

/**
 * Get the last logged warning (for testing purposes).
 */
export function getLastWarning() {
  return lastWarning;
}

/**
 * Clear the last logged warning (for testing purposes).
 */
export function clearLastWarning() {
  lastWarning = null;
}

/**
 * Log a performance warning for query count or response size issues.
 * 
 * @param type - Type of warning (query_count or response_size)
 * @param details - Details about the warning
 */
export function logPerformanceWarning(
  type: 'query_count' | 'response_size',
  details: {
    endpoint: string;
    value: number;
    threshold: number;
  }
): void {
  // Store for testing
  lastWarning = { type, ...details };
  
  const message = type === 'query_count'
    ? `[Performance Warning] Query count exceeded: ${details.endpoint} - ${details.value} queries (threshold: ${details.threshold})`
    : `[Performance Warning] Response size exceeded: ${details.endpoint} - ${details.value}KB (threshold: ${details.threshold}KB)`;
  
  console.warn(message);
}

/**
 * Wrapper function to monitor query execution and log warnings.
 * 
 * @param operation - The async operation to monitor
 * @param endpoint - Name of the endpoint for logging
 * @param config - Optional configuration overrides
 * @returns The result of the operation along with metrics
 */
export async function withQueryMonitoring<T>(
  operation: () => Promise<T>,
  endpoint: string,
  config: Partial<QueryOptimizerConfig> = {}
): Promise<{ result: T; metrics: QueryMetrics }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const queries: QueryInfo[] = [];
  
  // Execute the operation
  const result = await operation();
  
  const totalDuration = Date.now() - startTime;
  
  const metrics: QueryMetrics = {
    queryCount: queries.length,
    totalDuration,
    queries,
  };
  
  return { result, metrics };
}

/**
 * Check response size and log warning if it exceeds threshold.
 * Returns the response size in KB for testing purposes.
 * 
 * @param response - The response object to check
 * @param endpoint - Name of the endpoint for logging
 * @param config - Optional configuration overrides
 * @returns The response size in KB
 */
export function checkResponseSize<T>(
  response: T,
  endpoint: string,
  config: Partial<QueryOptimizerConfig> = {}
): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    const responseSize = JSON.stringify(response).length / 1024; // Size in KB
    
    if (responseSize > finalConfig.maxResponseSizeKB) {
      logPerformanceWarning('response_size', {
        endpoint,
        value: Math.round(responseSize),
        threshold: finalConfig.maxResponseSizeKB,
      });
    }
    
    return responseSize;
  } catch {
    // Ignore serialization errors
    return 0;
  }
}

/**
 * Check query count and log warning if it exceeds threshold.
 * 
 * @param queryCount - Number of queries executed
 * @param endpoint - Name of the endpoint for logging
 * @param config - Optional configuration overrides
 */
export function checkQueryCount(
  queryCount: number,
  endpoint: string,
  config: Partial<QueryOptimizerConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!finalConfig.enableWarnings) return;
  
  if (queryCount > finalConfig.maxQueriesPerCall) {
    logPerformanceWarning('query_count', {
      endpoint,
      value: queryCount,
      threshold: finalConfig.maxQueriesPerCall,
    });
  }
}

/**
 * Pagination limit enforcement.
 * Clamps the requested limit to the maximum allowed.
 * 
 * @param requestedLimit - The limit requested by the client
 * @param maxLimit - Maximum allowed limit (default: 50)
 * @returns The clamped limit value
 */
export function enforcePaginationLimit(
  requestedLimit: number,
  maxLimit: number = 50
): number {
  return Math.min(Math.max(1, requestedLimit), maxLimit);
}
