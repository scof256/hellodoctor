import { z } from 'zod';
import { eq, desc, sql, and, or, ilike, count, gte, lte } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, adminProcedure } from '../trpc';
import { 
  users, 
  doctors, 
  patients, 
  appointments, 
  connections, 
  intakeSessions,
  auditLogs,
  platformConfig,
  notifications,
} from '@/server/db/schema';
import { auditService } from '@/server/services/audit';

// Input validation schemas
const getUsersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient']).optional(),
  isActive: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
  reason: z.string().max(500).optional(),
});

const verifyDoctorSchema = z.object({
  doctorId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

const updateConfigSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
  description: z.string().max(500).optional(),
});

export const adminRouter = createTRPCRouter({
  /**
   * Get platform-wide statistics.
   * Requirements: 18.1, 18.2
   */
  getStats: adminProcedure.query(async ({ ctx }) => {
    // Get total counts
    const [userCount] = await ctx.db.select({ count: count() }).from(users);
    const [doctorCount] = await ctx.db.select({ count: count() }).from(doctors);
    const [patientCount] = await ctx.db.select({ count: count() }).from(patients);
    const [appointmentCount] = await ctx.db.select({ count: count() }).from(appointments);
    const [connectionCount] = await ctx.db.select({ count: count() }).from(connections);
    const [intakeCount] = await ctx.db.select({ count: count() }).from(intakeSessions);

    // Get pending doctor verifications
    const [pendingVerifications] = await ctx.db
      .select({ count: count() })
      .from(doctors)
      .where(eq(doctors.verificationStatus, 'pending'));

    // Get active users (logged in within last 30 days based on updatedAt)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [activeUsers] = await ctx.db
      .select({ count: count() })
      .from(users)
      .where(and(
        eq(users.isActive, true),
        gte(users.updatedAt, thirtyDaysAgo)
      ));

    // Get today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [todayAppointments] = await ctx.db
      .select({ count: count() })
      .from(appointments)
      .where(and(
        gte(appointments.scheduledAt, today),
        lte(appointments.scheduledAt, tomorrow)
      ));

    // Get completed intakes
    const [completedIntakes] = await ctx.db
      .select({ count: count() })
      .from(intakeSessions)
      .where(eq(intakeSessions.status, 'ready'));

    return {
      totalUsers: userCount?.count ?? 0,
      totalDoctors: doctorCount?.count ?? 0,
      totalPatients: patientCount?.count ?? 0,
      totalAppointments: appointmentCount?.count ?? 0,
      totalConnections: connectionCount?.count ?? 0,
      totalIntakeSessions: intakeCount?.count ?? 0,
      pendingVerifications: pendingVerifications?.count ?? 0,
      activeUsers: activeUsers?.count ?? 0,
      todayAppointments: todayAppointments?.count ?? 0,
      completedIntakes: completedIntakes?.count ?? 0,
    };
  }),

  /**
   * Get searchable, filterable list of all users.
   * Requirements: 19.1
   */
  getUsers: adminProcedure
    .input(getUsersSchema)
    .query(async ({ ctx, input }) => {
      const { search, role, isActive, limit, offset } = input;

      // Build where conditions
      const conditions = [];
      
      if (search) {
        conditions.push(
          or(
            ilike(users.email, `%${search}%`),
            ilike(users.firstName, `%${search}%`),
            ilike(users.lastName, `%${search}%`)
          )
        );
      }
      
      if (role) {
        conditions.push(eq(users.primaryRole, role));
      }
      
      if (isActive !== undefined) {
        conditions.push(eq(users.isActive, isActive));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get users with pagination
      const userList = await ctx.db.query.users.findMany({
        where: whereClause,
        orderBy: [desc(users.createdAt)],
        limit,
        offset,
      });

      // Get total count for pagination
      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(users)
        .where(whereClause);

      return {
        users: userList,
        total: totalResult?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Get detailed user profile by ID.
   * Requirements: 19.2
   */
  getUserById: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.id, input.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get doctor profile if exists
      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.userId, input.userId),
      });

      // Get patient profile if exists
      const patient = await ctx.db.query.patients.findFirst({
        where: eq(patients.userId, input.userId),
      });

      // Get recent activity (audit logs)
      const recentActivity = await ctx.db.query.auditLogs.findMany({
        where: eq(auditLogs.userId, input.userId),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 20,
      });

      // Get connection count
      let connectionCount = 0;
      if (doctor) {
        const [doctorConnections] = await ctx.db
          .select({ count: count() })
          .from(connections)
          .where(eq(connections.doctorId, doctor.id));
        connectionCount = doctorConnections?.count ?? 0;
      } else if (patient) {
        const [patientConnections] = await ctx.db
          .select({ count: count() })
          .from(connections)
          .where(eq(connections.patientId, patient.id));
        connectionCount = patientConnections?.count ?? 0;
      }

      return {
        user,
        doctor,
        patient,
        recentActivity,
        connectionCount,
      };
    }),

  /**
   * Suspend or activate a user account.
   * Requirements: 19.3, 19.4
   */
  updateUserStatus: adminProcedure
    .input(updateUserStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId, isActive, reason } = input;

      // Prevent self-deactivation
      if (userId === ctx.user.id && !isActive) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot deactivate your own account',
        });
      }

      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Update user status
      const [updatedUser] = await ctx.db
        .update(users)
        .set({
          isActive,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: isActive ? 'user_activated' : 'user_suspended',
        resourceType: 'user',
        resourceId: userId,
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          reason,
          previousStatus: targetUser.isActive,
          newStatus: isActive,
        },
      });

      // Create notification for the affected user
      await ctx.db.insert(notifications).values({
        userId,
        type: 'account_status',
        title: isActive ? 'Account Activated' : 'Account Suspended',
        message: isActive 
          ? 'Your account has been activated. You can now access all features.'
          : `Your account has been suspended.${reason ? ` Reason: ${reason}` : ''}`,
        data: { reason },
      });

      return updatedUser;
    }),


  /**
   * Update user's role.
   * Requirements: 19.6
   */
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(['super_admin', 'doctor', 'clinic_admin', 'receptionist', 'patient']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, role } = input;

      const targetUser = await ctx.db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const previousRole = targetUser.primaryRole;

      // Update user role
      const [updatedUser] = await ctx.db
        .update(users)
        .set({
          primaryRole: role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'user_role_changed',
        resourceType: 'user',
        resourceId: userId,
        metadata: {
          targetUserId: userId,
          targetUserEmail: targetUser.email,
          previousRole,
          newRole: role,
        },
      });

      return updatedUser;
    }),

  /**
   * Get list of doctors pending verification.
   * Requirements: 20.2
   */
  getPendingDoctors: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 20, offset = 0 } = input ?? {};

      const pendingDoctors = await ctx.db.query.doctors.findMany({
        where: eq(doctors.verificationStatus, 'pending'),
        orderBy: [desc(doctors.createdAt)],
        limit,
        offset,
      });

      // Get user info for each doctor
      const doctorsWithUsers = await Promise.all(
        pendingDoctors.map(async (doctor) => {
          const user = await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          });
          return { ...doctor, user };
        })
      );

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(doctors)
        .where(eq(doctors.verificationStatus, 'pending'));

      return {
        doctors: doctorsWithUsers,
        total: totalResult?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Approve or reject a doctor's verification.
   * Requirements: 20.4, 20.5
   */
  verifyDoctor: adminProcedure
    .input(verifyDoctorSchema)
    .mutation(async ({ ctx, input }) => {
      const { doctorId, action, reason } = input;

      const doctor = await ctx.db.query.doctors.findFirst({
        where: eq(doctors.id, doctorId),
      });

      if (!doctor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Doctor not found',
        });
      }

      if (doctor.verificationStatus !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Doctor is not pending verification',
        });
      }

      const newStatus = action === 'approve' ? 'verified' : 'rejected';

      // Update doctor verification status
      const [updatedDoctor] = await ctx.db
        .update(doctors)
        .set({
          verificationStatus: newStatus,
          verifiedAt: action === 'approve' ? new Date() : null,
          verifiedBy: action === 'approve' ? ctx.user.id : null,
          rejectionReason: action === 'reject' ? reason : null,
          updatedAt: new Date(),
        })
        .where(eq(doctors.id, doctorId))
        .returning();

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: action === 'approve' ? 'doctor_approved' : 'doctor_rejected',
        resourceType: 'doctor',
        resourceId: doctorId,
        metadata: {
          doctorId,
          doctorUserId: doctor.userId,
          action,
          reason,
        },
      });

      // Notify the doctor
      await ctx.db.insert(notifications).values({
        userId: doctor.userId,
        type: 'verification_status',
        title: action === 'approve' ? 'Verification Approved' : 'Verification Rejected',
        message: action === 'approve'
          ? 'Congratulations! Your doctor profile has been verified. You can now accept patient connections.'
          : `Your verification request has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        data: { action, reason },
      });

      return updatedDoctor;
    }),

  /**
   * Get recent activity feed for the platform.
   * Requirements: 18.2
   */
  getActivityFeed: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 50 } = input ?? {};

      // Get recent audit logs
      const recentLogs = await ctx.db.query.auditLogs.findMany({
        orderBy: [desc(auditLogs.createdAt)],
        limit,
      });

      // Enrich with user info
      const enrichedLogs = await Promise.all(
        recentLogs.map(async (log) => {
          let user = null;
          if (log.userId) {
            user = await ctx.db.query.users.findFirst({
              where: eq(users.id, log.userId),
            });
          }
          return { ...log, user };
        })
      );

      return { activities: enrichedLogs };
    }),

  /**
   * Get platform configuration.
   * Requirements: 21.1, 21.2, 21.3, 21.4, 21.7
   */
  getConfig: adminProcedure.query(async ({ ctx }) => {
    const configs = await ctx.db.query.platformConfig.findMany();
    
    // Convert to key-value object
    const configMap: Record<string, { value: unknown; description: string | null; updatedAt: Date }> = {};
    for (const config of configs) {
      configMap[config.key] = {
        value: config.value,
        description: config.description,
        updatedAt: config.updatedAt,
      };
    }

    return configMap;
  }),

  /**
   * Update platform configuration.
   * Requirements: 21.1, 21.2, 21.3, 21.4, 21.7
   */
  updateConfig: adminProcedure
    .input(updateConfigSchema)
    .mutation(async ({ ctx, input }) => {
      const { key, value, description } = input;

      // Check if config exists
      const existingConfig = await ctx.db.query.platformConfig.findFirst({
        where: eq(platformConfig.key, key),
      });

      let result;
      if (existingConfig) {
        // Update existing config
        [result] = await ctx.db
          .update(platformConfig)
          .set({
            value,
            description: description ?? existingConfig.description,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(platformConfig.key, key))
          .returning();
      } else {
        // Create new config
        [result] = await ctx.db
          .insert(platformConfig)
          .values({
            key,
            value,
            description,
            updatedBy: ctx.user.id,
          })
          .returning();
      }

      // Log the action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: existingConfig ? 'config_updated' : 'config_created',
        resourceType: 'platform_config',
        resourceId: result?.id,
        metadata: {
          key,
          previousValue: existingConfig?.value,
          newValue: value,
        },
      });

      return result;
    }),

  /**
   * Bulk update platform configuration.
   * Requirements: 21.1, 21.2, 21.3, 21.4, 21.7
   */
  updateConfigs: adminProcedure
    .input(z.object({
      configs: z.array(updateConfigSchema),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];

      for (const config of input.configs) {
        const { key, value, description } = config;

        const existingConfig = await ctx.db.query.platformConfig.findFirst({
          where: eq(platformConfig.key, key),
        });

        let result;
        if (existingConfig) {
          [result] = await ctx.db
            .update(platformConfig)
            .set({
              value,
              description: description ?? existingConfig.description,
              updatedBy: ctx.user.id,
              updatedAt: new Date(),
            })
            .where(eq(platformConfig.key, key))
            .returning();
        } else {
          [result] = await ctx.db
            .insert(platformConfig)
            .values({
              key,
              value,
              description,
              updatedBy: ctx.user.id,
            })
            .returning();
        }

        results.push(result);
      }

      // Log the bulk action
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'configs_bulk_updated',
        resourceType: 'platform_config',
        metadata: {
          keys: input.configs.map(c => c.key),
        },
      });

      return results;
    }),

  /**
   * Get all doctors with their verification status.
   * Requirements: 20.2, 20.3
   */
  getAllDoctors: adminProcedure
    .input(z.object({
      status: z.enum(['pending', 'verified', 'rejected']).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const { status, search, limit = 20, offset = 0 } = input ?? {};

      const conditions = [];
      
      if (status) {
        conditions.push(eq(doctors.verificationStatus, status));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const doctorList = await ctx.db.query.doctors.findMany({
        where: whereClause,
        orderBy: [desc(doctors.createdAt)],
        limit,
        offset,
      });

      // Get user info and filter by search if needed
      let doctorsWithUsers = await Promise.all(
        doctorList.map(async (doctor) => {
          const user = await ctx.db.query.users.findFirst({
            where: eq(users.id, doctor.userId),
          });
          return { ...doctor, user };
        })
      );

      // Filter by search term if provided
      if (search) {
        const searchLower = search.toLowerCase();
        doctorsWithUsers = doctorsWithUsers.filter(d => 
          d.user?.email?.toLowerCase().includes(searchLower) ||
          d.user?.firstName?.toLowerCase().includes(searchLower) ||
          d.user?.lastName?.toLowerCase().includes(searchLower) ||
          d.specialty?.toLowerCase().includes(searchLower) ||
          d.clinicName?.toLowerCase().includes(searchLower)
        );
      }

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(doctors)
        .where(whereClause);

      return {
        doctors: doctorsWithUsers,
        total: totalResult?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Get audit logs with filtering and pagination.
   * Requirements: 22.6, 22.7
   */
  getAuditLogs: adminProcedure
    .input(z.object({
      userId: z.string().uuid().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      resourceId: z.string().uuid().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const {
        userId,
        action,
        resourceType,
        resourceId,
        startDate,
        endDate,
        search,
        limit = 50,
        offset = 0,
      } = input ?? {};

      const result = await auditService.queryAuditLogs({
        userId,
        action: action as Parameters<typeof auditService.queryAuditLogs>[0]['action'],
        resourceType: resourceType as Parameters<typeof auditService.queryAuditLogs>[0]['resourceType'],
        resourceId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        search,
        limit,
        offset,
      });

      return {
        logs: result.logs,
        total: result.total,
        limit,
        offset,
      };
    }),

  /**
   * Get audit log statistics for a date range.
   * Requirements: 22.6
   */
  getAuditStats: adminProcedure
    .input(z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }))
    .query(async ({ ctx, input }) => {
      const stats = await auditService.getAuditStats(
        new Date(input.startDate),
        new Date(input.endDate)
      );

      return stats;
    }),

  /**
   * Export audit logs as CSV.
   * Requirements: 22.8
   */
  exportAuditLogs: adminProcedure
    .input(z.object({
      userId: z.string().uuid().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.number().min(1).max(10000).default(1000),
    }).optional())
    .query(async ({ ctx, input }) => {
      const {
        userId,
        action,
        resourceType,
        startDate,
        endDate,
        limit = 1000,
      } = input ?? {};

      const result = await auditService.queryAuditLogs({
        userId,
        action: action as Parameters<typeof auditService.queryAuditLogs>[0]['action'],
        resourceType: resourceType as Parameters<typeof auditService.queryAuditLogs>[0]['resourceType'],
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit,
        offset: 0,
      });

      const csvContent = auditService.exportToCSV(result.logs);

      // Log the export action
      await auditService.logAdminAction(
        ctx.user.id,
        'data_export',
        'audit_log',
        null,
        {
          exportedCount: result.logs.length,
          filters: { userId, action, resourceType, startDate, endDate },
        }
      );

      return {
        csv: csvContent,
        count: result.logs.length,
        filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),
});
