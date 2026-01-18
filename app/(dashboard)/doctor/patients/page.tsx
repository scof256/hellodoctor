'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  Users,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ClipboardList,
  Calendar,
  Eye,
  X,
} from 'lucide-react';
import { PatientCardSkeleton } from '@/app/components/SkeletonComponents';

type IntakeStatus = 'not_started' | 'in_progress' | 'ready' | 'reviewed' | 'all';

interface PatientWithIntake {
  connection: {
    id: string;
    connectedAt: Date;
    patient?: {
      id: string;
      user: {
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
        email: string | null;
      } | null;
    } | null;
  };
  intakeStatus: {
    status: string;
    completeness: number;
    sessionId?: string;
    chiefComplaint?: string | null;
    updatedAt?: Date;
  };
}

const statusConfig = {
  not_started: { 
    label: 'Not Started', 
    color: 'bg-slate-100 text-slate-600',
    icon: <Clock className="w-4 h-4" />,
  },
  in_progress: { 
    label: 'In Progress', 
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Clock className="w-4 h-4" />,
  },
  ready: { 
    label: 'Ready for Review', 
    color: 'bg-green-100 text-green-700',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  reviewed: { 
    label: 'Reviewed', 
    color: 'bg-blue-100 text-blue-700',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
};


function PatientRow({
  patient,
  onSchedule,
}: {
  patient: PatientWithIntake;
  onSchedule: (connectionId: string) => void;
}) {
  const { connection, intakeStatus } = patient;
  const patientUser = connection.patient?.user;
  const patientName = patientUser
    ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  const config = statusConfig[intakeStatus.status as keyof typeof statusConfig] || statusConfig.not_started;
  const needsAttention = intakeStatus.status === 'ready';

  return (
    <tr className={`hover:bg-slate-50 transition-colors ${needsAttention ? 'bg-green-50/30' : ''}`}>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm flex-shrink-0">
            {patientUser?.imageUrl ? (
              <img
                src={patientUser.imageUrl}
                alt={patientName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              patientName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-800 truncate">{patientName}</p>
              {needsAttention && (
                <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs rounded-full flex-shrink-0">
                  New
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 truncate">{patientUser?.email || 'No email'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
          {config.icon}
          {config.label}
        </span>
        {intakeStatus.status === 'in_progress' && (
          <p className="text-xs text-slate-400 mt-1">{intakeStatus.completeness}% complete</p>
        )}
      </td>
      <td className="px-4 py-4">
        <p className="text-sm text-slate-600 truncate max-w-xs">
          {intakeStatus.chiefComplaint || '-'}
        </p>
      </td>
      <td className="px-4 py-4 text-sm text-slate-500">
        {new Date(connection.connectedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {intakeStatus.sessionId && (
            <Link
              href={`/doctor/patients/${connection.id}/intake`}
              className="p-2 rounded-lg bg-medical-50 text-medical-600 hover:bg-medical-100 transition-colors"
              title="View Intake"
            >
              <Eye className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={() => onSchedule(connection.id)}
            className="p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            title="Schedule Appointment"
            type="button"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <Link
            href={`/doctor/messages?connection=${connection.id}`}
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Message Patient"
          >
            <MessageSquare className="w-4 h-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}


export default function DoctorPatientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntakeStatus>('all');
  const [scheduleConnectionId, setScheduleConnectionId] = useState<string | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [scheduleIsOnline, setScheduleIsOnline] = useState(false);
  const [scheduleSendMessage, setScheduleSendMessage] = useState(true);
  const [scheduleNotes, setScheduleNotes] = useState('');

  const utils = api.useUtils();

  // Fetch connections (patients)
  const { data: connectionsData, isLoading: connectionsLoading } = 
    api.connection.getMyConnections.useQuery({ status: 'active' });

  // Fetch intake sessions - poll every 30 seconds for status updates
  const { data: intakeData, isLoading: intakeLoading } = 
    api.intake.getDoctorIntakeSessions.useQuery(
      { status: 'all' },
      {
        refetchInterval: 30000, // Poll every 30 seconds
        refetchIntervalInBackground: false,
      }
    );

  const createByDoctor = api.appointment.createByDoctor.useMutation({
    onSuccess: () => {
      utils.appointment.getMyAppointments.invalidate();
      setScheduleConnectionId(null);
      setScheduleDateTime('');
      setScheduleIsOnline(false);
      setScheduleSendMessage(true);
      setScheduleNotes('');
      alert('Appointment scheduled and patient notified.');
    },
  });

  const toDateTimeLocalValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openSchedule = (connectionId: string) => {
    setScheduleConnectionId(connectionId);
    setScheduleDateTime(toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
    setScheduleIsOnline(false);
    setScheduleSendMessage(true);
    setScheduleNotes('');
  };

  const closeSchedule = () => {
    setScheduleConnectionId(null);
  };

  const submitSchedule = () => {
    if (!scheduleConnectionId) return;
    if (!scheduleDateTime) {
      alert('Please select a date and time.');
      return;
    }

    const scheduledAt = new Date(scheduleDateTime);
    if (Number.isNaN(scheduledAt.getTime())) {
      alert('Invalid date/time.');
      return;
    }

    createByDoctor.mutate({
      connectionId: scheduleConnectionId,
      scheduledAt: scheduledAt.toISOString(),
      isOnline: scheduleIsOnline,
      notes: scheduleNotes.trim() ? scheduleNotes.trim() : undefined,
      sendMessage: scheduleSendMessage,
    });
  };

  const connections = connectionsData?.connections ?? [];
  const intakeSessions = intakeData?.sessions ?? [];

  // Get intake status for each connection
  const getIntakeStatusForConnection = (connectionId: string) => {
    const session = intakeSessions.find(s => s.connectionId === connectionId);
    if (!session) return { status: 'not_started', completeness: 0 };
    return { 
      status: session.status, 
      completeness: session.completeness,
      sessionId: session.id,
      chiefComplaint: (session.medicalData as { chiefComplaint?: string } | null)?.chiefComplaint,
      updatedAt: session.updatedAt,
    };
  };

  // Build patient list with intake status
  const patients: PatientWithIntake[] = connections.map(connection => ({
    connection,
    intakeStatus: getIntakeStatusForConnection(connection.id),
  }));

  // Filter patients
  const filteredPatients = patients.filter(patient => {
    // Search filter
    const patientName = patient.connection.patient?.user
      ? `${patient.connection.patient.user.firstName || ''} ${patient.connection.patient.user.lastName || ''}`.toLowerCase()
      : '';
    const patientEmail = patient.connection.patient?.user?.email?.toLowerCase() || '';
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      patientName.includes(searchLower) || 
      patientEmail.includes(searchLower);

    // Status filter
    const matchesStatus = statusFilter === 'all' || patient.intakeStatus.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Sort: ready for review first, then by connection date
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    if (a.intakeStatus.status === 'ready' && b.intakeStatus.status !== 'ready') return -1;
    if (b.intakeStatus.status === 'ready' && a.intakeStatus.status !== 'ready') return 1;
    return new Date(b.connection.connectedAt).getTime() - new Date(a.connection.connectedAt).getTime();
  });

  // Stats
  const stats = {
    total: patients.length,
    needsReview: patients.filter(p => p.intakeStatus.status === 'ready').length,
    inProgress: patients.filter(p => p.intakeStatus.status === 'in_progress').length,
    reviewed: patients.filter(p => p.intakeStatus.status === 'reviewed').length,
  };

  const isLoading = connectionsLoading || intakeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
          <div className="h-12 bg-slate-200 rounded mb-4"></div>
        </div>
        <div className="space-y-2">
          <PatientCardSkeleton />
          <PatientCardSkeleton />
          <PatientCardSkeleton />
          <PatientCardSkeleton />
          <PatientCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Patients</h1>
          <p className="text-slate-500 mt-1">
            {stats.total} connected patient{stats.total !== 1 ? 's' : ''}
            {stats.needsReview > 0 && (
              <span className="text-green-600 font-medium"> • {stats.needsReview} ready for review</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IntakeStatus)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent bg-white"
          >
            <option value="all">All Status</option>
            <option value="ready">Ready for Review</option>
            <option value="in_progress">In Progress</option>
            <option value="reviewed">Reviewed</option>
            <option value="not_started">Not Started</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Patients</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <p className="text-sm text-green-600">Needs Review</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{stats.needsReview}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4">
          <p className="text-sm text-yellow-600">In Progress</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-sm text-blue-600">Reviewed</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{stats.reviewed}</p>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {sortedPatients.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="font-medium text-slate-600 mb-1">
              {searchQuery || statusFilter !== 'all' ? 'No patients found' : 'No patients yet'}
            </h3>
            <p className="text-sm text-slate-400">
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Share your QR code to start connecting with patients'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Intake Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Chief Complaint
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Connected
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPatients.map((patient) => (
                  <PatientRow key={patient.connection.id} patient={patient} onSchedule={openSchedule} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scheduleConnectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-800">Schedule Appointment</h2>
              <button
                type="button"
                onClick={closeSchedule}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                <textarea
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scheduleIsOnline}
                  onChange={(e) => setScheduleIsOnline(e.target.checked)}
                />
                Online (Zoom)
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={scheduleSendMessage}
                  onChange={(e) => setScheduleSendMessage(e.target.checked)}
                />
                Send patient a message
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeSchedule}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                  disabled={createByDoctor.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitSchedule}
                  className="flex-1 px-3 py-2 rounded-lg bg-medical-600 text-white hover:bg-medical-700 disabled:opacity-50"
                  disabled={createByDoctor.isPending}
                >
                  {createByDoctor.isPending ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
