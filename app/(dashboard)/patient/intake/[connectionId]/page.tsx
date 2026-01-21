'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import IntakeChatInterface from '@/app/components/IntakeChatInterface';
import MedicalSidebar from '@/app/components/MedicalSidebar';
import BookingModal from '@/app/components/BookingModal';
import { EmergencyAlert } from '@/app/components/EmergencyAlert';
import { INITIAL_MEDICAL_DATA, INITIAL_THOUGHT } from '@/types';
import type { Message, MedicalData, DoctorThought, IntakeStage } from '@/types';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/app/components/Toast';
import { useDashboardLayout } from '../../../DashboardLayoutContext';
import { ArrowLeft, Loader2, AlertCircle, PanelRightOpen, PanelRightClose, CheckCircle2, Calendar, Stethoscope, Menu, X, Bell, Copy } from 'lucide-react';
import { calculateStageFromData } from '@/app/lib/agent-router';
import { MessageListSkeleton } from '@/app/components/SkeletonComponents';

 const HEADER_STAGES: Array<{ id: IntakeStage; label: string }> = [
   { id: 'triage', label: 'Basics' },
   { id: 'investigation', label: 'Symptoms' },
   { id: 'records', label: 'Records' },
   { id: 'profile', label: 'History' },
   { id: 'context', label: 'Lifestyle' },
   { id: 'summary', label: 'Review' },
 ];

export default function PatientIntakePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { sidebarOpen: dashboardSidebarOpen, toggleSidebar: toggleDashboardSidebar } = useDashboardLayout();
  const { addToast } = useToast();
  const connectionId = params.connectionId as string;
  const sessionIdFromUrl = searchParams.get('sessionId');
  const [medicalSidebarOpen, setMedicalSidebarOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [medicalData, setMedicalData] = useState<MedicalData>(INITIAL_MEDICAL_DATA);
  const [thought, setThought] = useState<DoctorThought>(INITIAL_THOUGHT);
  const [completeness, setCompleteness] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const optimisticMessageIdRef = useRef<string | null>(null);
  const createSessionRetryRef = useRef(0);

  const { data: notificationData } = api.notification.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    enabled: !!user,
  });
  const unreadCount = notificationData?.count ?? 0;
  const createSession = api.intake.create.useMutation({
    onSuccess: (s) => {
      createSessionRetryRef.current = 0;
      setSessionId(s.id);
      router.replace(`/patient/intake/${connectionId}?sessionId=${s.id}`);
    },
    onError: (err) => {
      const code = err.data?.code;
      if (code === 'NOT_FOUND' && createSessionRetryRef.current < 3) {
        createSessionRetryRef.current += 1;
        const delayMs = 500 * Math.pow(2, createSessionRetryRef.current - 1);
        window.setTimeout(() => {
          createSession.mutate({ connectionId });
        }, delayMs);
        return;
      }

      addToast({
        type: 'error',
        title: 'Unable to start intake',
        message: err.message || 'Please try again.',
        duration: 5000,
      });
    },
  });

  const resolvedSessionId = sessionIdFromUrl ?? sessionId;

  const handleCopyCode = useCallback(async () => {
    const value = resolvedSessionId ?? connectionId;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      addToast({
        type: 'success',
        title: 'Copied',
        message: 'Session code copied to clipboard.',
        duration: 2500,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Copy failed',
        message: 'Unable to copy. Please copy from the URL instead.',
        duration: 3500,
      });
    }
  }, [resolvedSessionId, connectionId, addToast]);

  const { data: sessionData, isLoading: sessionLoading, error: sessionError } = api.intake.getSession.useQuery(
    { sessionId: resolvedSessionId ?? '' },
    { enabled: !!resolvedSessionId }
  );

  const { data: existingSessionsData, isLoading: existingSessionsLoading, error: existingSessionsError, refetch: refetchExistingSessions } = api.intake.getMyIntakeSessions.useQuery(
    { connectionId },
    {
      enabled: !resolvedSessionId,
      retry: (failureCount, err) => {
        if (err.data?.code !== 'NOT_FOUND') return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => 500 * Math.pow(2, attemptIndex),
    }
  );
  const sendMessage = api.intake.sendMessage.useMutation({
    onSuccess: (result) => {
      setMessages((prev) => {
        let next = prev;
        const optimisticId = optimisticMessageIdRef.current;

        if (result.userMessage) {
          if (optimisticId) {
            const idx = prev.findIndex((m) => m.id === optimisticId);
            if (idx >= 0) {
              next = [...prev];
              next[idx] = result.userMessage as Message;
            } else {
              next = [...prev, result.userMessage as Message];
            }
          } else {
            next = [...prev, result.userMessage as Message];
          }
        }

        if (result.aiMessage) {
          next = [...next, result.aiMessage as Message];
        }

        return next;
      });

      if (result.updatedMedicalData) setMedicalData(result.updatedMedicalData);
      if (result.thought) setThought(result.thought);
      setCompleteness(result.completeness);
      optimisticMessageIdRef.current = null;
      setIsSending(false);
    },
    onError: (err) => {
      const optimisticId = optimisticMessageIdRef.current;
      if (optimisticId) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
      optimisticMessageIdRef.current = null;
      setIsSending(false);
      addToast({
        type: 'error',
        title: 'Message failed',
        message: err.message || 'Unable to send message. Please try again.',
        duration: 4000,
      });
    },
  });

  const currentStage: IntakeStage = useMemo(() => {
    if (medicalData.bookingStatus === 'ready' || medicalData.bookingStatus === 'booked') {
      return 'summary';
    }
    return calculateStageFromData(medicalData);
  }, [medicalData]);

  const activeStageIndex = useMemo(() => {
    const idx = HEADER_STAGES.findIndex((s) => s.id === currentStage);
    return idx >= 0 ? idx : 0;
  }, [currentStage]);

  const stageLabel = useMemo(() => {
    return HEADER_STAGES[activeStageIndex]?.label ?? 'Basics';
  }, [activeStageIndex]);

  const isReady = useMemo(() => medicalData.bookingStatus === 'ready', [medicalData.bookingStatus]);
  const isBooked = useMemo(() => medicalData.bookingStatus === 'booked', [medicalData.bookingStatus]);
  const isEmergency = useMemo(() => medicalData.vitalsData?.triageDecision === 'emergency', [medicalData.vitalsData?.triageDecision]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 1024) {
      setMedicalSidebarOpen(false);
    } else {
      setMedicalSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    if (existingSessionsData && !resolvedSessionId) {
      const sessionsForConnection = existingSessionsData.sessions.filter((s) => s.connection.id === connectionId);

      // getMyIntakeSessions is ordered by updatedAt desc on the server, so the first one is the latest.
      const latestSession = sessionsForConnection[0];

      if (latestSession) {
        setSessionId(latestSession.id);
        router.replace(`/patient/intake/${connectionId}?sessionId=${latestSession.id}`);
        return;
      }

      if (!createSession.isPending) {
        createSession.mutate({ connectionId });
      }
    }
  }, [existingSessionsData, resolvedSessionId, connectionId, createSession, router]);
  useEffect(() => {
    if (sessionData) {
      setMessages(sessionData.messages);
      if (sessionData.session.medicalData) setMedicalData(sessionData.session.medicalData);
      if (sessionData.session.doctorThought) setThought(sessionData.session.doctorThought);
      setCompleteness(sessionData.session.completeness);
    }
  }, [sessionData]);
  const handleSendMessage = useCallback((text: string, imageUrls: string[]) => {
    if (!resolvedSessionId) {
      addToast({
        type: 'error',
        title: 'Chat is still loading',
        message: 'Please wait a moment and try again.',
        duration: 3500,
      });
      return;
    }
    if (isSending) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    optimisticMessageIdRef.current = tempId;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'user',
        text,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        timestamp: new Date(),
      },
    ]);

    setIsSending(true);
    sendMessage.mutate({ sessionId: resolvedSessionId, content: text, images: imageUrls.length > 0 ? imageUrls : undefined });
  }, [resolvedSessionId, isSending, sendMessage, addToast]);
  const handleTopicTrigger = useCallback((field: keyof MedicalData) => {
    const prompts: Record<string, string> = { chiefComplaint: "What brings you in today?", hpi: "Tell me more about when this started.", medications: "What medications are you taking?", allergies: "Do you have any allergies?", pastMedicalHistory: "What conditions have you had?", familyHistory: "Any family medical history?", socialHistory: "Tell me about your lifestyle." };
    const prompt = prompts[field];
    if (prompt && resolvedSessionId) handleSendMessage(prompt, []);
  }, [resolvedSessionId, handleSendMessage]);
  if (!resolvedSessionId && existingSessionsError) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Unable to Load Intake</h2>
          <p className="text-slate-600 mb-4">{existingSessionsError.message}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => refetchExistingSessions()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700"
            >
              Retry
            </button>
            <Link
              href="/patient"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (!resolvedSessionId && (existingSessionsLoading || createSession.isPending || !existingSessionsData)) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="w-full max-w-3xl p-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-24 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
            <MessageListSkeleton count={3} />
          </div>
        </div>
      </div>
    );
  }
  if (resolvedSessionId && sessionLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="w-full max-w-3xl p-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse"></div>
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-24 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
            <MessageListSkeleton count={3} />
          </div>
        </div>
      </div>
    );
  }
  if (sessionError) {
    return (<div className="flex items-center justify-center h-full bg-slate-50"><div className="text-center max-w-md"><AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-800 mb-2">Unable to Load Session</h2><p className="text-slate-600 mb-4">{sessionError.message}</p><Link href="/patient" className="inline-flex items-center gap-2 px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700"><ArrowLeft className="w-4 h-4" />Back to Dashboard</Link></div></div>);
  }
  const doctorInfo = sessionData?.connection?.doctor;
  const doctorName = doctorInfo?.user ? `Dr. ${doctorInfo.user.firstName || ''} ${doctorInfo.user.lastName || ''}`.trim() : 'Your Doctor';
  return (
    <div className="h-[100dvh] grid grid-rows-[auto_1fr] bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-4 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 md:col-start-1 md:row-start-1">
            <button
              type="button"
              onClick={toggleDashboardSidebar}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              aria-label="Toggle menu"
            >
              {dashboardSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/patient" className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-medical-600 flex items-center justify-center text-white shadow-lg">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-slate-800 text-base sm:text-lg leading-tight truncate">HelloDoctor</h1>
              <p className="text-[11px] text-slate-500 truncate sm:hidden">
                {doctorName ? doctorName : ''}
                {doctorInfo?.specialty ? ` • ${doctorInfo.specialty}` : ''}
              </p>
              <p className="hidden sm:block text-xs text-slate-500 truncate">Automated Intake & Booking</p>
              <p className="hidden sm:block text-xs text-slate-500 truncate">
                {doctorName ? doctorName : ''}
                {doctorInfo?.specialty ? ` • ${doctorInfo.specialty}` : ''}
              </p>
            </div>
          </div>

          <div className="hidden md:flex w-full max-w-2xl md:col-start-2 md:row-start-1 justify-self-center px-2">
            <div className="flex items-center justify-between w-full">
                {HEADER_STAGES.map((stage, index) => {
                  const isActive = index === activeStageIndex;
                  const isCompleted = index < activeStageIndex;

                  return (
                    <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`
                            w-6 h-6 rounded-full flex items-center justify-center border text-[10px] font-bold transition-all
                            ${isCompleted ? 'bg-medical-500 border-medical-500 text-white' :
                              isActive ? 'bg-white border-medical-600 text-medical-700' :
                              'bg-white border-slate-200 text-slate-400'}
                          `}
                        >
                          {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                        </div>
                        <span className={`text-[10px] mt-1 font-semibold ${isActive ? 'text-medical-700' : 'text-slate-400'}`}>{stage.label}</span>
                      </div>

                      {index < HEADER_STAGES.length - 1 && (
                        <div className={`flex-1 h-px mx-2 ${isCompleted ? 'bg-medical-200' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 justify-end md:col-start-3 md:row-start-1">
            {isReady && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Ready for Booking
              </div>
            )}
            {isBooked && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Appointment Booked
              </div>
            )}

            <NotificationBell unreadCount={unreadCount} isPatientDashboard={true} />

            <button
              type="button"
              onClick={handleCopyCode}
              className="hidden sm:inline-flex p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Copy session code"
              title="Copy session code"
            >
              <Copy className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={() => setMedicalSidebarOpen(!medicalSidebarOpen)}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
              aria-label="Toggle medical sidebar"
            >
              {medicalSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
            </button>
          </div>

          <div className="md:hidden col-span-2 row-start-2 flex items-center justify-center pt-1">
            <span className="px-2 py-1 rounded-full bg-slate-100 text-medical-700 text-xs font-semibold truncate max-w-[70vw]">
              {stageLabel}
            </span>
          </div>
        </div>

      </header>
      <div className="min-h-0 flex overflow-hidden">
        <div className="flex-1 relative min-h-0">
          {isEmergency ? (
            <div className="h-full overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
              <div className="max-w-2xl w-full">
                <EmergencyAlert
                  reason={medicalData.vitalsData?.triageReason || 'Your vital signs or symptoms indicate you may need immediate medical attention.'}
                  recommendations={[
                    'Call emergency services (911) immediately if you are experiencing severe symptoms',
                    'Go to the nearest emergency room',
                    'Do not drive yourself - call an ambulance or have someone drive you',
                    'If symptoms worsen while waiting, call 911 immediately'
                  ]}
                />
              </div>
            </div>
          ) : (
            <IntakeChatInterface messages={messages} onSendMessage={handleSendMessage} isLoading={isSending} currentStage={currentStage} completeness={completeness} variant="patient" sessionId={resolvedSessionId ?? undefined} showTracker={false} />
          )}

          {isReady && !isEmergency && (
            <>
              <div className="absolute bottom-24 right-6 z-20 hidden md:flex">
                <button
                  onClick={() => setIsBookingModalOpen(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-full font-bold shadow-xl"
                >
                  <Calendar className="w-5 h-5" /> Book Appointment
                </button>
              </div>

              <div className="absolute bottom-24 left-6 z-20 md:hidden">
                <button
                  onClick={() => setIsBookingModalOpen(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-full font-bold shadow-xl animate-bounce"
                >
                  <Calendar className="w-5 h-5" /> Book
                </button>
              </div>
            </>
          )}
        </div>
        {medicalSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/20 z-30"
            onClick={() => setMedicalSidebarOpen(false)}
          />
        )}
        <div
          className={`md:hidden fixed inset-y-0 right-0 z-40 w-[85vw] sm:w-[75vw] transform transition-transform duration-300 ease-in-out ${
            medicalSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="relative h-full bg-white shadow-lg">
            <MedicalSidebar data={medicalData} thought={thought} onTopicTrigger={handleTopicTrigger} showDoctorHandover={false} />
          </div>
        </div>

        <div className="hidden lg:flex h-full w-72 flex-shrink-0 bg-white shadow-none lg:w-72 xl:w-80 2xl:w-96">
          <MedicalSidebar data={medicalData} thought={thought} onTopicTrigger={handleTopicTrigger} showDoctorHandover={false} />
        </div>
      </div>

      {doctorInfo?.id && resolvedSessionId && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          connectionId={connectionId}
          doctorId={doctorInfo.id}
          intakeSessionId={resolvedSessionId}
          onBooked={() => {
            setIsBookingModalOpen(false);
            setMedicalData((prev) => ({ ...prev, bookingStatus: 'booked' }));
          }}
        />
      )}
    </div>
  );
}

function NotificationBell({ unreadCount, isPatientDashboard }: { unreadCount: number; isPatientDashboard: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  const router = useRouter();
  const { addToast } = useToast();

  const lastToastTimeRef = useRef<number>(0);

  const { data: notificationsData } = api.notification.getMyNotifications.useQuery(
    { limit: 5 },
    { enabled: isOpen && !!user }
  );

  const { data: unreadNotificationsData } = api.notification.getMyNotifications.useQuery(
    { limit: 5, unreadOnly: true },
    {
      enabled: !!user,
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
    }
  );

  const utils = api.useUtils();
  const markAsRead = api.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getMyNotifications.invalidate();
    },
  });

  useEffect(() => {
    const items = unreadNotificationsData?.notifications ?? [];
    if (items.length === 0) return;

    if (lastToastTimeRef.current === 0) {
      lastToastTimeRef.current = Date.now();
      return;
    }

    const newItems = items
      .map((n) => ({
        n,
        ts: new Date(n.createdAt).getTime(),
      }))
      .filter(({ ts }) => ts > lastToastTimeRef.current)
      .sort((a, b) => a.ts - b.ts);

    if (newItems.length === 0) return;
    lastToastTimeRef.current = newItems[newItems.length - 1]?.ts ?? lastToastTimeRef.current;

    for (const { n } of newItems) {
      if (n.type !== 'message') continue;

      const data = (n.data ?? {}) as { connectionId?: string };
      const connectionId = data.connectionId;
      if (!connectionId) continue;

      const href = isPatientDashboard
        ? `/patient/messages?connection=${connectionId}`
        : `/doctor/messages?connection=${connectionId}`;

      addToast({
        type: 'info',
        title: n.title,
        message: n.message,
        duration: 6000,
        action: {
          label: 'Open chat',
          onClick: () => {
            if (!n.isRead) {
              markAsRead.mutate({ notificationId: n.id });
            }
            router.push(href);
            setIsOpen(false);
          },
        },
      });
    }
  }, [unreadNotificationsData, addToast, isPatientDashboard, markAsRead, router]);

  const getNotificationHref = (notification: { type: string; data: unknown }) => {
    if (notification.type !== 'message') return null;
    const data = (notification.data ?? {}) as { connectionId?: string };
    if (!data.connectionId) return null;
    return isPatientDashboard
      ? `/patient/messages?connection=${data.connectionId}`
      : `/doctor/messages?connection=${data.connectionId}`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-medical-600 font-medium">{unreadCount} new</span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {(notificationsData?.notifications ?? []).length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(notificationsData?.notifications ?? []).map((n) => {
                    const href = getNotificationHref(n);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (!n.isRead) {
                            markAsRead.mutate({ notificationId: n.id });
                          }
                          if (href) router.push(href);
                          setIsOpen(false);
                        }}
                        className={`w-full p-3 text-left hover:bg-slate-50 transition-colors ${
                          n.isRead ? 'opacity-75' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                              n.isRead ? 'bg-slate-300' : 'bg-medical-500'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
