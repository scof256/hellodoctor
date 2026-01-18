'use client';

import React from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  Users,
  Calendar,
  ClipboardList,
  ChevronRight,
  AlertCircle,
  QrCode,
  TrendingUp,
} from 'lucide-react';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';

// ============================================================================
// SKELETON COMPONENTS - Progressive Loading (Requirements: 3.1, 3.2, 3.3)
// ============================================================================

function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 bg-slate-50 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-20 bg-slate-200 rounded mb-2"></div>
          <div className="h-8 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-3 rounded-lg bg-slate-200 w-11 h-11"></div>
      </div>
    </div>
  );
}

function PatientCardSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
      </div>
    </div>
  );
}

function AppointmentCardSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-28 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-20 bg-slate-200 rounded"></div>
        </div>
        <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
      </div>
    </div>
  );
}

function QRCodeSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="h-5 w-24 bg-slate-200 rounded animate-pulse"></div>
        <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
      </div>
      <div className="p-4 flex flex-col items-center">
        <div className="w-32 h-32 bg-slate-200 rounded-lg animate-pulse"></div>
        <div className="h-3 w-36 bg-slate-200 rounded mt-2 animate-pulse"></div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'medical' | 'blue' | 'green' | 'yellow';
  trend?: string;
}

function StatsCard({ title, value, icon, color, trend }: StatsCardProps) {
  const colorClasses = {
    medical: 'bg-medical-50 text-medical-600 border-medical-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <p className="text-xs mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-white/50">{icon}</div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="p-8 text-center text-slate-400">
      <div className="mx-auto mb-3 opacity-30">{icon}</div>
      <p className="font-medium text-slate-600">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  );
}

// ============================================================================
// PATIENT CARD COMPONENT
// ============================================================================

interface PatientCardProps {
  connection: ConnectionSummary;
}

function PatientCard({ connection }: PatientCardProps) {
  const patient = connection.patient;
  const patientName = patient
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  const intakeStatus = connection.intakeStatus ?? { status: 'not_started', completeness: 0, sessionId: null };

  const statusColors = {
    not_started: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    ready: 'bg-green-100 text-green-700',
    reviewed: 'bg-blue-100 text-blue-700',
  };

  const statusLabels = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    ready: 'Ready for Review',
    reviewed: 'Reviewed',
  };

  const needsAttention = intakeStatus.status === 'ready';

  return (
    <div className={`p-4 hover:bg-slate-50 transition-colors ${needsAttention ? 'border-l-4 border-l-green-500' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
          {patient?.imageUrl ? (
            <img
              src={patient.imageUrl}
              alt={patientName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            patientName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 truncate">{patientName}</p>
            {needsAttention && (
              <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs rounded-full">New</span>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">
            {patient?.email || 'No email'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              statusColors[intakeStatus.status as keyof typeof statusColors] || statusColors.not_started
            }`}
          >
            {statusLabels[intakeStatus.status as keyof typeof statusLabels] || 'Not Started'}
          </span>
          {intakeStatus.status === 'in_progress' && (
            <span className="text-xs text-slate-400">{intakeStatus.completeness}%</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {intakeStatus.sessionId && (
          <Link
            href={`/doctor/patients/${connection.id}/intake`}
            className="flex-1 text-center py-2 px-3 bg-medical-50 text-medical-600 rounded-lg text-sm font-medium hover:bg-medical-100 transition-colors"
          >
            View Intake
          </Link>
        )}
        <Link
          href={`/doctor/messages?connection=${connection.id}`}
          className="py-2 px-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          Message
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// APPOINTMENT CARD COMPONENT
// ============================================================================

interface AppointmentCardProps {
  appointment: AppointmentSummary;
}

function AppointmentCard({ appointment }: AppointmentCardProps) {
  const patient = appointment.patient;
  const patientName = patient
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  const scheduledDate = new Date(appointment.scheduledAt);
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-slate-100 text-slate-600',
  };

  const isToday = scheduledDate.toDateString() === new Date().toDateString();

  return (
    <Link href={`/doctor/patients/${appointment.connectionId}/intake`} className="block p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl ${isToday ? 'bg-medical-100 text-medical-600' : 'bg-slate-100 text-slate-600'}`}>
          <span className="text-xs font-medium uppercase">
            {scheduledDate.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-xl font-bold">{scheduledDate.getDate()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 truncate">{patientName}</p>
          <p className="text-sm text-slate-500">
            {formattedTime} • {appointment.duration} min
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
            statusColors[appointment.status as keyof typeof statusColors] || statusColors.pending
          }`}
        >
          {appointment.status}
        </span>
      </div>
    </Link>
  );
}

// ============================================================================
// QR CODE QUICK ACCESS COMPONENT
// ============================================================================

function QRCodeQuickAccess() {
  const { data: qrData, isLoading } = api.doctor.getQRCode.useQuery();

  if (isLoading) {
    return <QRCodeSkeleton />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Your QR Code</h2>
        <Link
          href="/doctor/qr-code"
          className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
        >
          Manage <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="p-4 flex flex-col items-center">
        {qrData?.qrCodeUrl ? (
          <>
            <img
              src={qrData.qrCodeUrl}
              alt="Your QR Code"
              className="w-32 h-32 rounded-lg border border-slate-200"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Patients can scan to connect
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <QrCode className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No QR code generated</p>
            <Link
              href="/doctor/qr-code"
              className="text-sm text-medical-600 hover:text-medical-700 mt-2 inline-block"
            >
              Generate QR Code
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function DoctorOverviewPage() {
  // Fetch doctor profile (still needed for header info)
  const { data: doctorProfile, isLoading: profileLoading } = api.doctor.getMyProfile.useQuery();

  // Use consolidated dashboard query - fetches stats, connections, appointments in parallel
  // Requirements: 1.1, 3.1, 3.2, 3.3
  const { data: dashboardData, isLoading: dashboardLoading } = 
    api.dashboard.getDoctorDashboard.useQuery(undefined, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchIntervalInBackground: false,
    });

  // Extract data from consolidated response
  const stats = dashboardData?.stats;
  const connections = dashboardData?.connections ?? [];
  const appointments = dashboardData?.appointments ?? [];

  // Filter today's appointments from the already-fetched data
  const todayAppointments = appointments.filter(a => {
    const aptDate = new Date(a.scheduledAt);
    return aptDate.toDateString() === new Date().toDateString();
  });

  // Progressive loading: show stats skeletons first, then content
  // Requirements: 3.1, 3.2, 3.3, 3.4
  const isStatsLoading = dashboardLoading;
  const isListsLoading = dashboardLoading;

  return (
    <div className="space-y-6">
      {/* Page Header - Shows immediately with profile data */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {profileLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-48 bg-slate-200 rounded mb-2"></div>
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-800">
                Welcome, Dr. {doctorProfile?.user?.lastName || 'Doctor'}
              </h1>
              <p className="text-slate-500 mt-1">
                {doctorProfile?.specialty || 'General Practice'} • {doctorProfile?.clinicName || 'Your Clinic'}
              </p>
            </>
          )}
        </div>
        {!profileLoading && doctorProfile?.verificationStatus !== 'verified' && (
          <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg self-start sm:self-auto">
            <p className="text-sm text-yellow-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Verification pending
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards - Progressive loading with skeletons (Requirements: 3.1, 3.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isStatsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Total Patients"
              value={stats?.totalPatients ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="medical"
            />
            <StatsCard
              title="Today's Appointments"
              value={stats?.todayAppointments ?? 0}
              icon={<Calendar className="w-5 h-5" />}
              color="blue"
            />
            <StatsCard
              title="Pending Reviews"
              value={stats?.pendingReviews ?? 0}
              icon={<ClipboardList className="w-5 h-5" />}
              color="green"
            />
            <Link href="/doctor/analytics" className="block">
              <StatsCard
                title="View Analytics"
                value={stats?.newPatientsThisWeek ?? 0}
                icon={<TrendingUp className="w-5 h-5" />}
                color="yellow"
                trend={(stats?.newPatientsThisWeek ?? 0) > 0 ? `+${stats?.newPatientsThisWeek} new patients` : 'View insights'}
              />
            </Link>
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Queue - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Patient Queue</h2>
              <p className="text-sm text-slate-500">
                {isListsLoading ? (
                  <span className="inline-block h-4 w-32 bg-slate-200 rounded animate-pulse"></span>
                ) : (
                  (stats?.pendingReviews ?? 0) > 0 
                    ? `${stats?.pendingReviews} patient${(stats?.pendingReviews ?? 0) > 1 ? 's' : ''} ready for review` 
                    : 'All caught up!'
                )}
              </p>
            </div>
            <Link 
              href="/doctor/patients" 
              className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {isListsLoading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4].map(i => (
                <PatientCardSkeleton key={i} />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="No patients yet"
              description="Share your QR code to start connecting with patients"
            />
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {connections.slice(0, 6).map((connection) => (
                <PatientCard
                  key={connection.id}
                  connection={connection}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* QR Code Quick Access */}
          <QRCodeQuickAccess />

          {/* Today's Schedule */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Today&apos;s Schedule</h2>
              <Link 
                href="/doctor/appointments" 
                className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            {isListsLoading ? (
              <div className="divide-y divide-slate-100">
                {[1, 2].map(i => (
                  <AppointmentCardSkeleton key={i} />
                ))}
              </div>
            ) : todayAppointments.length === 0 ? (
              <EmptyState
                icon={<Calendar className="w-12 h-12" />}
                title="No appointments today"
                description="Your schedule is clear"
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {todayAppointments.slice(0, 4).map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Appointments Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Upcoming Appointments</h2>
          <Link 
            href="/doctor/appointments" 
            className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        {isListsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {[1, 2, 3].map(i => (
              <AppointmentCardSkeleton key={i} />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-12 h-12" />}
            title="No upcoming appointments"
            description="Appointments will appear here when patients book"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {appointments.slice(0, 3).map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
