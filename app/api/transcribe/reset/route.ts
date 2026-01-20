import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/server/db';
import { appointments, connections, doctors, userRoles, users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

function isEnvSuperuser(clerkId: string): boolean {
  const superuserIds = process.env.SUPERUSER_IDS?.split(',').map((id) => id.trim()) || [];
  return superuserIds.includes(clerkId);
}

async function ensureDoctorRole(clerkId: string): Promise<{ ok: true } | { ok: false; status: number; details: string }> {
  if (isEnvSuperuser(clerkId)) return { ok: true };

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    return { ok: false, status: 401, details: 'User not found. Please complete onboarding.' };
  }

  if (!user.isActive) {
    return { ok: false, status: 403, details: 'Account deactivated.' };
  }

  if (user.primaryRole === 'doctor' || user.primaryRole === 'super_admin') {
    return { ok: true };
  }

  const additionalRoles = await db.query.userRoles.findMany({
    where: and(
      eq(userRoles.userId, user.id),
      or(isNull(userRoles.effectiveUntil), gte(userRoles.effectiveUntil, new Date())),
    ),
  });

  const hasAllowedRole = additionalRoles.some((r) => r.role === 'doctor' || r.role === 'super_admin');
  if (!hasAllowedRole) {
    return { ok: false, status: 403, details: 'Doctor access required.' };
  }

  return { ok: true };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getAuthorizedAppointment(input: {
  clerkId: string;
  appointmentId: string;
}): Promise<
  | {
      ok: true;
      appointment: {
        id: string;
        status: string;
        scribeIsActive: boolean;
      };
    }
  | { ok: false; status: number; details: string }
> {
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, input.clerkId) });
  if (!user) {
    return { ok: false, status: 401, details: 'User not found. Please complete onboarding.' };
  }

  if (!user.isActive) {
    return { ok: false, status: 403, details: 'Account deactivated.' };
  }

  if (user.primaryRole === 'super_admin' || isEnvSuperuser(input.clerkId)) {
    const row = await db.query.appointments.findFirst({
      where: eq(appointments.id, input.appointmentId),
      columns: {
        id: true,
        status: true,
        scribeIsActive: true,
      },
    });

    if (!row) return { ok: false, status: 404, details: 'Appointment not found' };
    return { ok: true, appointment: row };
  }

  const doctor = await db.query.doctors.findFirst({ where: eq(doctors.userId, user.id) });
  if (!doctor) {
    return { ok: false, status: 403, details: 'Doctor access required.' };
  }

  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      scribeIsActive: appointments.scribeIsActive,
    })
    .from(appointments)
    .innerJoin(connections, eq(appointments.connectionId, connections.id))
    .where(and(eq(appointments.id, input.appointmentId), eq(connections.doctorId, doctor.id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { ok: false, status: 404, details: 'Appointment not found' };
  }

  return { ok: true, appointment: row };
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', details: 'You must be logged in.' }, { status: 401 });
    }

    const roleCheck = await ensureDoctorRole(userId);
    if (!roleCheck.ok) {
      return NextResponse.json({ error: 'Forbidden', details: roleCheck.details }, { status: roleCheck.status });
    }

    const body = (await request.json()) as { appointmentId?: string };
    const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId : '';

    if (!appointmentId || !isUuid(appointmentId)) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'appointmentId must be a valid UUID' },
        { status: 400 },
      );
    }

    const appointmentCheck = await getAuthorizedAppointment({ clerkId: userId, appointmentId });
    if (!appointmentCheck.ok) {
      return NextResponse.json(
        { error: appointmentCheck.status === 404 ? 'Not found' : 'Forbidden', details: appointmentCheck.details },
        { status: appointmentCheck.status },
      );
    }

    if (appointmentCheck.appointment.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Invalid appointment', details: 'Cannot reset transcription for a cancelled appointment.' },
        { status: 400 },
      );
    }

    if (!appointmentCheck.appointment.scribeIsActive) {
      return NextResponse.json(
        { error: 'Scribe inactive', details: 'Scribe must be active to reset transcription.' },
        { status: 409 },
      );
    }

    // Reset the transcription by setting it to null
    await db
      .update(appointments)
      .set({
        scribeTranscript: null,
        scribeUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset transcription API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
