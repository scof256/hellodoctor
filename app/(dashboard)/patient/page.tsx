'use client';

import React from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  Calendar,
  ClipboardList,
  MessageSquare,
  ChevronRight,
  Clock,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react';
import type { ConnectionSummary, AppointmentSummary } from '@/types/dashboard';
import { useMode } from '../../contexts/ModeContext';
import { SimplifiedPatientHome } from '../../components/SimplifiedPatientHome';
import { ActionCardSkeleton } from '../../components/SkeletonComponents';

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

function DoctorCardSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
          <div className="h-3 w-24 bg-slate-200 rounded"></div>
        </div>
        <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 h-9 bg-slate-200 rounded-lg"></div>
        <div className="w-10 h-9 bg-slate-200 rounded-lg"></div>
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

function IntakeProgressCardSkeleton() {
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-slate-200"></div>
        <div className="flex-1">
          <div className="h-4 w-24 bg-slate-200 rounded mb-1"></div>
          <div className="h-3 w-16 bg-slate-200 rounded"></div>
        </div>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="h-3 w-12 bg-slate-200 rounded"></div>
          <div className="h-3 w-8 bg-slate-200 rounded"></div>
        </div>
        <div className="h-2 bg-slate-200 rounded-full"></div>
      </div>
      <div className="h-9 bg-slate-200 rounded-lg"></div>
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
  color: 'medical' | 'blue' | 'green';
}

function StatsCard({ title, value, icon, color }: StatsCardProps) {
  const colorClasses = {
    medical: 'bg-medical-50 text-medical-600 border-medical-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
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
// DOCTOR CARD COMPONENT
// ============================================================================

interface DoctorCardProps {
  connection: ConnectionSummary;
}

function DoctorCard({ connection }: DoctorCardProps) {
  const doctor = connection.doctor;
  const doctorName = doctor
    ? `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim()
    : 'Unknown Doctor';

  const intakeStatus = connection.intakeStatus ?? { status: 'not_started' as const, completeness: 0, sessionId: null };

  const statusColors = {
    not_started: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-yellow-100 text-yellow-700',
    ready: 'bg-green-100 text-green-700',
    reviewed: 'bg-blue-100 text-blue-700',
  };

  const statusLabels = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    ready: 'Ready',
    reviewed: 'Reviewed',
  };

  return (
    <div className="p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 font-bold">
          {doctor?.imageUrl ? (
            <img
              src={doctor.imageUrl}
              alt={doctorName}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            doctorName.charAt(4) || 'D'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 truncate">{doctorName}</p>
          <p className="text-sm text-slate-500 truncate">
            {doctor?.specialty || 'General Practice'} • {doctor?.clinicName || 'Clinic'}
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
            <span className="text-xs text-slate-400">{intakeStatus.completeness}% complete</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/patient/intake/${connection.id}`}
          className="flex-1 text-center py-2 px-3 bg-medical-50 text-medical-600 rounded-lg text-sm font-medium hover:bg-medical-100 transition-colors"
        >
          {intakeStatus.status === 'not_started' ? 'Start Intake' : 'Continue Intake'}
        </Link>
        <Link
          href={`/patient/messages?connection=${connection.id}`}
          className="py-2 px-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
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
  const doctor = appointment.doctor;
  const doctorName = doctor
    ? `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim()
    : 'Unknown Doctor';

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

  return (
    <div className="p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center justify-center w-14 h-14 bg-medical-50 rounded-xl text-medical-600">
          <span className="text-xs font-medium uppercase">
            {scheduledDate.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-xl font-bold">{scheduledDate.getDate()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 truncate">{doctorName}</p>
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
    </div>
  );
}

// ============================================================================
// INTAKE PROGRESS CARD COMPONENT
// ============================================================================

interface IntakeProgressCardProps {
  connection: ConnectionSummary;
}

function IntakeProgressCard({ connection }: IntakeProgressCardProps) {
  const doctor = connection.doctor;
  const doctorName = doctor
    ? `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim()
    : 'Unknown Doctor';

  const intakeStatus = connection.intakeStatus ?? { status: 'not_started' as const, completeness: 0, sessionId: null };

  const statusConfig = {
    not_started: { label: 'Not Started', icon: <ClipboardList className="w-4 h-4" /> },
    in_progress: { label: 'In Progress', icon: <Clock className="w-4 h-4" /> },
    ready: { label: 'Complete', icon: <CheckCircle2 className="w-4 h-4" /> },
    reviewed: { label: 'Reviewed', icon: <CheckCircle2 className="w-4 h-4" /> },
  };

  const config = statusConfig[intakeStatus.status as keyof typeof statusConfig] || statusConfig.not_started;

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 text-sm font-bold">
          {doctor?.imageUrl ? (
            <img
              src={doctor.imageUrl}
              alt={doctorName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            doctorName.charAt(4) || 'D'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm truncate">{doctorName}</p>
          <p className="text-xs text-slate-500 truncate">{doctor?.specialty || 'General'}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Progress</span>
          <span className="font-medium text-slate-700">{intakeStatus.completeness}%</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              intakeStatus.status === 'ready' || intakeStatus.status === 'reviewed'
                ? 'bg-green-500'
                : 'bg-medical-500'
            }`}
            style={{ width: `${intakeStatus.completeness}%` }}
          />
        </div>
      </div>

      <Link
        href={`/patient/intake/${connection.id}`}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
          intakeStatus.status === 'not_started'
            ? 'bg-medical-600 text-white hover:bg-medical-700'
            : intakeStatus.status === 'in_progress'
            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        {config.icon}
        {intakeStatus.status === 'not_started'
          ? 'Start Intake'
          : intakeStatus.status === 'in_progress'
          ? 'Continue'
          : 'View Details'}
      </Link>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function PatientOverviewPage() {
  const { mode } = useMode();
  const [mounted, setMounted] = React.useState(false);
  
  // Use consolidated dashboard query - fetches stats, connections, appointments in parallel
  // Requirements: 1.2, 3.1, 3.2, 3.3
  const { data: dashboardData, isLoading: dashboardLoading } = 
    api.dashboard.getPatientDashboard.useQuery(undefined, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchIntervalInBackground: false,
    });

  // Extract data from consolidated response
  const stats = dashboardData?.stats;
  const connections = dashboardData?.connections ?? [];
  const appointments = dashboardData?.appointments ?? [];

  // Progressive loading: show stats skeletons first, then content
  // Requirements: 3.1, 3.2, 3.3, 3.4
  const isStatsLoading = dashboardLoading;
  const isListsLoading = dashboardLoading;

  // Prevent hydration mismatch - wait for client-side mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state until mounted to prevent hydration mismatch
  if (!mounted || dashboardLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-6 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-4 mt-6">
          <ActionCardSkeleton />
          <ActionCardSkeleton />
          <ActionCardSkeleton />
        </div>
      </div>
    );
  }

  // Render SimplifiedPatientHome in Simple Mode
  if (mode === 'simple') {
    return (
      <SimplifiedPatientHome
        connections={connections}
        appointments={appointments}
      />
    );
  }

  // Advanced Mode - Original Dashboard
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 mt-1">Manage your healthcare connections and appointments</p>
        </div>
      </div>

      {/* Stats Cards - Progressive loading with skeletons (Requirements: 3.1, 3.2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isStatsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Connected Doctors"
              value={stats?.connectedDoctors ?? 0}
              icon={<Stethoscope className="w-5 h-5" />}
              color="medical"
            />
            <StatsCard
              title="Upcoming Appointments"
              value={stats?.upcomingAppointments ?? 0}
              icon={<Calendar className="w-5 h-5" />}
              color="blue"
            />
            <StatsCard
              title="Completed Intakes"
              value={stats?.completedIntakes ?? 0}
              icon={<ClipboardList className="w-5 h-5" />}
              color="green"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Doctors Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">My Doctors</h2>
            {!isListsLoading && connections.length > 4 && (
              <span className="text-sm text-slate-500">
                {connections.length} connected
              </span>
            )}
          </div>
          
          {isListsLoading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4].map(i => (
                <DoctorCardSkeleton key={i} />
              ))}
            </div>
          ) : connections.length === 0 ? (
            <EmptyState
              icon={<Stethoscope className="w-12 h-12" />}
              title="No doctors connected"
              description="Scan a doctor's QR code or use their share link to connect"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {connections.slice(0, 4).map((connection) => (
                <DoctorCard
                  key={connection.id}
                  connection={connection}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments Section */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Upcoming Appointments</h2>
            <Link 
              href="/patient/appointments" 
              className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {isListsLoading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4].map(i => (
                <AppointmentCardSkeleton key={i} />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-12 h-12" />}
              title="No upcoming appointments"
              description="Complete an intake to book your first appointment"
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {appointments.slice(0, 4).map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Intake Progress Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Intake Progress</h2>
          <Link 
            href="/patient/sessions" 
            className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
          >
            Manage Sessions <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        
        {isListsLoading ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <IntakeProgressCardSkeleton key={i} />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-12 h-12" />}
            title="No intake sessions"
            description="Connect with a doctor to start your medical intake"
          />
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((connection) => (
              <IntakeProgressCard
                key={connection.id}
                connection={connection}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
