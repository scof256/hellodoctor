'use server';

import { auth } from '@clerk/nextjs/server';
import { streamService, type GenerateStreamTokenParams, type StreamTokenResponse } from '@/server/services/stream';
import { meetingAuthService } from '@/server/services/meeting-auth';

export async function generateStreamToken(params?: { callId?: string; appointmentId?: string }): Promise<StreamTokenResponse> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('Unauthorized: User must be authenticated');
  }

  if (!streamService.isConfigured()) {
    throw new Error('Stream service is not configured');
  }

  // If appointmentId is provided, validate meeting access
  if (params?.appointmentId) {
    const accessResult = await meetingAuthService.validateTokenPermissions({
      appointmentId: params.appointmentId,
      userId,
    });

    if (!accessResult.hasAccess) {
      throw new Error(accessResult.errorMessage || 'Access denied to this meeting');
    }
  }

  return await streamService.generateToken({
    userId,
    callId: params?.callId,
  });
}