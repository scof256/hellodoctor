import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/server/db';
import { users, doctors } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const { userId } = await auth();
    
    let userInfo = null;
    let doctorInfo = null;
    
    if (userId) {
      // Get user from database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
      });
      
      if (user) {
        userInfo = {
          id: user.id,
          email: user.email,
          primaryRole: user.primaryRole,
          isActive: user.isActive,
        };
        
        // Get doctor profile if exists
        const doctor = await db.query.doctors.findFirst({
          where: eq(doctors.userId, user.id),
        });
        
        if (doctor) {
          doctorInfo = {
            id: doctor.id,
            slug: doctor.slug,
            verificationStatus: doctor.verificationStatus,
            hasQRCode: !!doctor.qrCodeUrl,
            qrCodePreview: doctor.qrCodeUrl ? doctor.qrCodeUrl.substring(0, 50) + '...' : null,
          };
        }
      }
    }
    
    return NextResponse.json({
      environment: {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
      },
      authentication: {
        isAuthenticated: !!userId,
        clerkUserId: userId || null,
      },
      user: userInfo,
      doctor: doctorInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch debug info',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
