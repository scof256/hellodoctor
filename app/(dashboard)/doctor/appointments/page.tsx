'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import type { SBAR } from '@/types';
import ReactMarkdown from 'react-markdown';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter,
  MessageSquare,
  ClipboardList,
  User,
  History,
  Check,
  Video,
  Send,
  Mic,
} from 'lucide-react';

type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

const statusConfig: Record<AppointmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { 
    label: 'Pending', 
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Clock className="w-4 h-4" />,
  },
  confirmed: { 
    label: 'Confirmed', 
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-blue-100 text-blue-700',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="w-4 h-4" />,
  },
  no_show: { 
    label: 'No Show', 
    color: 'bg-slate-100 text-slate-600',
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

interface Appointment {
  id: string;
  scheduledAt: Date;
  duration: number;
  status: AppointmentStatus;
  notes: string | null;
  connectionId: string;
  intakeSessionId: string | null;
  isOnline: boolean;
  zoomJoinUrl: string | null;
  streamCallId: string | null;
  streamJoinUrl: string | null;
  scribeIsActive: boolean;
  patient?: {
    id: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    } | null;
  } | null;
}

function SBARCard({ title, icon, content, colorTheme }: { title: string; icon: React.ReactNode; content: string; colorTheme: 'blue' | 'slate' | 'amber' | 'emerald' }) {
  const styles = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      headerText: 'text-blue-800',
      headerBg: 'bg-blue-100',
      bodyText: 'text-blue-900',
      prose: 'prose-headings:text-blue-800 prose-strong:text-blue-900'
    },
    slate: {
      border: 'border-slate-200',
      bg: 'bg-slate-50',
      headerText: 'text-slate-700',
      headerBg: 'bg-slate-200',
      bodyText: 'text-slate-800',
      prose: 'prose-headings:text-slate-700 prose-strong:text-slate-900'
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      headerText: 'text-amber-800',
      headerBg: 'bg-amber-100',
      bodyText: 'text-amber-900',
      prose: 'prose-headings:text-amber-800 prose-strong:text-amber-900'
    },
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      headerText: 'text-emerald-800',
      headerBg: 'bg-emerald-100',
      bodyText: 'text-emerald-900',
      prose: 'prose-headings:text-emerald-800 prose-strong:text-emerald-900'
    }
  };

  const currentStyle = styles[colorTheme];

  return (
    <div className={`border ${currentStyle.border} rounded-xl overflow-hidden shadow-sm`}>
      <div className={`${currentStyle.headerBg} p-3 flex items-center gap-2 border-b ${currentStyle.border}`}>
        {icon}
        <h4 className={`text-xs font-bold uppercase tracking-widest ${currentStyle.headerText}`}>
          {title}
        </h4>
      </div>
      <div className={`${currentStyle.bg} p-4 text-sm leading-relaxed ${currentStyle.bodyText}`}>
        <div className={`prose prose-sm max-w-none ${currentStyle.prose} prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-headings:uppercase`}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ 
  appointment, 
  clinicalHandover,
  onConfirm, 
  onCancel,
  onComplete,
  onMarkNoShow,
  onStartZoom,
  onSendZoomInvite,
  onActivateScribe,
  onDeactivateScribe,
  isUpdating,
}: { 
  appointment: Appointment;
  clinicalHandover?: SBAR | null;
  onConfirm: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onMarkNoShow: () => void;
  onStartZoom: () => void;
  onSendZoomInvite: (appointment: Appointment) => void;
  onActivateScribe: () => void;
  onDeactivateScribe: () => void;
  isUpdating: boolean;
}) {
  const patient = appointment.patient;
  const patientName = patient?.user
    ? `${patient.user.firstName || ''} ${patient.user.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  const scheduledDate = new Date(appointment.scheduledAt);
  const config = statusConfig[appointment.status];
  const isPast = scheduledDate < new Date();
  const isToday = scheduledDate.toDateString() === new Date().toDateString();
  const canJoinMeeting =
    appointment.status !== 'cancelled' &&
    (appointment.status === 'pending' || appointment.status === 'confirmed' || appointment.scribeIsActive) &&
    appointment.isOnline &&
    (appointment.streamCallId || appointment.zoomJoinUrl);
  const canUseScribe = appointment.status !== 'cancelled';

  return (
    <div className={`bg-white rounded-xl border ${isToday ? 'border-medical-200 shadow-sm' : 'border-slate-200'} overflow-hidden`}>
      <div className={`px-4 py-3 border-b ${isToday ? 'bg-medical-50 border-medical-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${isToday ? 'text-medical-600' : 'text-slate-500'}`} />
            <span className={`font-medium ${isToday ? 'text-medical-700' : 'text-slate-700'}`}>
              {scheduledDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {isToday && <span className="ml-2 text-xs bg-medical-600 text-white px-2 py-0.5 rounded-full">Today</span>}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
            {config.icon}
            {config.label}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
            {patient?.user?.imageUrl ? (
              <img
                src={patient.user.imageUrl}
                alt={patientName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              patientName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="font-medium text-slate-800">{patientName}</p>
            <p className="text-sm text-slate-500">
              {scheduledDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })} • {appointment.duration} min
            </p>
          </div>
        </div>

        {appointment.notes && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2 mb-3">
            {appointment.notes}
          </p>
        )}

        {/* Linked Intake Session Indicator (Requirements 3.1, 3.2) */}
        {appointment.intakeSessionId && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 border border-green-100 rounded-lg">
            <ClipboardList className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">Intake session linked</span>
            <Link
              href={`/doctor/patients/${appointment.connectionId}/intake`}
              className="ml-auto text-xs text-green-600 hover:text-green-700 underline"
            >
              View intake data
            </Link>
          </div>
        )}

        {appointment.intakeSessionId && (
          <div className="mb-3">
            {!clinicalHandover ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-slate-800">SBAR Report</p>
                <p className="text-sm text-slate-600 mt-1">SBAR not available yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-800">SBAR Report</p>
                <SBARCard title="Situation" icon={<User className="w-4 h-4" />} content={clinicalHandover.situation} colorTheme="blue" />
                <SBARCard title="Background" icon={<History className="w-4 h-4" />} content={clinicalHandover.background} colorTheme="slate" />
                <SBARCard title="Assessment" icon={<AlertCircle className="w-4 h-4" />} content={clinicalHandover.assessment} colorTheme="amber" />
                <SBARCard title="Recommendation" icon={<Check className="w-4 h-4" />} content={clinicalHandover.recommendation} colorTheme="emerald" />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Quick Actions */}
          {canUseScribe && (
            <Link
              href={`/doctor/scribe?appointmentId=${appointment.id}`}
              className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center flex items-center justify-center gap-1 ${
                appointment.scribeIsActive
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Mic className="w-4 h-4" />
              Scribe
            </Link>
          )}

          {canUseScribe && !appointment.scribeIsActive && (
            <button
              onClick={onActivateScribe}
              disabled={isUpdating}
              className="py-2 px-3 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50"
            >
              Activate
            </button>
          )}

          {canUseScribe && appointment.scribeIsActive && (
            <button
              onClick={onDeactivateScribe}
              disabled={isUpdating}
              className="py-2 px-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Deactivate
            </button>
          )}

          <Link
            href={`/doctor/patients/${appointment.connectionId}/intake`}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-sm font-medium transition-colors text-center flex items-center justify-center gap-1 ${
              appointment.intakeSessionId 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-medical-50 text-medical-600 hover:bg-medical-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            {appointment.intakeSessionId ? 'View Intake' : 'Intake'}
          </Link>
          <Link
            href={`/doctor/messages?connection=${appointment.connectionId}`}
            className="py-2 px-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-1"
          >
            <MessageSquare className="w-4 h-4" />
          </Link>

          {canJoinMeeting && (
            <button
              onClick={onStartZoom}
              disabled={isUpdating}
              className="py-2 px-3 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Video className="w-4 h-4" />
              {isUpdating ? 'Starting...' : 'Join Meeting'}
            </button>
          )}

          {canJoinMeeting && (
            <button
              onClick={() => onSendZoomInvite(appointment)}
              disabled={isUpdating}
              className="py-2 px-3 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
              {isUpdating ? 'Sending...' : 'Send Meeting Link'}
            </button>
          )}

          {/* Status Actions */}
          {appointment.status === 'pending' && (
            <button
              onClick={onConfirm}
              disabled={isUpdating}
              className="py-2 px-3 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              {isUpdating ? 'Confirming...' : 'Confirm'}
            </button>
          )}
          {(appointment.status === 'pending' || appointment.status === 'confirmed') && !isPast && (
            <button
              onClick={onCancel}
              disabled={isUpdating}
              className="py-2 px-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {appointment.status === 'confirmed' && isPast && (
            <>
              <button
                onClick={onComplete}
                disabled={isUpdating}
                className="py-2 px-3 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Completing...' : 'Complete'}
              </button>
              <button
                onClick={onMarkNoShow}
                disabled={isUpdating}
                className="py-2 px-3 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'No Show'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DoctorAppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'upcoming' | 'past'>('upcoming');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Fetch appointments - poll every 30 seconds for new bookings
  const { data: appointmentsData, isLoading } = api.appointment.getMyAppointments.useQuery({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 100,
  }, {
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: intakeSessionsData } = api.intake.getDoctorIntakeSessions.useQuery({
    status: 'all',
    limit: 100,
  });

  // Cancel mutation
  const cancelAppointment = api.appointment.cancel.useMutation({
    onMutate: (vars) => setUpdatingId(vars.appointmentId),
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  // Confirm mutation (Requirement 3.3)
  const confirmAppointment = api.appointment.confirm.useMutation({
    onMutate: (vars) => setUpdatingId(vars.appointmentId),
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  // Complete mutation (Requirement 3.4)
  const completeAppointment = api.appointment.complete.useMutation({
    onMutate: (vars) => setUpdatingId(vars.appointmentId),
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  // Mark No Show mutation (Requirement 3.4)
  const markNoShowAppointment = api.appointment.markNoShow.useMutation({
    onMutate: (vars) => setUpdatingId(vars.appointmentId),
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  // Send message mutation for meeting link sharing
  const sendMessage = api.message.send.useMutation({
    onSuccess: () => {
      setUpdatingId(null);
    },
    onError: (error) => {
      console.error('Failed to send meeting link:', error);
      setUpdatingId(null);
    },
  });

  // Start meeting - simply navigate to the meeting page (Stream meeting is created on-demand)
  const handleStartMeeting = (appointmentId: string) => {
    setUpdatingId(appointmentId);
    window.location.assign(`/meeting/${appointmentId}`);
  };

  // Send meeting invite - copy link to clipboard and send message to patient
  const handleSendMeetingInvite = async (appointment: Appointment) => {
    const meetingUrl = `${window.location.origin}/meeting/${appointment.id}`;
    
    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(meetingUrl);
      
      // Send message to patient with the meeting link
      const patientName = appointment.patient?.user
        ? `${appointment.patient.user.firstName || ''} ${appointment.patient.user.lastName || ''}`.trim() || 'Patient'
        : 'Patient';
      
      const scheduledDate = new Date(appointment.scheduledAt);
      const formattedDate = scheduledDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      
      const messageContent = `Your video appointment is ready! Join the meeting at ${formattedDate}, ${formattedTime}.\n\nMeeting link: ${meetingUrl}\n\nClick the link above or use the "Join Meeting" button in your appointments page.`;
      
      setUpdatingId(appointment.id);
      await sendMessage.mutateAsync({
        connectionId: appointment.connectionId,
        content: messageContent,
      });
      
      alert(`Meeting link copied to clipboard and sent to ${patientName}!`);
    } catch (error) {
      console.error('Failed to send meeting link:', error);
      // Still try to copy to clipboard even if message fails
      try {
        await navigator.clipboard.writeText(meetingUrl);
        alert('Meeting link copied to clipboard! (Message could not be sent)');
      } catch {
        alert('Failed to copy meeting link. Please copy manually: ' + meetingUrl);
      }
      setUpdatingId(null);
    }
  };

  const activateScribe = api.appointment.activateScribe.useMutation({
    onMutate: (vars) => setUpdatingId(vars.appointmentId),
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  const deactivateScribe = api.appointment.deactivateScribe.useMutation({
    onMutate: (vars) => setUpdatingId(vars.appointmentId),
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  const allAppointments = (appointmentsData?.appointments ?? []) as Appointment[];
  const intakeSessions = intakeSessionsData?.sessions ?? [];
  const intakeSessionMap = new Map<string, { clinicalHandover: SBAR | null }>();
  for (const s of intakeSessions) {
    if (s?.id) {
      intakeSessionMap.set(s.id, { clinicalHandover: (s as { clinicalHandover: SBAR | null }).clinicalHandover ?? null });
    }
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const appointments = allAppointments.filter((apt) => {
    const scheduledDate = new Date(apt.scheduledAt);
    const isArchivedStatus = apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show';

    if (viewMode === 'upcoming') {
      return scheduledDate >= startOfToday && !isArchivedStatus;
    }

    return scheduledDate < startOfToday || isArchivedStatus;
  });


  // Group appointments by date
  const groupedAppointments = appointments.reduce((groups, apt) => {
    const date = new Date(apt.scheduledAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(apt);
    return groups;
  }, {} as Record<string, Appointment[]>);

  // Sort dates
  const sortedDates = Object.keys(groupedAppointments).sort((a, b) => {
    const dateA = new Date(a).getTime();
    const dateB = new Date(b).getTime();
    return viewMode === 'upcoming' ? dateA - dateB : dateB - dateA;
  });

  // Stats
  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    today: appointments.filter(a => new Date(a.scheduledAt).toDateString() === new Date().toDateString()).length,
  };

  // Handler functions wired to actual mutations
  const handleConfirm = (appointmentId: string) => {
    confirmAppointment.mutate({ appointmentId });
  };

  const handleCancel = (appointmentId: string) => {
    if (confirm('Are you sure you want to cancel this appointment?')) {
      cancelAppointment.mutate({ appointmentId });
    }
  };

  const handleComplete = (appointmentId: string) => {
    completeAppointment.mutate({ appointmentId });
  };

  const handleMarkNoShow = (appointmentId: string) => {
    if (confirm('Are you sure you want to mark this patient as no-show?')) {
      markNoShowAppointment.mutate({ appointmentId });
    }
  };

  // Renamed from handleStartZoom to use Stream
  const handleStartZoom = (appointmentId: string) => {
    handleStartMeeting(appointmentId);
  };

  // Renamed from handleSendZoomInvite to use Stream
  const handleSendZoomInvite = (appointment: Appointment) => {
    handleSendMeetingInvite(appointment);
  };

  const handleActivateScribe = (appointmentId: string) => {
    activateScribe.mutate({ appointmentId });
  };

  const handleDeactivateScribe = (appointmentId: string) => {
    deactivateScribe.mutate({ appointmentId });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointments</h1>
          <p className="text-slate-500 mt-1">
            {stats.today > 0 && <span className="text-medical-600 font-medium">{stats.today} today • </span>}
            {stats.pending > 0 && <span className="text-yellow-600">{stats.pending} pending • </span>}
            {stats.total} total
          </p>
        </div>
        <Link
          href="/doctor/availability"
          className="px-4 py-2.5 bg-medical-600 text-white rounded-xl font-medium hover:bg-medical-700 transition-colors flex items-center gap-2"
        >
          <Clock className="w-5 h-5" />
          Manage Availability
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('upcoming')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setViewMode('past')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'past' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Past
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent bg-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-medical-50 rounded-xl border border-medical-100 p-4">
          <p className="text-sm text-medical-600">Today</p>
          <p className="text-2xl font-bold text-medical-700 mt-1">{stats.today}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4">
          <p className="text-sm text-yellow-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <p className="text-sm text-green-600">Confirmed</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.confirmed}</p>
        </div>
      </div>


      {/* Appointments List */}
      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="font-medium text-slate-600 mb-1">No appointments</h3>
          <p className="text-sm text-slate-400">
            {viewMode === 'upcoming' 
              ? 'No upcoming appointments scheduled'
              : 'No past appointments found'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const date = new Date(dateStr);
            const isToday = date.toDateString() === new Date().toDateString();
            const dayAppointments = groupedAppointments[dateStr] ?? [];

            return (
              <div key={dateStr}>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isToday ? 'text-medical-700' : 'text-slate-700'}`}>
                  <Calendar className="w-5 h-5" />
                  {date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {isToday && <span className="text-xs bg-medical-600 text-white px-2 py-0.5 rounded-full">Today</span>}
                </h3>
                <div className="space-y-4">
                  {dayAppointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      clinicalHandover={apt.intakeSessionId ? (intakeSessionMap.get(apt.intakeSessionId)?.clinicalHandover ?? null) : null}
                      onConfirm={() => handleConfirm(apt.id)}
                      onCancel={() => handleCancel(apt.id)}
                      onComplete={() => handleComplete(apt.id)}
                      onMarkNoShow={() => handleMarkNoShow(apt.id)}
                      onStartZoom={() => handleStartZoom(apt.id)}
                      onSendZoomInvite={handleSendZoomInvite}
                      onActivateScribe={() => handleActivateScribe(apt.id)}
                      onDeactivateScribe={() => handleDeactivateScribe(apt.id)}
                      isUpdating={updatingId === apt.id}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
