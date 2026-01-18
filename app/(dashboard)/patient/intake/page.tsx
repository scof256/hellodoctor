'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react';

// Type for patient's view of connections (includes doctor info)
type PatientConnection = {
  id: string;
  doctor?: {
    id: string;
    slug: string;
    specialty: string | null;
    clinicName: string | null;
    verificationStatus: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    } | null;
  } | null;
};

export default function PatientIntakeIndexPage() {
  const router = useRouter();
  const { data, isLoading, error } = api.connection.getMyConnections.useQuery();

  const handleOpenConnection = useCallback(
    (connectionId: string) => {
      if (!connectionId) return;
      router.push(`/patient/intake/${connectionId}`);
    },
    [router]
  );

  useEffect(() => {
    if (data?.connections && data.connections.length === 1) {
      router.push(`/patient/intake/${data.connections[0]?.id}`);
    }
  }, [data, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading your connections...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
          <p className="text-slate-600 mb-4">{error.message}</p>
          <Link href="/patient" className="px-4 py-2 bg-teal-600 text-white rounded-lg">Back</Link>
        </div>
      </div>
    );
  }

  // Cast connections to patient view type (this page is only for patients)
  const connections = (data?.connections ?? []) as PatientConnection[];

  if (connections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Connections</h2>
          <p className="text-slate-600 mb-4">Connect with a doctor first.</p>
          <Link href="/patient" className="px-4 py-2 bg-teal-600 text-white rounded-lg">Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Select a Doctor</h1>
      <p className="text-slate-600 mb-6">Choose which doctor for intake:</p>
      <div className="space-y-3">
        {connections.map((conn) => (
          <button
            key={conn.id}
            type="button"
            onClick={() => handleOpenConnection(conn.id)}
            className="w-full flex items-center justify-between p-4 bg-white rounded-lg border hover:border-teal-300 hover:shadow-md text-left"
          >
            <div>
              <h3 className="font-semibold text-slate-800">Dr. {conn.doctor?.user?.firstName} {conn.doctor?.user?.lastName}</h3>
              {conn.doctor?.specialty && <p className="text-sm text-slate-500">{conn.doctor.specialty}</p>}
            </div>
            <ArrowRight className="w-5 h-5 text-teal-600" />
          </button>
        ))}
      </div>
    </div>
  );
}
