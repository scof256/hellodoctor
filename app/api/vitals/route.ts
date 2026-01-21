import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { intakeSessions } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { VitalsTriageService } from '@/server/services/vitals-triage';
import { validateTemperature, validateWeight, validateBloodPressure, validateAge } from '@/lib/vitals-validation';
import type { VitalsData, MedicalData } from '@/app/types';

interface SaveVitalsRequest {
  sessionId: string;
  vitalsData: Partial<VitalsData>;
}

interface SaveVitalsResponse {
  success: boolean;
  triageDecision: 'emergency' | 'normal' | 'pending';
  triageReason: string;
  recommendations: string[];
}

interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * POST /api/vitals
 * Save vitals data to an intake session and perform triage assessment
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Unauthorized', details: 'User must be authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as SaveVitalsRequest;
    
    // Validate required fields
    if (!body.sessionId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing required field', details: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!body.vitalsData) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Missing required field', details: 'vitalsData is required' },
        { status: 400 }
      );
    }

    // Fetch the intake session
    const [session] = await db
      .select()
      .from(intakeSessions)
      .where(eq(intakeSessions.id, body.sessionId))
      .limit(1);

    if (!session) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Not found', details: 'Intake session not found' },
        { status: 404 }
      );
    }

    // Verify user owns this session
    if (session.patientId !== userId) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Forbidden', details: 'You do not have access to this session' },
        { status: 403 }
      );
    }

    // Validate vitals data
    const validationErrors: string[] = [];

    if (body.vitalsData.patientAge !== undefined && body.vitalsData.patientAge !== null) {
      const ageValidation = validateAge(body.vitalsData.patientAge);
      if (!ageValidation.valid) {
        validationErrors.push(ageValidation.error || 'Invalid age');
      }
    }

    if (body.vitalsData.temperature?.value !== undefined && body.vitalsData.temperature?.value !== null) {
      const tempValidation = validateTemperature(
        body.vitalsData.temperature.value,
        body.vitalsData.temperature.unit || 'celsius'
      );
      if (!tempValidation.valid) {
        validationErrors.push(tempValidation.error || 'Invalid temperature');
      }
    }

    if (body.vitalsData.weight?.value !== undefined && body.vitalsData.weight?.value !== null) {
      const weightValidation = validateWeight(
        body.vitalsData.weight.value,
        body.vitalsData.weight.unit || 'kg'
      );
      if (!weightValidation.valid) {
        validationErrors.push(weightValidation.error || 'Invalid weight');
      }
    }

    if (body.vitalsData.bloodPressure?.systolic !== undefined || body.vitalsData.bloodPressure?.diastolic !== undefined) {
      const bpValidation = validateBloodPressure(
        body.vitalsData.bloodPressure?.systolic || null,
        body.vitalsData.bloodPressure?.diastolic || null
      );
      if (!bpValidation.valid) {
        validationErrors.push(bpValidation.error || 'Invalid blood pressure');
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json<ErrorResponse>(
        { error: 'Validation failed', details: validationErrors.join('; ') },
        { status: 400 }
      );
    }

    // Get existing medical data
    const existingMedicalData = (session.medicalData as MedicalData) || {};

    // Merge vitals data with existing data
    const currentVitalsData = existingMedicalData.vitalsData || {
      patientName: null,
      patientAge: null,
      patientGender: null,
      vitalsCollected: false,
      temperature: { value: null, unit: 'celsius', collectedAt: null },
      weight: { value: null, unit: 'kg', collectedAt: null },
      bloodPressure: { systolic: null, diastolic: null, collectedAt: null },
      currentStatus: null,
      triageDecision: 'pending' as const,
      triageReason: null,
      vitalsStageCompleted: false
    };

    // Update vitals data with new values
    const updatedVitalsData: VitalsData = {
      ...currentVitalsData,
      ...body.vitalsData,
      // Merge nested objects properly
      temperature: {
        ...currentVitalsData.temperature,
        ...(body.vitalsData.temperature || {}),
        collectedAt: body.vitalsData.temperature?.value !== undefined 
          ? new Date().toISOString() 
          : currentVitalsData.temperature.collectedAt
      },
      weight: {
        ...currentVitalsData.weight,
        ...(body.vitalsData.weight || {}),
        collectedAt: body.vitalsData.weight?.value !== undefined 
          ? new Date().toISOString() 
          : currentVitalsData.weight.collectedAt
      },
      bloodPressure: {
        ...currentVitalsData.bloodPressure,
        ...(body.vitalsData.bloodPressure || {}),
        collectedAt: (body.vitalsData.bloodPressure?.systolic !== undefined || body.vitalsData.bloodPressure?.diastolic !== undefined)
          ? new Date().toISOString() 
          : currentVitalsData.bloodPressure.collectedAt
      }
    };

    // Perform triage assessment
    const triageService = new VitalsTriageService();
    const vitalsResult = triageService.assessVitals(updatedVitalsData);
    const symptomsResult = triageService.assessSymptoms(updatedVitalsData.currentStatus || '');
    const finalResult = triageService.combineAssessments(vitalsResult, symptomsResult);

    // Update triage decision in vitals data
    updatedVitalsData.triageDecision = finalResult.decision;
    updatedVitalsData.triageReason = finalResult.reason;

    // Update medical data
    const updatedMedicalData: MedicalData = {
      ...existingMedicalData,
      vitalsData: updatedVitalsData
    };

    // Save to database
    await db
      .update(intakeSessions)
      .set({
        medicalData: updatedMedicalData,
        updatedAt: new Date()
      })
      .where(eq(intakeSessions.id, body.sessionId));

    return NextResponse.json<SaveVitalsResponse>({
      success: true,
      triageDecision: finalResult.decision,
      triageReason: finalResult.reason,
      recommendations: finalResult.recommendations
    });

  } catch (error) {
    console.error('Vitals API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json<ErrorResponse>(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
