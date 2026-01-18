import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { users, doctors, patients } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const onboardingSchema = z.object({
  role: z.enum(['doctor', 'patient']),
});

// Generate a unique slug for doctors
function generateSlug(firstName: string | null, lastName: string | null): string {
  const base = `${firstName || 'dr'}-${lastName || 'user'}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${random}`;
}

// GET - Check if user exists and return their role
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      role: existingUser.primaryRole,
      email: existingUser.email,
    });

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const validation = onboardingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid role selection', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { role } = validation.data;

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (existingUser) {
      // User already onboarded, redirect based on existing role
      return NextResponse.json({
        message: 'User already onboarded',
        role: existingUser.primaryRole,
        redirectTo: existingUser.primaryRole === 'doctor' ? '/doctor' : '/patient',
      });
    }

    // Create user in database
    const [newUser] = await db.insert(users).values({
      clerkId: userId,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      primaryRole: role,
      isActive: true,
    }).returning();

    if (!newUser) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // Create role-specific profile
    if (role === 'doctor') {
      const slug = generateSlug(clerkUser.firstName, clerkUser.lastName);
      await db.insert(doctors).values({
        userId: newUser.id,
        slug,
        verificationStatus: 'pending',
      });
    } else {
      await db.insert(patients).values({
        userId: newUser.id,
      });
    }

    return NextResponse.json({
      message: 'Onboarding complete',
      role,
      redirectTo: role === 'doctor' ? '/doctor' : '/patient',
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
