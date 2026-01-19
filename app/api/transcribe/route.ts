import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenAI } from '@google/genai';
import { and, eq, gte, isNull, or } from 'drizzle-orm';
import { db } from '@/server/db';
import { appointments, connections, doctors, userRoles, users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for transcription
export const dynamic = 'force-dynamic';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const TRANSCRIPTION_SYSTEM_INSTRUCTION = `You are a highly accurate medical transcriptionist.
Transcribe the provided audio of a doctor-patient encounter.

STRICT FORMATTING RULES:
- Identify speakers as **Doctor:** and **Patient:**.
- ALWAYS start a new line for a new speaker.
- PREPEND A DOUBLE NEWLINE before every speaker label.
- If the speaker is unknown, use **Unknown:**.
- Do not add intro/outro text. Return only the transcript.`;

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
        scribeTranscript: string | null;
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
        scribeTranscript: true,
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
      scribeTranscript: appointments.scribeTranscript,
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

    // Transcription always uses Gemini SDK regardless of AI_PROVIDER setting
    // because Gemini is the only provider that supports audio transcription
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const aiProvider = process.env.AI_PROVIDER || 'gemini';
      const errorDetails = aiProvider === 'openai'
        ? 'GEMINI_API_KEY is required for transcription even when using OpenAI as the main AI provider. Gemini SDK is the only supported transcription backend.'
        : 'GEMINI_API_KEY environment variable is not set';
      return NextResponse.json(
        { error: 'Configuration error', details: errorDetails },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const appointmentIdRaw = formData.get('appointmentId');
    const audio = formData.get('audio');

    const appointmentId = typeof appointmentIdRaw === 'string' ? appointmentIdRaw : '';
    if (!appointmentId || !isUuid(appointmentId)) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'appointmentId must be a valid UUID' },
        { status: 400 },
      );
    }

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'audio must be a file in multipart/form-data' },
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
        { error: 'Invalid appointment', details: 'Cannot transcribe for a cancelled appointment.' },
        { status: 400 },
      );
    }

    if (!appointmentCheck.appointment.scribeIsActive) {
      return NextResponse.json(
        { error: 'Scribe inactive', details: 'Activate this appointment for scribing before transcribing.' },
        { status: 409 },
      );
    }

    if (audio.size <= 0) {
      return NextResponse.json({ error: 'Invalid file', details: 'audio file is empty' }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: 'File too large',
          details: `Audio file exceeds ${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))}MB limit`,
        },
        { status: 413 },
      );
    }

    const mimeType = audio.type || 'audio/webm';
    const base64Audio = Buffer.from(await audio.arrayBuffer()).toString('base64');

    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_TRANSCRIPTION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: TRANSCRIPTION_SYSTEM_INSTRUCTION,
        temperature: 0.1,
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          {
            text: 'Transcribe this audio.',
          },
        ],
      },
    });

    const transcript = response.text || '';

    const existingTranscript = appointmentCheck.appointment.scribeTranscript || '';
    const combined = existingTranscript.trim()
      ? `${existingTranscript}\n\n${transcript}`
      : transcript;

    const MAX_STORED_TRANSCRIPT_CHARS = 200_000;
    const storedTranscript =
      combined.length > MAX_STORED_TRANSCRIPT_CHARS
        ? combined.slice(combined.length - MAX_STORED_TRANSCRIPT_CHARS)
        : combined;

    await db
      .update(appointments)
      .set({
        scribeTranscript: storedTranscript,
        scribeUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('Transcribe API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
