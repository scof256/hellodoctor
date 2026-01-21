import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@clerk/nextjs/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db } from '@/server/db';
import { users, doctors, patients, userRoles } from '@/server/db/schema';
import { eq, and, isNull, or, gte } from 'drizzle-orm';
import type { UserRole } from '@/types';
import { checkRateLimit, type RateLimitType } from '@/server/services/rate-limit';

// Type for user with role information
export type AuthenticatedUser = typeof users.$inferSelect & {
  doctor?: typeof doctors.$inferSelect | null;
  patient?: typeof patients.$inferSelect | null;
};

export const createTRPCContext = async (opts: { headers: Headers }) => {
  let userId: string | null = null;
  
  try {
    // Attempt to get auth from Clerk
    const authResult = await auth();
    userId = authResult?.userId ?? null;
    
    // Log authentication status in production for debugging
    if (process.env.NODE_ENV === 'production') {
      console.log('[TRPC Context]', {
        timestamp: new Date().toISOString(),
        hasAuth: !!userId,
        userId: userId ? `${userId.substring(0, 8)}...` : null,
      });
    }
  } catch (error) {
    // Log context creation errors but don't fail - allow public procedures to work
    console.error('[TRPC Context Error]', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // userId remains null, which will be caught by protected procedures
  }
  
  // Extract IP address for rate limiting (fallback to a default for local dev)
  const forwardedFor = opts.headers.get('x-forwarded-for');
  const realIp = opts.headers.get('x-real-ip');
  const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  
  return {
    db,
    userId,
    clientIp,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/**
 * Rate limiting middleware factory.
 * Creates a middleware that enforces rate limits based on endpoint type.
 * Requirements: 16.4
 */
const createRateLimitMiddleware = (type: RateLimitType) =>
  t.middleware(async ({ ctx, next, path }) => {
    // Use userId if authenticated, otherwise use IP address
    const identifier = ctx.userId || ctx.clientIp;
    
    const result = checkRateLimit(identifier, type, path);
    
    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
      });
    }
    
    return next({ ctx });
  });

/**
 * Middleware to enforce user is authenticated.
 * Fetches the user from the database and adds it to the context.
 */
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }
  
  const user = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.userId),
  });

  if (!user) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED',
      message: 'User not found. Please complete onboarding.',
    });
  }

  if (!user.isActive) {
    throw new TRPCError({ 
      code: 'FORBIDDEN',
      message: 'Your account has been deactivated.',
    });
  }
  
  return next({
    ctx: { 
      ...ctx, 
      user,
      userId: ctx.userId,
    },
  });
});


/**
 * Check if a Clerk user ID is in the SUPERUSER_IDS env variable.
 * These users bypass all role checks.
 */
const isEnvSuperuser = (clerkId: string): boolean => {
  const superuserIds = process.env.SUPERUSER_IDS?.split(',').map(id => id.trim()) || [];
  return superuserIds.includes(clerkId);
};

/**
 * Middleware to enforce user has one of the specified roles.
 * Must be used after enforceUserIsAuthed middleware.
 * 
 * Role hierarchy: super_admin > doctor > clinic_admin > receptionist > patient
 * 
 * Users listed in SUPERUSER_IDS env variable bypass all role checks.
 */
const enforceUserHasRole = (allowedRoles: UserRole[]) =>
  t.middleware(async ({ ctx, next }) => {
    const ctxWithUser = ctx as typeof ctx & { user: typeof users.$inferSelect };
    
    if (!ctxWithUser.user) {
      throw new TRPCError({ 
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Check if user is an env-based superuser (bypasses all role checks)
    if (ctx.userId && isEnvSuperuser(ctx.userId)) {
      return next({ ctx });
    }

    // Check primary role
    if (allowedRoles.includes(ctxWithUser.user.primaryRole as UserRole)) {
      return next({ ctx });
    }

    // Check additional roles from user_roles table
    const additionalRoles = await ctx.db.query.userRoles.findMany({
      where: and(
        eq(userRoles.userId, ctxWithUser.user.id),
        or(
          isNull(userRoles.effectiveUntil),
          gte(userRoles.effectiveUntil, new Date())
        )
      ),
    });

    const hasAllowedRole = additionalRoles.some(
      (role) => allowedRoles.includes(role.role as UserRole)
    );

    if (!hasAllowedRole) {
      throw new TRPCError({ 
        code: 'FORBIDDEN',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    return next({ ctx });
  });

/**
 * Middleware to load doctor profile for doctor-related operations.
 * Must be used after enforceUserIsAuthed middleware.
 */
const loadDoctorProfile = t.middleware(async ({ ctx, next }) => {
  const ctxWithUser = ctx as typeof ctx & { user: typeof users.$inferSelect };
  
  if (!ctxWithUser.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const doctor = await ctx.db.query.doctors.findFirst({
    where: eq(doctors.userId, ctxWithUser.user.id),
  });

  return next({
    ctx: { ...ctx, doctor },
  });
});

/**
 * Middleware to load patient profile for patient-related operations.
 * Must be used after enforceUserIsAuthed middleware.
 * Note: This middleware does NOT throw if patient profile is not found.
 * Individual procedures should check ctx.patient if they require it.
 */
const loadPatientProfile = t.middleware(async ({ ctx, next }) => {
  const ctxWithUser = ctx as typeof ctx & { user: typeof users.$inferSelect };
  
  if (!ctxWithUser.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const patient = await ctx.db.query.patients.findFirst({
    where: eq(patients.userId, ctxWithUser.user.id),
  });

  // Log for debugging - can be removed later
  if (!patient) {
    console.log(`[loadPatientProfile] No patient profile found for user ${ctxWithUser.user.id} (${ctxWithUser.user.email})`);
  }

  return next({
    ctx: { ...ctx, patient },
  });
});

// ============================================================================
// PROCEDURES
// ============================================================================

/**
 * Public procedure - no authentication required.
 * Use for public endpoints like doctor profile lookup.
 * Rate limited to prevent abuse.
 */
export const publicProcedure = t.procedure.use(createRateLimitMiddleware('public'));

/**
 * Protected procedure - requires authentication.
 * User must be logged in and have completed onboarding.
 * Rate limited per user.
 */
export const protectedProcedure = t.procedure
  .use(createRateLimitMiddleware('protected'))
  .use(enforceUserIsAuthed);

/**
 * Admin procedure - requires super_admin role.
 * For platform-wide administrative operations.
 * Higher rate limit for admin operations.
 */
export const adminProcedure = t.procedure
  .use(createRateLimitMiddleware('admin'))
  .use(enforceUserIsAuthed)
  .use(enforceUserHasRole(['super_admin']));

/**
 * Doctor procedure - requires doctor or super_admin role.
 * For doctor-specific operations.
 */
export const doctorProcedure = t.procedure
  .use(createRateLimitMiddleware('protected'))
  .use(enforceUserIsAuthed)
  .use(enforceUserHasRole(['super_admin', 'doctor']))
  .use(loadDoctorProfile);

/**
 * Clinic admin procedure - requires clinic_admin, doctor, or super_admin role.
 * For clinic management operations.
 */
export const clinicAdminProcedure = t.procedure
  .use(createRateLimitMiddleware('protected'))
  .use(enforceUserIsAuthed)
  .use(enforceUserHasRole(['super_admin', 'doctor', 'clinic_admin']));

/**
 * Receptionist procedure - requires receptionist, clinic_admin, doctor, or super_admin role.
 * For appointment and scheduling operations.
 */
export const receptionistProcedure = t.procedure
  .use(createRateLimitMiddleware('protected'))
  .use(enforceUserIsAuthed)
  .use(enforceUserHasRole(['super_admin', 'doctor', 'clinic_admin', 'receptionist']));

/**
 * Patient procedure - requires patient role (or higher).
 * For patient-specific operations.
 */
export const patientProcedure = t.procedure
  .use(createRateLimitMiddleware('protected'))
  .use(enforceUserIsAuthed)
  .use(enforceUserHasRole(['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient']))
  .use(loadPatientProfile);

/**
 * AI procedure - for AI/chat endpoints with lower rate limits.
 * Used for resource-intensive AI operations.
 */
export const aiProcedure = t.procedure
  .use(createRateLimitMiddleware('ai'))
  .use(enforceUserIsAuthed);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a user has a specific permission.
 * This can be used within procedures for fine-grained access control.
 */
export async function checkUserPermission(
  db: typeof import('@/server/db').db,
  userId: string,
  requiredRoles: UserRole[]
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.isActive) {
    return false;
  }

  // Check primary role
  if (requiredRoles.includes(user.primaryRole as UserRole)) {
    return true;
  }

  // Check additional roles
  const additionalRoles = await db.query.userRoles.findMany({
    where: and(
      eq(userRoles.userId, userId),
      or(
        isNull(userRoles.effectiveUntil),
        gte(userRoles.effectiveUntil, new Date())
      )
    ),
  });

  return additionalRoles.some(
    (role) => requiredRoles.includes(role.role as UserRole)
  );
}

/**
 * Get all effective roles for a user.
 */
export async function getUserRoles(
  db: typeof import('@/server/db').db,
  userId: string
): Promise<UserRole[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return [];
  }

  const roles: UserRole[] = [user.primaryRole as UserRole];

  const additionalRoles = await db.query.userRoles.findMany({
    where: and(
      eq(userRoles.userId, userId),
      or(
        isNull(userRoles.effectiveUntil),
        gte(userRoles.effectiveUntil, new Date())
      )
    ),
  });

  for (const role of additionalRoles) {
    if (!roles.includes(role.role as UserRole)) {
      roles.push(role.role as UserRole);
    }
  }

  return roles;
}
