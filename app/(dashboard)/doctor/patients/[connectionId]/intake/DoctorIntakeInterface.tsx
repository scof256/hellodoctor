'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import {
  Loader2, ArrowLeft, CheckCircle2,
  User, Menu, X, WifiOff, RefreshCw, Wifi
} from 'lucide-react';
import { MessageListSkeleton } from '@/app/components/SkeletonComponents';
import IntakeChatInterface from './IntakeChatInterface';
import MedicalSidebar from './MedicalSidebar';
import { PollingService, ConnectionStatus } from './PollingService';

const STAGES = [
  { id: 'triage', label: 'Basics', threshold: 0 },
  { id: 'investigation', label: 'Symptoms', threshold: 15 },
  { id: 'records', label: 'Records', threshold: 35 },
  { id: 'history', label: 'History', threshold: 55 },
  { id: 'context', label: 'Lifestyle', threshold: 75 },
  { id: 'summary', label: 'Review', threshold: 90 },
];

interface DoctorIntakeInterfaceProps {
  connectionId: string;
  initialSession: {
    id: string;
    connectionId: string;
    name: string | null;
    status: string;
    completeness: number;
    connection: {
      patient: {
        user: {
          firstName: string | null;
          lastName: string | null;
          imageUrl: string | null;
        };
      };
    };
  };
}

/**
 * Doctor Intake Interface - Client Component
 * 
 * Enhanced immersive interface for doctors to review patient intake sessions.
 * 
 * Features:
 * - Full-page responsive layout (Requirement 1.1, 1.2, 1.3, 1.4)
 * - Desktop two-column layout: chat + sidebar (Requirement 1.3)
 * - Mobile single-column with slide-out sidebar (Requirement 1.2, 11.2)
 * - Real-time polling for updates (Requirement 8.1)
 * - Medical color scheme with purple accents (Requirement 1.5, 7.1, 7.2)
 * - State management for session, messages, SBAR (Task 3.2)
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 3.1, 8.1
 */
export default function DoctorIntakeInterface({
  connectionId,
  initialSession,
}: DoctorIntakeInterfaceProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // State management for sidebar visibility (mobile) and active tab
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'intake-data' | 'handover'>('intake-data');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Connection status state (Requirement 8.2, 8.3, 8.4)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const pollingServiceRef = useRef<PollingService | null>(null);

  // Query for session data (manual refetch, no automatic polling)
  const { data: sessionData, isLoading, refetch } = api.intake.getSession.useQuery(
    { sessionId: initialSession.id },
    {
      refetchInterval: false, // Disable automatic polling, we'll use PollingService
      refetchIntervalInBackground: false,
    }
  );

  // Query for clinical reasoning (Requirement 4.1)
  const { data: clinicalReasoningData, refetch: refetchReasoning } = api.intake.getClinicalReasoning.useQuery(
    { connectionId },
    {
      refetchInterval: false, // Disable automatic polling, we'll use PollingService
      refetchIntervalInBackground: false,
    }
  );

  // Mark as reviewed mutation (Requirement 9.2)
  const markAsReviewed = api.intake.markAsReviewed.useMutation({
    onSuccess: () => {
      utils.intake.getDoctorIntakeSessions.invalidate();
      utils.intake.getSession.invalidate({ sessionId: initialSession.id });
    },
  });

  // Set up polling service (Requirement 8.1, 8.6)
  useEffect(() => {
    const pollingService = new PollingService({
      onPoll: async () => {
        // Refetch session data and clinical reasoning
        await Promise.all([
          refetch(),
          refetchReasoning(),
        ]);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          setLastError(null);
        }
      },
      onError: (error) => {
        setLastError(error.message);
      },
    }, {
      interval: 3000, // 3 seconds (Requirement 8.1)
      maxRetries: 5,
      backoffMultiplier: 2,
      maxBackoffInterval: 30000,
    });

    pollingServiceRef.current = pollingService;
    pollingService.start();

    // Cleanup on unmount
    return () => {
      pollingService.stop();
    };
  }, [refetch, refetchReasoning]);

  // Manual reconnect handler (Requirement 8.5)
  const handleReconnect = () => {
    if (pollingServiceRef.current) {
      pollingServiceRef.current.reconnect();
    }
  };

  // Show loading state while fetching (Requirement 10.1)
  if (isLoading || !sessionData) {
    return (
      <div className="h-screen w-full flex flex-col bg-slate-50">
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MessageListSkeleton count={6} />
        </div>
      </div>
    );
  }

  // Get current stage based on completeness
  const getCurrentStageIndex = (completeness: number) => {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (completeness >= (STAGES[i]?.threshold ?? 0)) return i;
    }
    return 0;
  };

  // Extract data from session
  const patientUser = initialSession.connection.patient.user;
  const patientName = patientUser
    ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  const completeness = initialSession.completeness ?? 0;
  const currentStageIndex = getCurrentStageIndex(completeness);
  const messages = sessionData.messages;
  const medicalData = sessionData.session.medicalData;
  const isReviewed = sessionData.session.status === 'reviewed';
  const isReady = sessionData.session.status === 'ready';

  return (
    // Full-page layout (Requirement 1.1, 1.4) - Desktop two-column, Mobile single-column
    <div className="h-screen w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden">
      {/* Main Content Area - Chat Interface */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isSidebarExpanded ? 'hidden' : ''}`}>
        {/* Connection Status Warning Banner (Requirement 8.3, 8.4) */}
        {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <WifiOff className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-red-800">Connection Lost</p>
                {lastError && (
                  <p className="text-xs text-red-600 truncate">{lastError}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleReconnect}
              className="px-4 py-2.5 min-h-[44px] bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 text-sm flex-shrink-0"
              aria-label="Reconnect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reconnect</span>
            </button>
          </div>
        )}

        {/* Header with patient info and actions */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm z-20">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => router.push('/doctor/patients')}
                  className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Back to patients"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    {patientUser?.imageUrl ? (
                      <img src={patientUser.imageUrl} alt={patientName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="font-semibold text-slate-800 truncate">{patientName}</h1>
                      {/* Connection Status Indicator (Requirement 8.2) */}
                      {connectionStatus === 'connected' && (
                        <span title="Connected">
                          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                        </span>
                      )}
                      {connectionStatus === 'connecting' && (
                        <span title="Connecting...">
                          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">Intake Session</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {/* Mobile sidebar toggle button (Requirement 11.2) */}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden px-4 py-3 min-h-[44px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  aria-label="Toggle medical sidebar"
                >
                  {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                  <span>Medical Data</span>
                </button>

                {isReviewed && (
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Reviewed
                  </span>
                )}
                {isReady && !isReviewed && (
                  <button
                    onClick={() => markAsReviewed.mutate({ sessionId: initialSession.id })}
                    disabled={markAsReviewed.isPending}
                    className="px-4 py-3 min-h-[44px] bg-medical-600 text-white rounded-lg hover:bg-medical-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {markAsReviewed.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span className="sm:hidden">Review</span>
                    <span className="hidden sm:inline">Mark as Reviewed</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stage Progress */}
            <div className="sm:hidden flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 bg-medical-50 text-medical-700 rounded-full text-xs font-semibold">
                {STAGES[currentStageIndex]?.label}
              </span>
              <span className="text-xs font-bold text-medical-600">{completeness}%</span>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              {STAGES.map((stage, index) => {
                const isActive = index === currentStageIndex;
                const isCompleted = index < currentStageIndex;

                return (
                  <div key={stage.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                        ${isCompleted ? 'bg-medical-500 text-white' :
                          isActive ? 'bg-medical-100 text-medical-700 ring-2 ring-medical-500' :
                            'bg-slate-100 text-slate-400'}
                      `}>
                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : index + 1}
                      </div>
                      <span className={`text-[9px] mt-0.5 ${isActive ? 'text-medical-700 font-semibold' : 'text-slate-400'}`}>
                        {stage.label}
                      </span>
                    </div>
                    {index < STAGES.length - 1 && (
                      <div className={`w-full h-0.5 ${isCompleted ? 'bg-medical-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
              <span className="text-sm font-bold text-medical-600 ml-2">{completeness}%</span>
            </div>
          </div>
        </div>

        {/* Chat Messages Area - Using IntakeChatInterface Component (Task 4.1) */}
        <IntakeChatInterface
          messages={messages}
          patientName={patientName}
          connectionId={connectionId}
          isReadOnly={isReviewed}
          onMessageSent={() => {
            // Invalidate queries to refresh data after message sent
            utils.intake.getSession.invalidate({ sessionId: initialSession.id });
          }}
        />
      </div>

      {/* Medical Sidebar Component - Desktop: fixed right column, Mobile: slide-out drawer */}
      {/* Requirement 1.3 (desktop two-column), 1.2 (mobile single-column), 11.2 (slide-out) */}
      <MedicalSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        completeness={completeness}
        medicalData={medicalData ?? {}}
        clinicalReasoning={clinicalReasoningData?.clinicalReasoning ?? null}
        isGeneratingReasoning={!clinicalReasoningData && connectionStatus === 'connected'}
        isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      {/* Overlay for mobile sidebar (Requirement 11.2) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}
    </div>
  );
}
