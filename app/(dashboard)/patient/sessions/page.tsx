'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import { Plus, Loader2, FileText, User, CheckCircle } from 'lucide-react';
import SessionCard from '@/app/components/SessionCard';
import SessionFilterBar, { type StatusFilter, type SortOption } from '@/app/components/SessionFilterBar';
import DeleteConfirmationDialog from '@/app/components/DeleteConfirmationDialog';
import ResetConfirmationDialog from '@/app/components/ResetConfirmationDialog';
import BookingModal from '@/app/components/BookingModal';
import { IntakeProgressCardSkeleton } from '@/app/components/SkeletonComponents';

/**
 * SessionManagerPage
 * 
 * Main page for managing intake sessions.
 * Requirements: 1.1, 6.3, 6.4
 */
export default function SessionManagerPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{
    id: string;
    hasLinkedAppointment: boolean;
  } | null>(null);
  
  // Reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [sessionToReset, setSessionToReset] = useState<{
    id: string;
    connectionId: string;
  } | null>(null);

  // Booking modal state
  // Requirements: 2.1
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingSessionId, setBookingSessionId] = useState<string | null>(null);
  const [bookingConnectionId, setBookingConnectionId] = useState<string | null>(null);
  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  
  // Success notification state
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);

  // Fetch sessions
  const { data, isLoading, error, refetch } = api.intake.getAllSessionsWithAppointments.useQuery({
    status: statusFilter,
    sortBy,
  });

  // Mutations
  const createSessionMutation = api.intake.createNewSession.useMutation({
    onSuccess: (newSession) => {
      router.push(`/patient/intake/${newSession.connectionId}?sessionId=${newSession.id}`);
    },
  });

  const deleteSessionMutation = api.intake.deleteSession.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      refetch();
    },
  });

  const resetSessionMutation = api.intake.resetSession.useMutation({
    onSuccess: () => {
      setResetDialogOpen(false);
      setSessionToReset(null);
      refetch();
    },
  });

  // Session name update mutation
  const updateSessionNameMutation = api.intake.updateSessionName.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Track which session is being updated
  const [updatingNameSessionId, setUpdatingNameSessionId] = useState<string | null>(null);

  // Count total sessions
  const totalSessionCount = useMemo(() => {
    if (!data?.groupedSessions) return 0;
    return data.groupedSessions.reduce((sum, group) => sum + group.sessions.length, 0);
  }, [data]);

  // Handlers
  const handleContinue = (sessionId: string) => {
    // Find the connection ID for this session
    const group = data?.groupedSessions.find(g => 
      g.sessions.some(s => s.id === sessionId)
    );
    if (group) {
      router.push(`/patient/intake/${group.connection.id}?sessionId=${sessionId}`);
    }
  };

  const handleView = (sessionId: string) => {
    const group = data?.groupedSessions.find(g => 
      g.sessions.some(s => s.id === sessionId)
    );
    if (group) {
      router.push(`/patient/intake/${group.connection.id}?sessionId=${sessionId}`);
    }
  };

  const handleReset = (sessionId: string) => {
    const group = data?.groupedSessions.find(g => 
      g.sessions.some(s => s.id === sessionId)
    );
    if (group) {
      setSessionToReset({ id: sessionId, connectionId: group.connection.id });
      setResetDialogOpen(true);
    }
  };

  const handleDelete = (sessionId: string) => {
    const group = data?.groupedSessions.find(g => 
      g.sessions.some(s => s.id === sessionId)
    );
    const session = group?.sessions.find(s => s.id === sessionId);
    if (session) {
      setSessionToDelete({
        id: sessionId,
        hasLinkedAppointment: !!session.linkedAppointment,
      });
      setDeleteDialogOpen(true);
    }
  };

  const handleBookAppointment = (sessionId: string) => {
    // Requirements: 2.1, 2.2
    // Open BookingModal inline instead of navigating to appointments page
    const group = data?.groupedSessions.find(g => 
      g.sessions.some(s => s.id === sessionId)
    );
    if (group) {
      setBookingSessionId(sessionId);
      setBookingConnectionId(group.connection.id);
      setBookingDoctorId(group.connection.doctor.id);
      setIsBookingModalOpen(true);
    }
  };

  const handleCreateNewSession = (connectionId: string | undefined) => {
    if (!connectionId) return;
    createSessionMutation.mutate({ connectionId });
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      deleteSessionMutation.mutate({ sessionId: sessionToDelete.id });
    }
  };

  const confirmReset = () => {
    if (sessionToReset) {
      resetSessionMutation.mutate({
        connectionId: sessionToReset.connectionId,
        currentSessionId: sessionToReset.id,
      });
    }
  };

  // Handle session name update
  const handleNameUpdate = async (sessionId: string, newName: string | null) => {
    setUpdatingNameSessionId(sessionId);
    try {
      await updateSessionNameMutation.mutateAsync({ sessionId, name: newName });
    } finally {
      setUpdatingNameSessionId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-6"></div>
        <IntakeProgressCardSkeleton />
        <IntakeProgressCardSkeleton />
        <IntakeProgressCardSkeleton />
        <IntakeProgressCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">Failed to load sessions. Please try again.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">My Intake Sessions</h1>
        <p className="text-slate-600">
          Manage your medical intake sessions across all your doctors.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6">
        <SessionFilterBar
          statusFilter={statusFilter}
          sortBy={sortBy}
          onStatusFilterChange={setStatusFilter}
          onSortChange={setSortBy}
          sessionCount={totalSessionCount}
        />
      </div>

      {/* Sessions grouped by doctor */}
      {data?.groupedSessions && data.groupedSessions.length > 0 ? (
        <div className="space-y-8">
          {data.groupedSessions.map((group) => (
            <div key={group.connection.id} className="space-y-4">
              {/* Doctor Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                    {group.connection.doctor.user.imageUrl ? (
                      <img
                        src={group.connection.doctor.user.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">
                      Dr. {group.connection.doctor.user.firstName} {group.connection.doctor.user.lastName}
                    </h2>
                    {group.connection.doctor.specialty && (
                      <p className="text-sm text-slate-500">{group.connection.doctor.specialty}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleCreateNewSession(group.connection.id)}
                  disabled={createSessionMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  New Session
                </button>
              </div>

              {/* Session Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {group.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={{
                      id: session.id,
                      name: session.name,
                      status: session.status as 'not_started' | 'in_progress' | 'ready' | 'reviewed',
                      completeness: session.completeness,
                      currentAgent: session.currentAgent,
                      startedAt: session.startedAt,
                      completedAt: session.completedAt,
                      createdAt: session.createdAt,
                      updatedAt: session.updatedAt,
                      linkedAppointment: session.linkedAppointment,
                    }}
                    onContinue={handleContinue}
                    onView={handleView}
                    onReset={handleReset}
                    onDelete={handleDelete}
                    onBookAppointment={handleBookAppointment}
                    onNameUpdate={handleNameUpdate}
                    isUpdatingName={updatingNameSessionId === session.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">No sessions found</h3>
          <p className="text-slate-600 mb-4">
            {statusFilter === 'all'
              ? "You don't have any intake sessions yet."
              : `No ${statusFilter} sessions found.`}
          </p>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              View all sessions
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteDialogOpen}
        sessionId={sessionToDelete?.id ?? ''}
        hasLinkedAppointment={sessionToDelete?.hasLinkedAppointment ?? false}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setSessionToDelete(null);
        }}
        isDeleting={deleteSessionMutation.isPending}
      />

      {/* Reset Confirmation Dialog */}
      <ResetConfirmationDialog
        isOpen={resetDialogOpen}
        onConfirm={confirmReset}
        onCancel={() => {
          setResetDialogOpen(false);
          setSessionToReset(null);
        }}
        isResetting={resetSessionMutation.isPending}
      />

      {/* Booking Modal */}
      {/* Requirements: 2.1, 2.2, 2.3, 2.4 */}
      {bookingConnectionId && bookingDoctorId && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setBookingSessionId(null);
            setBookingConnectionId(null);
            setBookingDoctorId(null);
          }}
          connectionId={bookingConnectionId}
          doctorId={bookingDoctorId}
          intakeSessionId={bookingSessionId ?? undefined}
          onBooked={() => {
            // Requirements: 2.3, 2.4
            setIsBookingModalOpen(false);
            setBookingSessionId(null);
            setBookingConnectionId(null);
            setBookingDoctorId(null);
            setShowBookingSuccess(true);
            refetch(); // Refresh sessions to show linked appointment
            setTimeout(() => setShowBookingSuccess(false), 3000);
          }}
        />
      )}

      {/* Booking Success Notification */}
      {/* Requirements: 2.4 */}
      {showBookingSuccess && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-medium">Appointment booked successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}
