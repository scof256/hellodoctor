import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenAI } from '@google/genai';
import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/server/db';
import { appointments, connections, doctors, userRoles, users } from '@/server/db/schema';

export const runtime = 'nodejs';

type AnalysisType = 'live_insights' | 'summary' | 'soap' | 'action_items' | 'risk_assessment';

const ANALYSIS_SYSTEM_INSTRUCTION = `You are a senior medical consultant.
Analyze the provided transcript of a doctor-patient encounter.
Return concise, clinically useful output for a doctor to document the visit.
Use Markdown formatting.`;

const MAX_TRANSCRIPT_CHARS = 200_000;

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

function buildPrompt(type: AnalysisType): string {
  switch (type) {
    case 'live_insights':
      return [
        'Based on the conversation SO FAR:',
        '1. Provide a 2-sentence summary of the current medical context.',
        '2. List 3 key potential questions or ideas the doctor should explore next.',
        'Keep it brief and actionable.',
      ].join('\n');
    case 'summary':
      return 'Provide a concise executive summary of this consultation.';
    case 'soap':
      return 'Generate a structured SOAP note (Subjective, Objective, Assessment, Plan) based on this conversation.';
    case 'action_items':
      return 'List all action items, prescriptions, follow-ups, and patient instructions.';
    case 'risk_assessment':
      return 'Identify any red flags, risk factors, or urgent medical concerns mentioned.';
  }
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

    // Analysis always uses Gemini SDK regardless of AI_PROVIDER setting
    // because Gemini is the only provider that supports audio transcription/analysis
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const aiProvider = process.env.AI_PROVIDER || 'gemini';
      const errorDetails = aiProvider === 'openai'
        ? 'GEMINI_API_KEY is required for transcript analysis even when using OpenAI as the main AI provider. Gemini SDK is the only supported transcription backend.'
        : 'GEMINI_API_KEY environment variable is not set';
      return NextResponse.json(
        { error: 'Configuration error', details: errorDetails },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { appointmentId?: string; transcript?: string; type?: AnalysisType };

    const appointmentId = typeof body.appointmentId === 'string' ? body.appointmentId : '';
    if (!appointmentId || !isUuid(appointmentId)) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'appointmentId must be a valid UUID' },
        { status: 400 },
      );
    }

    const transcript = typeof body.transcript === 'string' ? body.transcript : '';
    const type = body.type;

    const appointmentCheck = await getAuthorizedAppointment({ clerkId: userId, appointmentId });
    if (!appointmentCheck.ok) {
      return NextResponse.json(
        { error: appointmentCheck.status === 404 ? 'Not found' : 'Forbidden', details: appointmentCheck.details },
        { status: appointmentCheck.status },
      );
    }

    if (appointmentCheck.appointment.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Invalid appointment', details: 'Cannot analyze a cancelled appointment.' },
        { status: 400 },
      );
    }

    if (!appointmentCheck.appointment.scribeIsActive) {
      return NextResponse.json(
        { error: 'Scribe inactive', details: 'Activate this appointment for scribing before generating notes.' },
        { status: 409 },
      );
    }

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'transcript is required' },
        { status: 400 },
      );
    }

    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return NextResponse.json(
        { error: 'Transcript too large', details: 'Please shorten the transcript and try again.' },
        { status: 413 },
      );
    }

    const allowedTypes: AnalysisType[] = ['live_insights', 'summary', 'soap', 'action_items', 'risk_assessment'];
    if (!type || !allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Missing required field', details: `type must be one of: ${allowedTypes.join(', ')}` },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_ANALYSIS_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    const prompt = buildPrompt(type);

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
      contents: `TRANSCRIPT:\n${transcript}\n\nTASK:\n${prompt}`,
    });

    const content = response.text || '';

    const update: Partial<typeof appointments.$inferInsert> = {
      scribeUpdatedAt: new Date(),
      updatedAt: new Date(),
    };

    if (type === 'summary') update.scribeSummary = content;
    if (type === 'soap') update.scribeSoap = content;
    if (type === 'action_items') update.scribeActionItems = content;
    if (type === 'risk_assessment') update.scribeRiskAssessment = content;

    if (type !== 'live_insights') {
      await db.update(appointments).set(update).where(eq(appointments.id, appointmentId));
    }

    return NextResponse.json({ type, content });
  } catch (error) {
    console.error('Analyze transcript API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
