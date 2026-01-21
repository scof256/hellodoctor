import { NextResponse } from 'next/server';
import { GeminiService } from '@/app/lib/gemini-service';
import { ChatRequest, ChatResponse, ErrorResponse } from '@/app/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as ChatRequest;
    
    // Validate required fields
    if (!body.history || !Array.isArray(body.history)) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing required field', details: 'history must be an array of messages' },
        { status: 400 }
      );
    }
    
    if (!body.medicalData) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing required field', details: 'medicalData is required' },
        { status: 400 }
      );
    }
    
    if (!body.mode || !['patient', 'doctor'].includes(body.mode)) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing required field', details: 'mode must be "patient" or "doctor"' },
        { status: 400 }
      );
    }

    // Create service instance and process request
    const geminiService = new GeminiService();
    const result = await geminiService.sendMessage(
      body.history,
      body.medicalData,
      body.mode
    );

    return NextResponse.json<ChatResponse>(result);

  } catch (error) {
    console.error('Chat API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for specific error types
    if (errorMessage.includes('GEMINI_API_KEY')) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Configuration error', details: 'API key not configured' },
        { status: 500 }
      );
    }
    
    return NextResponse.json<ErrorResponse>(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
