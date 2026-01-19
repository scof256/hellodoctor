import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users, doctors } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateDoctorQRCode } from '@/server/services/qr';

/**
 * Test endpoint to regenerate QR code with detailed logging.
 * This helps debug the 403 error by showing exactly what's happening.
 */
export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({
        error: 'Not authenticated',
        step: 'auth_check',
      }, { status: 401 });
    }
    
    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    
    if (!user) {
      return NextResponse.json({
        error: 'User not found in database',
        step: 'user_lookup',
        clerkUserId: userId,
      }, { status: 404 });
    }
    
    if (!user.isActive) {
      return NextResponse.json({
        error: 'User account is not active',
        step: 'user_active_check',
      }, { status: 403 });
    }
    
    // Check if user has doctor role
    if (user.primaryRole !== 'doctor') {
      return NextResponse.json({
        error: 'User is not a doctor',
        step: 'role_check',
        primaryRole: user.primaryRole,
        hint: 'User must have doctor role to regenerate QR code',
      }, { status: 403 });
    }
    
    // Get doctor profile
    const doctor = await db.query.doctors.findFirst({
      where: eq(doctors.userId, user.id),
    });
    
    if (!doctor) {
      return NextResponse.json({
        error: 'Doctor profile not found',
        step: 'doctor_profile_lookup',
        userId: user.id,
      }, { status: 404 });
    }
    
    // Generate new QR code
    const { shareUrl, qrCodeDataUrl } = await generateDoctorQRCode(doctor.slug);
    
    // Update the doctor profile
    const result = await db
      .update(doctors)
      .set({
        qrCodeUrl: qrCodeDataUrl,
        updatedAt: new Date(),
      })
      .where(eq(doctors.id, doctor.id))
      .returning();
    
    const updatedDoctor = result[0];
    
    if (!updatedDoctor) {
      return NextResponse.json({
        error: 'Failed to update QR code in database',
        step: 'database_update',
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'QR code regenerated successfully',
      data: {
        shareUrl,
        qrCodePreview: qrCodeDataUrl.substring(0, 50) + '...',
        doctorSlug: doctor.slug,
        updatedAt: updatedDoctor.updatedAt,
      },
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      step: 'exception',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
