import { z } from 'zod';
import { eq, desc, sql, and, gte, lte, count } from 'drizzle-orm';
import { createTRPCRouter, adminProcedure, doctorProcedure } from '../trpc';
import { 
  users, 
  doctors, 
  patients, 
  appointments, 
  connections, 
  intakeSessions,
  chatMessages,
} from '@/server/db/schema';
import { generatePrintableReport, formatReportDate } from '@/server/services/report-export';
import { checkResponseSize } from '@/server/lib/query-optimizer';
import type { AnalyticsFieldSelection } from '@/types/api-responses';

// Date range input schema
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// Granularity for time series data
const granularitySchema = z.enum(['daily', 'weekly', 'monthly']);

/**
 * Analytics Router
 * Provides analytics queries for admin dashboard and doctor-specific analytics.
 * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.7, 28.8, 6.3, 6.5
 */
export const analyticsRouter = createTRPCRouter({
  /**
   * Get user growth metrics over time.
   * Supports field selection for optimized payloads.
   * Requirements: 28.1, 6.3, 6.5
   */
  getUserGrowth: adminProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      granularity: granularitySchema.default('daily'),
      fields: z.object({
        includeTimeSeries: z.boolean().default(true),
        includeTotals: z.boolean().default(true),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, granularity, fields } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const includeTimeSeries = fields?.includeTimeSeries ?? true;
      const includeTotals = fields?.includeTotals ?? true;

      // Get date truncation based on granularity
      const dateTrunc = granularity === 'daily' ? 'day' 
        : granularity === 'weekly' ? 'week' 
        : 'month';

      // Build response based on field selection (Requirement 6.3)
      const response: {
        timeSeries?: Array<{ date: string; total: number; doctors: number; patients: number }>;
        totals?: { users: number; doctors: number; patients: number };
        period: { startDate: string; endDate: string; granularity: string };
      } = {
        period: { startDate, endDate, granularity },
      };

      // Only fetch time series if requested
      if (includeTimeSeries) {
        const userGrowth = await ctx.db
          .select({
            date: sql<string>`date_trunc(${dateTrunc}, ${users.createdAt})::date`.as('date'),
            total: count(),
            doctors: sql<number>`count(*) filter (where ${users.primaryRole} = 'doctor')`.as('doctors'),
            patients: sql<number>`count(*) filter (where ${users.primaryRole} = 'patient')`.as('patients'),
          })
          .from(users)
          .where(and(
            gte(users.createdAt, start),
            lte(users.createdAt, end)
          ))
          .groupBy(sql`date_trunc(${dateTrunc}, ${users.createdAt})::date`)
          .orderBy(sql`date_trunc(${dateTrunc}, ${users.createdAt})::date`);
        
        response.timeSeries = userGrowth;
      }

      // Only fetch totals if requested
      if (includeTotals) {
        const [totalUsers] = await ctx.db.select({ count: count() }).from(users);
        const [totalDoctors] = await ctx.db
          .select({ count: count() })
          .from(users)
          .where(eq(users.primaryRole, 'doctor'));
        const [totalPatients] = await ctx.db
          .select({ count: count() })
          .from(users)
          .where(eq(users.primaryRole, 'patient'));

        response.totals = {
          users: totalUsers?.count ?? 0,
          doctors: totalDoctors?.count ?? 0,
          patients: totalPatients?.count ?? 0,
        };
      }

      // Check response size and log warning if needed (Requirement 6.5)
      checkResponseSize(response, 'analytics.getUserGrowth');

      return response;
    }),

  /**
   * Get appointment volume and completion rates.
   * Supports field selection for optimized payloads.
   * Requirements: 28.2, 6.3, 6.5
   */
  getAppointmentStats: adminProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      granularity: granularitySchema.default('daily'),
      fields: z.object({
        includeTimeSeries: z.boolean().default(true),
        includeSummary: z.boolean().default(true),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, granularity, fields } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const includeTimeSeries = fields?.includeTimeSeries ?? true;
      const includeSummary = fields?.includeSummary ?? true;

      const dateTrunc = granularity === 'daily' ? 'day' 
        : granularity === 'weekly' ? 'week' 
        : 'month';

      // Build response based on field selection (Requirement 6.3)
      const response: {
        timeSeries?: Array<{ date: string; total: number; completed: number; cancelled: number; noShow: number; pending: number; confirmed: number }>;
        summary?: { total: number; completed: number; cancelled: number; noShow: number; completionRate: number; cancellationRate: number; noShowRate: number };
        period: { startDate: string; endDate: string; granularity: string };
      } = {
        period: { startDate, endDate, granularity },
      };

      // Only fetch time series if requested
      if (includeTimeSeries) {
        const appointmentStats = await ctx.db
          .select({
            date: sql<string>`date_trunc(${dateTrunc}, ${appointments.scheduledAt})::date`.as('date'),
            total: count(),
            completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`.as('completed'),
            cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`.as('cancelled'),
            noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`.as('no_show'),
            pending: sql<number>`count(*) filter (where ${appointments.status} = 'pending')`.as('pending'),
            confirmed: sql<number>`count(*) filter (where ${appointments.status} = 'confirmed')`.as('confirmed'),
          })
          .from(appointments)
          .where(and(
            gte(appointments.scheduledAt, start),
            lte(appointments.scheduledAt, end)
          ))
          .groupBy(sql`date_trunc(${dateTrunc}, ${appointments.scheduledAt})::date`)
          .orderBy(sql`date_trunc(${dateTrunc}, ${appointments.scheduledAt})::date`);

        response.timeSeries = appointmentStats;
      }

      // Only fetch summary if requested
      if (includeSummary) {
        const [overallStats] = await ctx.db
          .select({
            total: count(),
            completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
            cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`,
            noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`,
          })
          .from(appointments)
          .where(and(
            gte(appointments.scheduledAt, start),
            lte(appointments.scheduledAt, end)
          ));

        const total = overallStats?.total ?? 0;
        const completed = overallStats?.completed ?? 0;
        const cancelled = overallStats?.cancelled ?? 0;
        const noShow = overallStats?.noShow ?? 0;

        response.summary = {
          total,
          completed,
          cancelled,
          noShow,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
          noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
        };
      }

      // Check response size and log warning if needed (Requirement 6.5)
      checkResponseSize(response, 'analytics.getAppointmentStats');

      return response;
    }),

  /**
   * Get AI chat session metrics.
   * Requirements: 28.3
   */
  getIntakeStats: adminProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      granularity: granularitySchema.default('daily'),
    }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, granularity } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const dateTrunc = granularity === 'daily' ? 'day' 
        : granularity === 'weekly' ? 'week' 
        : 'month';

      // Get intake session stats grouped by date
      const intakeStats = await ctx.db
        .select({
          date: sql<string>`date_trunc(${dateTrunc}, ${intakeSessions.createdAt})::date`.as('date'),
          total: count(),
          completed: sql<number>`count(*) filter (where ${intakeSessions.status} = 'ready' or ${intakeSessions.status} = 'reviewed')`.as('completed'),
          inProgress: sql<number>`count(*) filter (where ${intakeSessions.status} = 'in_progress')`.as('in_progress'),
          avgCompleteness: sql<number>`avg(${intakeSessions.completeness})`.as('avg_completeness'),
        })
        .from(intakeSessions)
        .where(and(
          gte(intakeSessions.createdAt, start),
          lte(intakeSessions.createdAt, end)
        ))
        .groupBy(sql`date_trunc(${dateTrunc}, ${intakeSessions.createdAt})::date`)
        .orderBy(sql`date_trunc(${dateTrunc}, ${intakeSessions.createdAt})::date`);

      // Get message counts for sessions in the date range
      const sessionIds = await ctx.db
        .select({ id: intakeSessions.id })
        .from(intakeSessions)
        .where(and(
          gte(intakeSessions.createdAt, start),
          lte(intakeSessions.createdAt, end)
        ));

      let totalMessages = 0;
      let avgMessagesPerSession = 0;

      if (sessionIds.length > 0) {
        const [messageStats] = await ctx.db
          .select({
            total: count(),
          })
          .from(chatMessages)
          .where(sql`${chatMessages.sessionId} = ANY(${sessionIds.map(s => s.id)})`);
        
        totalMessages = messageStats?.total ?? 0;
        avgMessagesPerSession = sessionIds.length > 0 
          ? Math.round(totalMessages / sessionIds.length) 
          : 0;
      }

      // Get overall stats
      const [overallStats] = await ctx.db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${intakeSessions.status} = 'ready' or ${intakeSessions.status} = 'reviewed')`,
          avgCompleteness: sql<number>`avg(${intakeSessions.completeness})`,
        })
        .from(intakeSessions)
        .where(and(
          gte(intakeSessions.createdAt, start),
          lte(intakeSessions.createdAt, end)
        ));

      // Calculate average session duration for completed sessions
      const completedSessions = await ctx.db
        .select({
          startedAt: intakeSessions.startedAt,
          completedAt: intakeSessions.completedAt,
        })
        .from(intakeSessions)
        .where(and(
          gte(intakeSessions.createdAt, start),
          lte(intakeSessions.createdAt, end),
          sql`${intakeSessions.status} IN ('ready', 'reviewed')`,
          sql`${intakeSessions.startedAt} IS NOT NULL`,
          sql`${intakeSessions.completedAt} IS NOT NULL`
        ));

      let avgSessionDurationMinutes = 0;
      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum, session) => {
          if (session.startedAt && session.completedAt) {
            return sum + (session.completedAt.getTime() - session.startedAt.getTime());
          }
          return sum;
        }, 0);
        avgSessionDurationMinutes = Math.round(totalDuration / completedSessions.length / 60000);
      }

      return {
        timeSeries: intakeStats,
        summary: {
          totalSessions: overallStats?.total ?? 0,
          completedSessions: overallStats?.completed ?? 0,
          avgCompleteness: Math.round(overallStats?.avgCompleteness ?? 0),
          totalMessages,
          avgMessagesPerSession,
          avgSessionDurationMinutes,
          completionRate: (overallStats?.total ?? 0) > 0 
            ? Math.round(((overallStats?.completed ?? 0) / (overallStats?.total ?? 1)) * 100) 
            : 0,
        },
        period: { startDate, endDate, granularity },
      };
    }),

  /**
   * Get combined analytics overview for admin dashboard.
   * Requirements: 28.1, 28.2, 28.3, 28.4, 28.5
   */
  getOverview: adminProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      // User stats
      const [newUsers] = await ctx.db
        .select({ count: count() })
        .from(users)
        .where(and(
          gte(users.createdAt, start),
          lte(users.createdAt, end)
        ));

      const [newDoctors] = await ctx.db
        .select({ count: count() })
        .from(doctors)
        .where(and(
          gte(doctors.createdAt, start),
          lte(doctors.createdAt, end)
        ));

      const [newPatients] = await ctx.db
        .select({ count: count() })
        .from(patients)
        .where(and(
          gte(patients.createdAt, start),
          lte(patients.createdAt, end)
        ));

      // Connection stats
      const [newConnections] = await ctx.db
        .select({ count: count() })
        .from(connections)
        .where(and(
          gte(connections.createdAt, start),
          lte(connections.createdAt, end)
        ));

      // Appointment stats
      const [appointmentStats] = await ctx.db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
          cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`,
        })
        .from(appointments)
        .where(and(
          gte(appointments.scheduledAt, start),
          lte(appointments.scheduledAt, end)
        ));

      // Intake stats
      const [intakeStatsResult] = await ctx.db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${intakeSessions.status} = 'ready' or ${intakeSessions.status} = 'reviewed')`,
        })
        .from(intakeSessions)
        .where(and(
          gte(intakeSessions.createdAt, start),
          lte(intakeSessions.createdAt, end)
        ));

      return {
        users: {
          new: newUsers?.count ?? 0,
          newDoctors: newDoctors?.count ?? 0,
          newPatients: newPatients?.count ?? 0,
        },
        connections: {
          new: newConnections?.count ?? 0,
        },
        appointments: {
          total: appointmentStats?.total ?? 0,
          completed: appointmentStats?.completed ?? 0,
          cancelled: appointmentStats?.cancelled ?? 0,
          completionRate: (appointmentStats?.total ?? 0) > 0
            ? Math.round(((appointmentStats?.completed ?? 0) / (appointmentStats?.total ?? 1)) * 100)
            : 0,
        },
        intakes: {
          total: intakeStatsResult?.total ?? 0,
          completed: intakeStatsResult?.completed ?? 0,
          completionRate: (intakeStatsResult?.total ?? 0) > 0
            ? Math.round(((intakeStatsResult?.completed ?? 0) / (intakeStatsResult?.total ?? 1)) * 100)
            : 0,
        },
        period: { startDate, endDate },
      };
    }),


  /**
   * Export analytics data as CSV.
   * Requirements: 28.7
   */
  exportUserGrowth: adminProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      granularity: granularitySchema.default('daily'),
    }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, granularity } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const dateTrunc = granularity === 'daily' ? 'day' 
        : granularity === 'weekly' ? 'week' 
        : 'month';

      const userGrowth = await ctx.db
        .select({
          date: sql<string>`date_trunc(${dateTrunc}, ${users.createdAt})::date`.as('date'),
          total: count(),
          doctors: sql<number>`count(*) filter (where ${users.primaryRole} = 'doctor')`.as('doctors'),
          patients: sql<number>`count(*) filter (where ${users.primaryRole} = 'patient')`.as('patients'),
        })
        .from(users)
        .where(and(
          gte(users.createdAt, start),
          lte(users.createdAt, end)
        ))
        .groupBy(sql`date_trunc(${dateTrunc}, ${users.createdAt})::date`)
        .orderBy(sql`date_trunc(${dateTrunc}, ${users.createdAt})::date`);

      // Generate CSV
      const headers = ['Date', 'Total Users', 'Doctors', 'Patients'];
      const rows = userGrowth.map(row => [
        row.date,
        row.total.toString(),
        row.doctors.toString(),
        row.patients.toString(),
      ]);

      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      return {
        csv,
        filename: `user-growth-${startDate.split('T')[0]}-to-${endDate.split('T')[0]}.csv`,
      };
    }),

  /**
   * Export appointment statistics as CSV.
   * Requirements: 28.7
   */
  exportAppointmentStats: adminProcedure
    .input(z.object({
      ...dateRangeSchema.shape,
      granularity: granularitySchema.default('daily'),
    }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, granularity } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const dateTrunc = granularity === 'daily' ? 'day' 
        : granularity === 'weekly' ? 'week' 
        : 'month';

      const appointmentStats = await ctx.db
        .select({
          date: sql<string>`date_trunc(${dateTrunc}, ${appointments.scheduledAt})::date`.as('date'),
          total: count(),
          completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`.as('completed'),
          cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`.as('cancelled'),
          noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`.as('no_show'),
        })
        .from(appointments)
        .where(and(
          gte(appointments.scheduledAt, start),
          lte(appointments.scheduledAt, end)
        ))
        .groupBy(sql`date_trunc(${dateTrunc}, ${appointments.scheduledAt})::date`)
        .orderBy(sql`date_trunc(${dateTrunc}, ${appointments.scheduledAt})::date`);

      // Generate CSV
      const headers = ['Date', 'Total', 'Completed', 'Cancelled', 'No Show', 'Completion Rate'];
      const rows = appointmentStats.map(row => {
        const completionRate = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
        return [
          row.date,
          row.total.toString(),
          row.completed.toString(),
          row.cancelled.toString(),
          row.noShow.toString(),
          `${completionRate}%`,
        ];
      });

      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      return {
        csv,
        filename: `appointment-stats-${startDate.split('T')[0]}-to-${endDate.split('T')[0]}.csv`,
      };
    }),

  /**
   * Get doctor-specific analytics.
   * Requirements: 28.8
   */
  getDoctorAnalytics: doctorProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (!ctx.doctor) {
        return {
          patients: { total: 0, new: 0, timeSeries: [] },
          appointments: { total: 0, completed: 0, cancelled: 0, completionRate: 0, timeSeries: [] },
          intakes: { total: 0, completed: 0, avgCompletionTimeMinutes: 0, timeSeries: [] },
          period: { startDate, endDate },
        };
      }

      const doctorId = ctx.doctor.id;

      // Patient count over time
      const patientGrowth = await ctx.db
        .select({
          date: sql<string>`date_trunc('day', ${connections.createdAt})::date`.as('date'),
          count: count(),
        })
        .from(connections)
        .where(and(
          eq(connections.doctorId, doctorId),
          gte(connections.createdAt, start),
          lte(connections.createdAt, end)
        ))
        .groupBy(sql`date_trunc('day', ${connections.createdAt})::date`)
        .orderBy(sql`date_trunc('day', ${connections.createdAt})::date`);

      // Total patients
      const [totalPatients] = await ctx.db
        .select({ count: count() })
        .from(connections)
        .where(eq(connections.doctorId, doctorId));

      // New patients in period
      const [newPatients] = await ctx.db
        .select({ count: count() })
        .from(connections)
        .where(and(
          eq(connections.doctorId, doctorId),
          gte(connections.createdAt, start),
          lte(connections.createdAt, end)
        ));

      // Appointment stats for this doctor
      const doctorConnections = await ctx.db
        .select({ id: connections.id })
        .from(connections)
        .where(eq(connections.doctorId, doctorId));

      const connectionIds = doctorConnections.map(c => c.id);

      let appointmentTimeSeries: { date: string; total: number; completed: number; cancelled: number }[] = [];
      let appointmentSummary = { total: 0, completed: 0, cancelled: 0, completionRate: 0 };

      if (connectionIds.length > 0) {
        appointmentTimeSeries = await ctx.db
          .select({
            date: sql<string>`date_trunc('day', ${appointments.scheduledAt})::date`.as('date'),
            total: count(),
            completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`.as('completed'),
            cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`.as('cancelled'),
          })
          .from(appointments)
          .where(and(
            sql`${appointments.connectionId} = ANY(${connectionIds})`,
            gte(appointments.scheduledAt, start),
            lte(appointments.scheduledAt, end)
          ))
          .groupBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`)
          .orderBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`);

        const [apptStats] = await ctx.db
          .select({
            total: count(),
            completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
            cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`,
          })
          .from(appointments)
          .where(and(
            sql`${appointments.connectionId} = ANY(${connectionIds})`,
            gte(appointments.scheduledAt, start),
            lte(appointments.scheduledAt, end)
          ));

        appointmentSummary = {
          total: apptStats?.total ?? 0,
          completed: apptStats?.completed ?? 0,
          cancelled: apptStats?.cancelled ?? 0,
          completionRate: (apptStats?.total ?? 0) > 0
            ? Math.round(((apptStats?.completed ?? 0) / (apptStats?.total ?? 1)) * 100)
            : 0,
        };
      }

      // Intake stats for this doctor
      let intakeTimeSeries: { date: string; total: number; completed: number }[] = [];
      let intakeSummary = { total: 0, completed: 0, avgCompletionTimeMinutes: 0 };

      if (connectionIds.length > 0) {
        intakeTimeSeries = await ctx.db
          .select({
            date: sql<string>`date_trunc('day', ${intakeSessions.createdAt})::date`.as('date'),
            total: count(),
            completed: sql<number>`count(*) filter (where ${intakeSessions.status} = 'ready' or ${intakeSessions.status} = 'reviewed')`.as('completed'),
          })
          .from(intakeSessions)
          .where(and(
            sql`${intakeSessions.connectionId} = ANY(${connectionIds})`,
            gte(intakeSessions.createdAt, start),
            lte(intakeSessions.createdAt, end)
          ))
          .groupBy(sql`date_trunc('day', ${intakeSessions.createdAt})::date`)
          .orderBy(sql`date_trunc('day', ${intakeSessions.createdAt})::date`);

        const [intakeStats] = await ctx.db
          .select({
            total: count(),
            completed: sql<number>`count(*) filter (where ${intakeSessions.status} = 'ready' or ${intakeSessions.status} = 'reviewed')`,
          })
          .from(intakeSessions)
          .where(and(
            sql`${intakeSessions.connectionId} = ANY(${connectionIds})`,
            gte(intakeSessions.createdAt, start),
            lte(intakeSessions.createdAt, end)
          ));

        // Calculate average completion time
        const completedIntakes = await ctx.db
          .select({
            startedAt: intakeSessions.startedAt,
            completedAt: intakeSessions.completedAt,
          })
          .from(intakeSessions)
          .where(and(
            sql`${intakeSessions.connectionId} = ANY(${connectionIds})`,
            gte(intakeSessions.createdAt, start),
            lte(intakeSessions.createdAt, end),
            sql`${intakeSessions.status} IN ('ready', 'reviewed')`,
            sql`${intakeSessions.startedAt} IS NOT NULL`,
            sql`${intakeSessions.completedAt} IS NOT NULL`
          ));

        let avgCompletionTimeMinutes = 0;
        if (completedIntakes.length > 0) {
          const totalDuration = completedIntakes.reduce((sum, session) => {
            if (session.startedAt && session.completedAt) {
              return sum + (session.completedAt.getTime() - session.startedAt.getTime());
            }
            return sum;
          }, 0);
          avgCompletionTimeMinutes = Math.round(totalDuration / completedIntakes.length / 60000);
        }

        intakeSummary = {
          total: intakeStats?.total ?? 0,
          completed: intakeStats?.completed ?? 0,
          avgCompletionTimeMinutes,
        };
      }

      return {
        patients: {
          total: totalPatients?.count ?? 0,
          new: newPatients?.count ?? 0,
          timeSeries: patientGrowth,
        },
        appointments: {
          ...appointmentSummary,
          timeSeries: appointmentTimeSeries,
        },
        intakes: {
          ...intakeSummary,
          timeSeries: intakeTimeSeries,
        },
        period: { startDate, endDate },
      };
    }),

  /**
   * Generate printable HTML report for PDF export.
   * Requirements: 28.7
   */
  generatePDFReport: adminProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Gather all stats
      const [totalUsers] = await ctx.db.select({ count: count() }).from(users);
      const [totalDoctors] = await ctx.db.select({ count: count() }).from(doctors);
      const [totalPatients] = await ctx.db.select({ count: count() }).from(patients);
      const [totalConnections] = await ctx.db.select({ count: count() }).from(connections);

      // Period stats
      const [newUsers] = await ctx.db
        .select({ count: count() })
        .from(users)
        .where(and(gte(users.createdAt, start), lte(users.createdAt, end)));

      const [appointmentStats] = await ctx.db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`,
          cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')`,
          noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')`,
        })
        .from(appointments)
        .where(and(gte(appointments.scheduledAt, start), lte(appointments.scheduledAt, end)));

      const [intakeStatsResult] = await ctx.db
        .select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${intakeSessions.status} = 'ready' or ${intakeSessions.status} = 'reviewed')`,
          avgCompleteness: sql<number>`avg(${intakeSessions.completeness})`,
        })
        .from(intakeSessions)
        .where(and(gte(intakeSessions.createdAt, start), lte(intakeSessions.createdAt, end)));

      // Generate time series data for tables
      const userGrowth = await ctx.db
        .select({
          date: sql<string>`date_trunc('day', ${users.createdAt})::date`.as('date'),
          total: count(),
        })
        .from(users)
        .where(and(gte(users.createdAt, start), lte(users.createdAt, end)))
        .groupBy(sql`date_trunc('day', ${users.createdAt})::date`)
        .orderBy(sql`date_trunc('day', ${users.createdAt})::date`)
        .limit(30);

      const appointmentTimeSeries = await ctx.db
        .select({
          date: sql<string>`date_trunc('day', ${appointments.scheduledAt})::date`.as('date'),
          total: count(),
          completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`.as('completed'),
        })
        .from(appointments)
        .where(and(gte(appointments.scheduledAt, start), lte(appointments.scheduledAt, end)))
        .groupBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`)
        .orderBy(sql`date_trunc('day', ${appointments.scheduledAt})::date`)
        .limit(30);

      const apptTotal = appointmentStats?.total ?? 0;
      const apptCompleted = appointmentStats?.completed ?? 0;
      const apptCancelled = appointmentStats?.cancelled ?? 0;
      const apptNoShow = appointmentStats?.noShow ?? 0;
      const intakeTotal = intakeStatsResult?.total ?? 0;
      const intakeCompleted = intakeStatsResult?.completed ?? 0;

      const html = generatePrintableReport(
        'Platform Analytics Report',
        `${formatReportDate(start)} - ${formatReportDate(end)}`,
        [
          {
            title: 'Platform Overview',
            data: [
              { label: 'Total Users', value: totalUsers?.count ?? 0 },
              { label: 'Total Doctors', value: totalDoctors?.count ?? 0 },
              { label: 'Total Patients', value: totalPatients?.count ?? 0 },
              { label: 'Total Connections', value: totalConnections?.count ?? 0 },
            ],
          },
          {
            title: 'Period Statistics',
            data: [
              { label: 'New Users', value: newUsers?.count ?? 0 },
              { label: 'Appointments', value: apptTotal },
              { label: 'Intake Sessions', value: intakeTotal },
              { label: 'Avg Completeness', value: `${Math.round(intakeStatsResult?.avgCompleteness ?? 0)}%` },
            ],
          },
          {
            title: 'Appointment Metrics',
            data: [
              { label: 'Completed', value: apptCompleted },
              { label: 'Cancelled', value: apptCancelled },
              { label: 'No Show', value: apptNoShow },
              { label: 'Completion Rate', value: `${apptTotal > 0 ? Math.round((apptCompleted / apptTotal) * 100) : 0}%` },
            ],
          },
          {
            title: 'Intake Metrics',
            data: [
              { label: 'Total Sessions', value: intakeTotal },
              { label: 'Completed', value: intakeCompleted },
              { label: 'Completion Rate', value: `${intakeTotal > 0 ? Math.round((intakeCompleted / intakeTotal) * 100) : 0}%` },
              { label: 'Avg Completeness', value: `${Math.round(intakeStatsResult?.avgCompleteness ?? 0)}%` },
            ],
          },
        ],
        [
          {
            title: 'User Registration Trend',
            headers: ['Date', 'New Users'],
            rows: userGrowth.map(row => [row.date, row.total]),
          },
          {
            title: 'Appointment Trend',
            headers: ['Date', 'Total', 'Completed'],
            rows: appointmentTimeSeries.map(row => [row.date, row.total, row.completed]),
          },
        ]
      );

      return {
        html,
        filename: `analytics-report-${startDate.split('T')[0]}-to-${endDate.split('T')[0]}.html`,
      };
    }),
});
