import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { streamService } from '@/server/services/stream';
import { z } from 'zod';

const tokenRequestSchema = z.object({
  callId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if Stream is configured
    if (!streamService.isConfigured()) {
      return NextResponse.json(
        { error: 'Stream service is not configured' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const validation = tokenRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { callId } = validation.data;

    // Generate Stream token
    const tokenResponse = await streamService.generateToken({
      userId,
      callId,
    });

    return NextResponse.json({
      token: tokenResponse.token,
      expiresAt: tokenResponse.expiresAt,
      userId,
    });

  } catch (error) {
    console.error('Stream token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Stream token' },
      { status: 500 }
    );
  }
}