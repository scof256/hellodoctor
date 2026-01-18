import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { users, patients, connections, doctors } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { notificationService } from '@/server/services/notification';
import { auditService } from '@/server/services/audit';

const autoPatientSchema = z.object({
  doctorId: z.string().uuid(),
  connectionSource: z.enum(['qr_scan', 'direct_url']).default('direct_url'),
});

/**
 * Validation result for checking if a user can be enrolled as a patient.
 * Requirements: 1.1, 1.2, 3.1, 3.3
 */
interface ValidationResult {
  canBePatient: boolean;
  reason?: string;
  existingUser?: typeof users.$inferSelect;
  existingDoctor?: typeof doctors.$inferSelect;
}

/**
 * Validates whether a user can be enrolled as a patient.
 * Checks both the primary_role field and existence of doctor profile.
 * 
 * Requirements: 1.1, 1.2, 3.1, 3.3, 3.4
 * - Doctors cannot be enrolled as patients
 * - Users with doctor profiles cannot be enrolled as patients
 * - Both primary_role and profile existence are checked
 */
async function validateUserCanBePatient(clerkId: string): Promise<ValidationResult> {
  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  // New users can be patients
  if (!existingUser) {
    return { canBePatient: true };
  }

  // Check if user has a doctor profile (Requirement 3.1, 3.3)
  const existingDoctor = await db.query.doctors.findFirst({
    where: eq(doctors.userId, existingUser.id),
  });

  if (existingDoctor) {
    return {
      canBePatient: false,
      reason: 'Doctors cannot connect as patients. Please use the professional networking features instead.',
      existingUser,
      existingDoctor,
    };
  }

  // Check primary role (Requirement 1.1, 3.4)
  if (existingUser.primaryRole === 'doctor') {
    return {
      canBePatient: false,
      reason: 'Your account is registered as a doctor. Doctors cannot connect as patients.',
      existingUser,
    };
  }

  return { canBePatient: true, existingUser };
}

/**
 * Auto-create patient profile and connect to doctor.
 * Used when users sign up/in via a doctor's QR code or profile URL.
 * This bypasses the normal onboarding flow and assumes the user is a patient.
 * 
 * Now includes role validation to prevent doctors from being enrolled as patients.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = autoPatientSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { doctorId, connectionSource } = validation.data;

    // Validate that user can be enrolled as a patient (Requirements 1.1, 1.2, 3.1, 3.2, 3.3)
    const roleValidation = await validateUserCanBePatient(userId);
    
    if (!roleValidation.canBePatient) {
      return NextResponse.json(
        { 
          error: roleValidation.reason,
          isDoctor: true,
          code: 'DOCTOR_CANNOT_BE_PATIENT',
        },
        { status: 403 }
      );
    }

    // Verify the doctor exists and is verified
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.id, doctorId),
    });

    if (!doctor) {
      return NextResponse.json(
        { error: 'Doctor not found' },
        { status: 404 }
      );
    }

    if (doctor.verificationStatus !== 'verified') {
      return NextResponse.json(
        { error: 'Cannot connect to an unverified doctor' },
        { status: 403 }
      );
    }

    // Use existing user from validation or check again
    let user = roleValidation.existingUser ?? await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    let patient = user ? await db.query.patients.findFirst({
      where: eq(patients.userId, user.id),
    }) : null;

    // Create user if doesn't exist
    if (!user) {
      const [newUser] = await db.insert(users).values({
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        primaryRole: 'patient',
        isActive: true,
      }).returning();

      if (!newUser) {
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }

      user = newUser;

      // Log user creation
      await auditService.log({
        userId: user.id,
        action: 'user_created',
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          source: 'auto_patient',
          connectionSource,
          doctorId,
        },
      });
    }

    // Create patient profile if doesn't exist
    if (!patient) {
      const [newPatient] = await db.insert(patients).values({
        userId: user.id,
      }).returning();

      if (!newPatient) {
        return NextResponse.json(
          { error: 'Failed to create patient profile' },
          { status: 500 }
        );
      }

      patient = newPatient;

      // Log patient profile creation
      await auditService.log({
        userId: user.id,
        action: 'patient_created',
        resourceType: 'patient',
        resourceId: patient.id,
        metadata: {
          source: 'auto_patient',
          connectionSource,
          doctorId,
        },
      });
    }

    // Check for existing connection
    const existingConnection = await db.query.connections.findFirst({
      where: and(
        eq(connections.patientId, patient.id),
        eq(connections.doctorId, doctorId)
      ),
    });

    if (existingConnection) {
      // If disconnected, reactivate
      if (existingConnection.status === 'disconnected') {
        const [reactivated] = await db
          .update(connections)
          .set({
            status: 'active',
            connectedAt: new Date(),
            disconnectedAt: null,
            connectionSource,
          })
          .where(eq(connections.id, existingConnection.id))
          .returning();

        // Notify doctor
        await notificationService.createConnectionNotification(
          doctor.userId,
          user,
          'reconnected',
          existingConnection.id
        );

        return NextResponse.json({
          message: 'Connection reactivated',
          connectionId: reactivated?.id,
          redirectTo: `/patient/intake/${existingConnection.id}`,
        });
      }

      // Already connected
      return NextResponse.json({
        message: 'Already connected',
        connectionId: existingConnection.id,
        redirectTo: `/patient/intake/${existingConnection.id}`,
      });
    }

    // Create new connection
    const [newConnection] = await db.insert(connections).values({
      patientId: patient.id,
      doctorId,
      status: 'active',
      connectionSource,
      connectedAt: new Date(),
    }).returning();

    if (!newConnection) {
      return NextResponse.json(
        { error: 'Failed to create connection' },
        { status: 500 }
      );
    }

    // Notify doctor of new connection
    await notificationService.createConnectionNotification(
      doctor.userId,
      user,
      'new',
      newConnection.id
    );

    // Log the connection
    await auditService.log({
      userId: user.id,
      action: 'connection_created',
      resourceType: 'connection',
      resourceId: newConnection.id,
      metadata: {
        doctorId,
        connectionSource,
        isAutoPatient: true,
      },
    });

    return NextResponse.json({
      message: 'Patient profile created and connected',
      connectionId: newConnection.id,
      redirectTo: `/patient/intake/${newConnection.id}`,
    });

  } catch (error) {
    console.error('Auto-patient error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
