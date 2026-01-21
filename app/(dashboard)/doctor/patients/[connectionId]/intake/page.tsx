import { api } from '@/trpc/server';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import DoctorIntakeInterface from './DoctorIntakeInterface';

interface DoctorIntakePageProps {
  params: Promise<{
    connectionId: string;
  }>;
}

/**
 * Doctor Intake Page - Server Component
 * 
 * This page serves as the entry point for the doctor's immersive intake interface.
 * It handles:
 * - Authentication and authorization checks (via tRPC doctorProcedure)
 * - Initial data fetching using tRPC server-side
 * - Passing data to the client component for interactivity
 * 
 * Requirements: 1.1 - Full-page immersive interface
 */
export default async function DoctorIntakePage({ params }: DoctorIntakePageProps) {
  const { connectionId } = await params;

  // Check authentication using Clerk
  const { userId } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }

  try {
    // Fetch initial data server-side
    // The doctorProcedure will handle authorization checks
    const intakeData = await api.intake.getDoctorIntakeSessions({ status: 'all' });
    
    // Find the session for this specific connection
    const intakeSession = intakeData.sessions.find((s: { connectionId: string }) => s.connectionId === connectionId);

    if (!intakeSession) {
      // No intake session exists for this connection yet
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">No Intake Session</h2>
            <p className="text-slate-600 mb-6">This patient hasn&apos;t started their intake yet.</p>
            <a
              href="/doctor/patients"
              className="inline-block px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors"
            >
              Return to Patients
            </a>
          </div>
        </div>
      );
    }

    // Pass initial data to client component
    return (
      <DoctorIntakeInterface
        connectionId={connectionId}
        initialSession={intakeSession}
      />
    );
  } catch (error) {
    console.error('[DoctorIntakePage] Error fetching intake data:', error);
    
    // Handle errors gracefully
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Error Loading Intake</h2>
          <p className="text-slate-600 mb-6">
            {error instanceof Error ? error.message : 'An unexpected error occurred while loading the intake session.'}
          </p>
          <a
            href="/doctor/patients"
            className="inline-block px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors"
          >
            Return to Patients
          </a>
        </div>
      </div>
    );
  }
}
