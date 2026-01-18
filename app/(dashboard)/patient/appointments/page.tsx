'use client';
import React, { useState } from 'react';
import { api } from '@/trpc/react';
import { Calendar, Clock, User, MapPin, X, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { AppointmentCardSkeleton } from '@/app/components/SkeletonComponents';

type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  connectionId: string;
  scheduledAt: Date;
  duration: number;
  status: AppointmentStatus;
  notes: string | null;
  isOnline: boolean;
  zoomJoinUrl: string | null;
  streamCallId: string | null;
  streamJoinUrl: string | null;
  doctor: { id: string; specialty: string | null; clinicName: string | null; user: { firstName: string | null; lastName: string | null; imageUrl: string | null; } | null; } | null;
}

export default function PatientAppointmentsPage() {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newDateTime, setNewDateTime] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading, refetch } = api.appointment.getMyAppointments.useQuery({
    limit: 100,
  });
  const cancelMutation = api.appointment.cancel.useMutation({ onSuccess: () => { setCancellingId(null); setCancelReason(''); refetch(); } });
  const rescheduleMutation = api.appointment.reschedule.useMutation({ onSuccess: () => { setReschedulingId(null); setNewDateTime(''); refetch(); } });

  const appointments = (data?.appointments ?? []) as Appointment[];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const filteredAppointments = appointments.filter((apt) => {
    const scheduledDate = new Date(apt.scheduledAt);
    const isArchivedStatus = apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show';

    if (filter === 'upcoming') {
      return scheduledDate >= startOfToday && !isArchivedStatus;
    }

    if (filter === 'past') {
      return scheduledDate < startOfToday || isArchivedStatus;
    }

    return true;
  });

  const getStatusBadge = (status: AppointmentStatus) => {
    const styles: Record<AppointmentStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      confirmed: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      completed: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <CheckCircle className="w-3 h-3" /> },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="w-3 h-3" /> },
      no_show: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <AlertCircle className="w-3 h-3" /> },
    };
    const style = styles[status];
    return (<span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>{style.icon}{status.replace('_', ' ')}</span>);
  };

  const formatDate = (date: Date) => new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (date: Date) => new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const getDoctorName = (doctor: Appointment['doctor']) => { if (!doctor?.user) return 'Unknown Doctor'; return `Dr. ${doctor.user.firstName || ''} ${doctor.user.lastName || ''}`.trim() || 'Unknown Doctor'; };
  const canCancel = (apt: Appointment) => ['pending', 'confirmed'].includes(apt.status) && new Date(apt.scheduledAt) > new Date();

  const canJoinMeeting = (apt: Appointment) => {
    if (!apt.isOnline) return false;
    // Check for Stream meeting (preferred) or Zoom meeting (legacy)
    if (!apt.streamCallId && !apt.zoomJoinUrl) return false;
    if (!['pending', 'confirmed'].includes(apt.status)) return false;
    return true;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <AppointmentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">My Appointments</h1><p className="text-gray-600 mt-1">View and manage your scheduled appointments</p></div>
      <div className="flex flex-wrap gap-2 mb-6">
        {(['upcoming', 'past', 'all'] as const).map((f) => (<button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${filter === f ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>))}
      </div>
      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg"><Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900">No appointments found</h3></div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((apt: Appointment) => (
            <div key={apt.id} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                <div className="flex gap-3 sm:gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center"><User className="w-6 h-6 text-teal-600" /></div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{getDoctorName(apt.doctor)}</h3>
                    {apt.doctor?.specialty && <p className="text-sm text-gray-600">{apt.doctor.specialty}</p>}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-sm text-gray-600"><span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatDate(apt.scheduledAt)}</span><span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatTime(apt.scheduledAt)}</span></div>
                    {apt.doctor?.clinicName && <p className="flex items-center gap-1 mt-1 text-sm text-gray-500"><MapPin className="w-4 h-4" />{apt.doctor.clinicName}</p>}
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-2">
                  {getStatusBadge(apt.status)}
                  {canJoinMeeting(apt) && cancellingId !== apt.id && reschedulingId !== apt.id && (
                    <button
                      onClick={() => {
                        window.location.assign(`/meeting/${apt.id}`);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg"
                    >
                      Join Meeting
                    </button>
                  )}
                  {canCancel(apt) && cancellingId !== apt.id && reschedulingId !== apt.id && (
                    <div className="flex flex-wrap gap-2 mt-2 sm:justify-end">
                      <button onClick={() => setReschedulingId(apt.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm text-teal-600 hover:bg-teal-50 rounded-lg"><RefreshCw className="w-4 h-4" />Reschedule</button>
                      <button onClick={() => setCancellingId(apt.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 rounded-lg"><X className="w-4 h-4" />Cancel</button>
                    </div>
                  )}
                </div>
              </div>
              {cancellingId === apt.id && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-800 mb-3">Cancel this appointment?</p>
                  <input type="text" placeholder="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
                  <div className="flex flex-col sm:flex-row gap-2"><button onClick={() => cancelMutation.mutate({ appointmentId: apt.id, reason: cancelReason || undefined })} disabled={cancelMutation.isPending} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg disabled:opacity-50">{cancelMutation.isPending ? 'Cancelling...' : 'Confirm'}</button><button onClick={() => { setCancellingId(null); setCancelReason(''); }} className="px-4 py-2 bg-gray-200 text-sm rounded-lg">Keep</button></div>
                </div>
              )}
              {reschedulingId === apt.id && (
                <div className="mt-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <p className="text-sm text-teal-800 mb-3">Select new date/time:</p>
                  <input type="datetime-local" value={newDateTime} onChange={(e) => setNewDateTime(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm mb-3" />
                  <div className="flex flex-col sm:flex-row gap-2"><button onClick={() => { if (newDateTime) rescheduleMutation.mutate({ appointmentId: apt.id, newScheduledAt: new Date(newDateTime).toISOString() }); }} disabled={rescheduleMutation.isPending || !newDateTime} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{rescheduleMutation.isPending ? 'Rescheduling...' : 'Confirm'}</button><button onClick={() => { setReschedulingId(null); setNewDateTime(''); }} className="px-4 py-2 bg-gray-200 text-sm rounded-lg">Cancel</button></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
