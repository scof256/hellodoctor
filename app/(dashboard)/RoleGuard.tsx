'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

/**
 * RoleGuard component ensures users are on the correct dashboard based on their role.
 * 
 * This fixes the issue where after redeployment, users might be on the wrong dashboard
 * (e.g., a doctor seeing the patient dashboard or vice versa).
 * 
 * The component:
 * 1. Fetches the user's actual role from the database
 * 2. Compares it with the current dashboard path
 * 3. Redirects to the correct dashboard if there's a mismatch
 * 4. Shows a loading state during verification
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useUser();
  const [isVerifying, setIsVerifying] = useState(true);
  const [roleVerified, setRoleVerified] = useState(false);

  useEffect(() => {
    async function verifyRole() {
      // Wait for Clerk to load
      if (!isLoaded) {
        return;
      }

      // If not signed in, let middleware handle redirect
      if (!isSignedIn) {
        setIsVerifying(false);
        return;
      }

      // Skip verification for non-dashboard routes
      if (!pathname?.startsWith('/patient') && !pathname?.startsWith('/doctor') && !pathname?.startsWith('/admin')) {
        setIsVerifying(false);
        setRoleVerified(true);
        return;
      }

      try {
        // Fetch user's actual role from database
        const response = await fetch('/api/auth/onboarding', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch user role');
          setIsVerifying(false);
          return;
        }

        const data = await response.json();
        const userRole = data.role as string;

        // Determine which dashboard the user is currently on
        const isOnPatientDashboard = pathname.startsWith('/patient');
        const isOnDoctorDashboard = pathname.startsWith('/doctor');
        const isOnAdminDashboard = pathname.startsWith('/admin');

        // Check for role mismatch and redirect if necessary
        if (userRole === 'patient' && !isOnPatientDashboard) {
          console.log('Role mismatch detected: User is patient but on wrong dashboard. Redirecting...');
          router.push('/patient');
          return;
        }

        if (userRole === 'doctor' && !isOnDoctorDashboard) {
          console.log('Role mismatch detected: User is doctor but on wrong dashboard. Redirecting...');
          router.push('/doctor');
          return;
        }

        if (userRole === 'super_admin' && !isOnAdminDashboard && !isOnDoctorDashboard) {
          // Admins can access both admin and doctor dashboards
          // If they're on patient dashboard, redirect to admin
          if (isOnPatientDashboard) {
            console.log('Role mismatch detected: Admin on patient dashboard. Redirecting...');
            router.push('/admin');
            return;
          }
        }

        // Role matches, allow access
        setRoleVerified(true);
      } catch (error) {
        console.error('Error verifying user role:', error);
      } finally {
        setIsVerifying(false);
      }
    }

    verifyRole();
  }, [isLoaded, isSignedIn, pathname, router]);

  // Show loading state while verifying
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If role is verified or verification is complete, show children
  return <>{children}</>;
}
