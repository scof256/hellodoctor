/**
 * Dashboard Router - Consolidated Dashboard Queries
 * 
 * This router provides optimized dashboard endpoints that use JOINs
 * to fetch related data in single queries, avoiding N+1 patterns.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3
 */

import { eq, and, gte, inArray, sql, desc } from 'drizzle-orm';
import { createTRPCRouter, doctorProcedure, patientProcedure, adminProcedure } from '../trpc';
import { 
  connections, 
  patients, 
  users, 
  appointments, 
  intakeSessions,
  doctors,
  auditLogs,
} from '@/server/db/schema';
import type { 
  ConnectionSummary, 
  AppointmentSummary, 
  DoctorDashboardStats,
  PatientDashboardStats,
  AdminDashboardStats,
  ActivityFeedItem,
  PendingDoctorItem,
} from '@/types/dashboard';

/**
 * Get doctor dashboard connections with patient info and intake status using JOINs.
 * Sorted by intake status (ready first) from the server.
 * 
 * Requirements: 6.2, 6.4
 */
async function getDoctorDashboardConnections(
  db: typeof import('@/server/db').db,
  doctorId: string
): Promise<ConnectionSummary[]> {
  // Use a single query with JOINs and subqueries for intake status
  const results = await db
    .select({
      // Connection fields
      id: connections.id,
      status: connections.status,
      connectedAt: connections.connectedAt,
      // Patient fields via JOIN
      patientId: patients.id,
      patientFirstName: users.firstName,
      patientLastName: users.lastName,
      patientImageUrl: users.imageUrl,
      patientEmail: users.email,
      // Latest intake session via subquery
      intakeStatus: sql<string>`(
        SELECT status FROM intake_sessions 
        WHERE connection_id = ${connections.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
      intakeCompleteness: sql<number>`(
        SELECT completeness FROM intake_sessions 
        WHERE connection_id = ${connections.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
      intakeSessionId: sql<string>`(
        SELECT id FROM intake_sessions 
        WHERE connection_id = ${connections.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
    })
    .from(connections)
    .innerJoin(patients, eq(connections.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .where(and(
      eq(connections.doctorId, doctorId),
      eq(connections.status, 'active')
    ))
    .orderBy(
      // Sort by intake status: ready first, then in_progress, then others
      sql`CASE 
        WHEN (SELECT status FROM intake_sessions WHERE connection_id = ${connections.id} ORDER BY created_at DESC LIMIT 1) = 'ready' THEN 0
        WHEN (SELECT status FROM intake_sessions WHERE connection_id = ${connections.id} ORDER BY created_at DESC LIMIT 1) = 'in_progress' THEN 1
        ELSE 2
      END`,
      desc(connections.connectedAt)
    );

  // Transform to ConnectionSummary format
  return results.map((row) => ({
    id: row.id,
    status: row.status,
    connectedAt: row.connectedAt,
    patient: {
      id: row.patientId,
      firstName: row.patientFirstName,
      lastName: row.patientLastName,
      imageUrl: row.patientImageUrl,
      email: row.patientEmail,
    },
    intakeStatus: row.intakeStatus ? {
      status: row.intakeStatus as 'not_started' | 'in_progress' | 'ready' | 'reviewed',
      completeness: row.intakeCompleteness ?? 0,
      sessionId: row.intakeSessionId ?? null,
    } : null,
  }));
}


/**
 * Get doctor dashboard appointments with patient info using JOINs.
 * Returns only lean AppointmentSummary fields.
 * 
 * Requirements: 6.3, 2.1
 */
async function getDoctorDashboardAppointments(
  db: typeof import('@/server/db').db,
  doctorId: string
): Promise<AppointmentSummary[]> {
  const results = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      duration: appointments.duration,
      status: appointments.status,
      connectionId: appointments.connectionId,
      intakeSessionId: appointments.intakeSessionId,
      // Patient info via JOINs
      patientId: patients.id,
      patientFirstName: users.firstName,
      patientLastName: users.lastName,
      patientImageUrl: users.imageUrl,
    })
    .from(appointments)
    .innerJoin(connections, eq(appointments.connectionId, connections.id))
    .innerJoin(patients, eq(connections.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .where(
      and(
        eq(connections.doctorId, doctorId),
        gte(appointments.scheduledAt, new Date()),
        inArray(appointments.status, ['pending', 'confirmed'])
      )
    )
    .orderBy(appointments.scheduledAt)
    .limit(10);

  // Transform to AppointmentSummary format
  return results.map((row) => ({
    id: row.id,
    scheduledAt: row.scheduledAt,
    duration: row.duration,
    status: row.status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
    connectionId: row.connectionId,
    intakeSessionId: row.intakeSessionId,
    patient: {
      id: row.patientId,
      firstName: row.patientFirstName,
      lastName: row.patientLastName,
      imageUrl: row.patientImageUrl,
    },
  }));
}

/**
 * Get doctor dashboard stats using COUNT queries.
 * Uses Promise.all for parallel execution.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */
async function getDoctorDashboardStats(
  db: typeof import('@/server/db').db,
  doctorId: string
): Promise<DoctorDashboardStats> {
  const [totalPatients, todayAppointments, pendingReviews, newPatientsThisWeek] = 
    await Promise.all([
      // Total active patients
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(connections)
        .where(and(
          eq(connections.doctorId, doctorId),
          eq(connections.status, 'active')
        )),
      // Today's appointments
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .where(and(
          eq(connections.doctorId, doctorId),
          sql`DATE(${appointments.scheduledAt}) = CURRENT_DATE`,
          inArray(appointments.status, ['pending', 'confirmed'])
        )),
      // Pending reviews (intake sessions with status 'ready')
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(intakeSessions)
        .innerJoin(connections, eq(intakeSessions.connectionId, connections.id))
        .where(and(
          eq(connections.doctorId, doctorId),
          eq(intakeSessions.status, 'ready')
        )),
      // New patients this week
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(connections)
        .where(and(
          eq(connections.doctorId, doctorId),
          eq(connections.status, 'active'),
          gte(connections.connectedAt, sql`CURRENT_DATE - INTERVAL '7 days'`)
        )),
    ]);

  return {
    totalPatients: totalPatients[0]?.count ?? 0,
    todayAppointments: todayAppointments[0]?.count ?? 0,
    pendingReviews: pendingReviews[0]?.count ?? 0,
    newPatientsThisWeek: newPatientsThisWeek[0]?.count ?? 0,
  };
}


/**
 * Get patient dashboard connections with doctor info using JOINs.
 * Returns only lean ConnectionSummary fields.
 * 
 * Requirements: 7.1, 7.4
 */
async function getPatientDashboardConnections(
  db: typeof import('@/server/db').db,
  patientId: string
): Promise<ConnectionSummary[]> {
  const results = await db
    .select({
      // Connection fields
      id: connections.id,
      status: connections.status,
      connectedAt: connections.connectedAt,
      // Doctor fields via JOIN
      doctorId: doctors.id,
      doctorFirstName: users.firstName,
      doctorLastName: users.lastName,
      doctorImageUrl: users.imageUrl,
      doctorSpecialty: doctors.specialty,
      doctorClinicName: doctors.clinicName,
      // Latest intake session via subquery
      intakeStatus: sql<string>`(
        SELECT status FROM intake_sessions 
        WHERE connection_id = ${connections.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
      intakeCompleteness: sql<number>`(
        SELECT completeness FROM intake_sessions 
        WHERE connection_id = ${connections.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
      intakeSessionId: sql<string>`(
        SELECT id FROM intake_sessions 
        WHERE connection_id = ${connections.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
    })
    .from(connections)
    .innerJoin(doctors, eq(connections.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(and(
      eq(connections.patientId, patientId),
      eq(connections.status, 'active')
    ))
    .orderBy(desc(connections.connectedAt));

  // Transform to ConnectionSummary format
  return results.map((row) => ({
    id: row.id,
    status: row.status,
    connectedAt: row.connectedAt,
    doctor: {
      id: row.doctorId,
      firstName: row.doctorFirstName,
      lastName: row.doctorLastName,
      imageUrl: row.doctorImageUrl,
      specialty: row.doctorSpecialty,
      clinicName: row.doctorClinicName,
    },
    intakeStatus: row.intakeStatus ? {
      status: row.intakeStatus as 'not_started' | 'in_progress' | 'ready' | 'reviewed',
      completeness: row.intakeCompleteness ?? 0,
      sessionId: row.intakeSessionId ?? null,
    } : null,
  }));
}

/**
 * Get patient dashboard appointments with doctor info using JOINs.
 * Returns only lean AppointmentSummary fields.
 * 
 * Requirements: 7.3, 2.1
 */
async function getPatientDashboardAppointments(
  db: typeof import('@/server/db').db,
  patientId: string
): Promise<AppointmentSummary[]> {
  const results = await db
    .select({
      id: appointments.id,
      scheduledAt: appointments.scheduledAt,
      duration: appointments.duration,
      status: appointments.status,
      connectionId: appointments.connectionId,
      intakeSessionId: appointments.intakeSessionId,
      // Doctor info via JOINs
      doctorId: doctors.id,
      doctorFirstName: users.firstName,
      doctorLastName: users.lastName,
      doctorImageUrl: users.imageUrl,
      doctorSpecialty: doctors.specialty,
      doctorClinicName: doctors.clinicName,
    })
    .from(appointments)
    .innerJoin(connections, eq(appointments.connectionId, connections.id))
    .innerJoin(doctors, eq(connections.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(
      and(
        eq(connections.patientId, patientId),
        gte(appointments.scheduledAt, new Date()),
        inArray(appointments.status, ['pending', 'confirmed'])
      )
    )
    .orderBy(appointments.scheduledAt)
    .limit(10);

  // Transform to AppointmentSummary format
  return results.map((row) => ({
    id: row.id,
    scheduledAt: row.scheduledAt,
    duration: row.duration,
    status: row.status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
    connectionId: row.connectionId,
    intakeSessionId: row.intakeSessionId,
    doctor: {
      id: row.doctorId,
      firstName: row.doctorFirstName,
      lastName: row.doctorLastName,
      imageUrl: row.doctorImageUrl,
      specialty: row.doctorSpecialty,
      clinicName: row.doctorClinicName,
    },
  }));
}

/**
 * Get patient dashboard stats using COUNT queries.
 * 
 * Requirements: 4.1
 */
async function getPatientDashboardStats(
  db: typeof import('@/server/db').db,
  patientId: string
): Promise<PatientDashboardStats> {
  const [connectedDoctors, upcomingAppointments, completedIntakes] = 
    await Promise.all([
      // Connected doctors
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(connections)
        .where(and(
          eq(connections.patientId, patientId),
          eq(connections.status, 'active')
        )),
      // Upcoming appointments
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .innerJoin(connections, eq(appointments.connectionId, connections.id))
        .where(and(
          eq(connections.patientId, patientId),
          gte(appointments.scheduledAt, new Date()),
          inArray(appointments.status, ['pending', 'confirmed'])
        )),
      // Completed intakes
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(intakeSessions)
        .innerJoin(connections, eq(intakeSessions.connectionId, connections.id))
        .where(and(
          eq(connections.patientId, patientId),
          inArray(intakeSessions.status, ['ready', 'reviewed'])
        )),
    ]);

  return {
    connectedDoctors: connectedDoctors[0]?.count ?? 0,
    upcomingAppointments: upcomingAppointments[0]?.count ?? 0,
    completedIntakes: completedIntakes[0]?.count ?? 0,
  };
}


/**
 * Get admin dashboard stats using parallel COUNT queries.
 * 
 * Requirements: 8.1
 */
async function getAdminDashboardStats(
  db: typeof import('@/server/db').db
): Promise<AdminDashboardStats> {
  const [
    totalUsers,
    totalDoctors,
    totalPatients,
    todayAppointments,
    activeUsers,
    totalConnections,
    completedIntakes,
    pendingVerifications,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(doctors),
    db.select({ count: sql<number>`count(*)::int` }).from(patients),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(
        sql`DATE(${appointments.scheduledAt}) = CURRENT_DATE`,
        inArray(appointments.status, ['pending', 'confirmed'])
      )),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isActive, true)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(connections)
      .where(eq(connections.status, 'active')),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(intakeSessions)
      .where(inArray(intakeSessions.status, ['ready', 'reviewed'])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(doctors)
      .where(eq(doctors.verificationStatus, 'pending')),
  ]);

  return {
    totalUsers: totalUsers[0]?.count ?? 0,
    totalDoctors: totalDoctors[0]?.count ?? 0,
    totalPatients: totalPatients[0]?.count ?? 0,
    todayAppointments: todayAppointments[0]?.count ?? 0,
    activeUsers: activeUsers[0]?.count ?? 0,
    totalConnections: totalConnections[0]?.count ?? 0,
    completedIntakes: completedIntakes[0]?.count ?? 0,
    pendingVerifications: pendingVerifications[0]?.count ?? 0,
  };
}

/**
 * Get activity feed with user info using JOINs.
 * 
 * Requirements: 8.2
 */
async function getActivityFeedWithUsers(
  db: typeof import('@/server/db').db
): Promise<ActivityFeedItem[]> {
  const results = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      createdAt: auditLogs.createdAt,
      userId: users.id,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userImageUrl: users.imageUrl,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);

  return results.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    createdAt: row.createdAt,
    user: row.userId ? {
      id: row.userId,
      firstName: row.userFirstName,
      lastName: row.userLastName,
      imageUrl: row.userImageUrl,
    } : null,
  }));
}

/**
 * Get pending doctors with user info using JOINs.
 * 
 * Requirements: 8.3
 */
async function getPendingDoctorsWithUsers(
  db: typeof import('@/server/db').db
): Promise<PendingDoctorItem[]> {
  const results = await db
    .select({
      id: doctors.id,
      specialty: doctors.specialty,
      clinicName: doctors.clinicName,
      createdAt: doctors.createdAt,
      userId: users.id,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
      userImageUrl: users.imageUrl,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.verificationStatus, 'pending'))
    .orderBy(desc(doctors.createdAt))
    .limit(10);

  return results.map((row) => ({
    id: row.id,
    specialty: row.specialty,
    clinicName: row.clinicName,
    createdAt: row.createdAt,
    user: {
      id: row.userId,
      firstName: row.userFirstName,
      lastName: row.userLastName,
      email: row.userEmail,
      imageUrl: row.userImageUrl,
    },
  }));
}


// ============================================================================
// DASHBOARD ROUTER
// ============================================================================

export const dashboardRouter = createTRPCRouter({
  /**
   * Get consolidated doctor dashboard data.
   * Fetches profile, connections, appointments, and stats in parallel.
   * 
   * Requirements: 1.1, 6.2, 6.3, 6.4
   */
  getDoctorDashboard: doctorProcedure.query(async ({ ctx }) => {
    if (!ctx.doctor) {
      return {
        stats: { totalPatients: 0, todayAppointments: 0, pendingReviews: 0, newPatientsThisWeek: 0 },
        connections: [],
        appointments: [],
      };
    }

    // Parallel execution of optimized queries
    const [connectionsData, appointmentsData, stats] = await Promise.all([
      getDoctorDashboardConnections(ctx.db, ctx.doctor.id),
      getDoctorDashboardAppointments(ctx.db, ctx.doctor.id),
      getDoctorDashboardStats(ctx.db, ctx.doctor.id),
    ]);

    return {
      stats,
      connections: connectionsData,
      appointments: appointmentsData,
    };
  }),

  /**
   * Get consolidated patient dashboard data.
   * Fetches connections, appointments, and stats in parallel.
   * 
   * Requirements: 1.2, 7.1, 7.3, 7.4
   */
  getPatientDashboard: patientProcedure.query(async ({ ctx }) => {
    if (!ctx.patient) {
      return {
        stats: { connectedDoctors: 0, upcomingAppointments: 0, completedIntakes: 0 },
        connections: [],
        appointments: [],
      };
    }

    // Parallel execution of optimized queries
    const [connectionsData, appointmentsData, stats] = await Promise.all([
      getPatientDashboardConnections(ctx.db, ctx.patient.id),
      getPatientDashboardAppointments(ctx.db, ctx.patient.id),
      getPatientDashboardStats(ctx.db, ctx.patient.id),
    ]);

    return {
      stats,
      connections: connectionsData,
      appointments: appointmentsData,
    };
  }),

  /**
   * Get consolidated admin dashboard data.
   * Fetches stats, activity feed, and pending doctors in parallel.
   * 
   * Requirements: 1.3, 8.1, 8.2, 8.3
   */
  getAdminDashboard: adminProcedure.query(async ({ ctx }) => {
    // Parallel execution of optimized queries
    const [stats, activity, pendingDoctors] = await Promise.all([
      getAdminDashboardStats(ctx.db),
      getActivityFeedWithUsers(ctx.db),
      getPendingDoctorsWithUsers(ctx.db),
    ]);

    return {
      stats,
      activity,
      pendingDoctors,
    };
  }),
});

// Export helper functions for testing
export {
  getDoctorDashboardConnections,
  getDoctorDashboardAppointments,
  getDoctorDashboardStats,
  getPatientDashboardConnections,
  getPatientDashboardAppointments,
  getPatientDashboardStats,
  getAdminDashboardStats,
  getActivityFeedWithUsers,
  getPendingDoctorsWithUsers,
};
