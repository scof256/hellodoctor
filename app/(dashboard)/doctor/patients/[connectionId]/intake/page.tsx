'use client';

import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import type { Message, MedicalData, AgentRole } from '@/types';
import { 
  Loader2, AlertCircle, ArrowLeft, CheckCircle2, Bot, 
  User, FileText, Shield
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MessageListSkeleton } from '@/app/components/SkeletonComponents';

const STAGES = [
  { id: 'triage', label: 'Basics', threshold: 0 },
  { id: 'investigation', label: 'Symptoms', threshold: 15 },
  { id: 'records', label: 'Records', threshold: 35 },
  { id: 'history', label: 'History', threshold: 55 },
  { id: 'context', label: 'Lifestyle', threshold: 75 },
  { id: 'summary', label: 'Review', threshold: 90 },
];

const AGENT_COLORS: Record<AgentRole, string> = {
  'Triage': 'bg-teal-500',
  'ClinicalInvestigator': 'bg-blue-500',
  'RecordsClerk': 'bg-orange-500',
  'HistorySpecialist': 'bg-indigo-500',
  'HandoverSpecialist': 'bg-green-500'
};

const AGENT_LABELS: Record<AgentRole, string> = {
  'Triage': 'Triage',
  'ClinicalInvestigator': 'Investigator',
  'RecordsClerk': 'Records',
  'HistorySpecialist': 'History',
  'HandoverSpecialist': 'Summary'
};

export default function DoctorIntakeViewPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.connectionId as string;
  const utils = api.useUtils();

  // Get connection details
  const { data: connectionData, isLoading: connectionLoading } = 
    api.connection.getMyConnections.useQuery({ status: 'active' });

  // Get intake sessions for this connection
  const { data: intakeData, isLoading: intakeLoading } = 
    api.intake.getDoctorIntakeSessions.useQuery({ status: 'all' });

  const connection = connectionData?.connections.find(c => c.id === connectionId);
  const session = intakeData?.sessions.find(s => s.connectionId === connectionId);

  // Get session details with messages - poll every 10 seconds for real-time updates
  const { data: sessionData, isLoading: sessionLoading } = api.intake.getSession.useQuery(
    { sessionId: session?.id ?? '' },
    { 
      enabled: !!session?.id,
      refetchInterval: 10000, // Poll every 10 seconds for new messages
      refetchIntervalInBackground: false, // Don't poll when tab is not focused
    }
  );

  // Mark as reviewed mutation
  const markAsReviewed = api.intake.markAsReviewed.useMutation({
    onSuccess: () => {
      // Refetch data
      utils.intake.getDoctorIntakeSessions.invalidate();
    },
  });

  const isLoading = connectionLoading || intakeLoading || sessionLoading;

  // Get current stage based on completeness
  const getCurrentStageIndex = (completeness: number) => {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (completeness >= (STAGES[i]?.threshold ?? 0)) return i;
    }
    return 0;
  };

  const getImageSrc = (img: string) => {
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return `data:image/jpeg;base64,${img}`;
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex flex-col bg-slate-50">
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="h-6 bg-slate-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MessageListSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Connection Not Found</h2>
          <p className="text-slate-600 mb-4">This patient connection could not be found.</p>
          <button
            onClick={() => router.push('/doctor/patients')}
            className="px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700"
          >
            Return to Patients
          </button>
        </div>
      </div>
    );
  }

  if (!session || !sessionData) {
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-4">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Intake Session</h2>
          <p className="text-slate-600 mb-4">This patient hasn&apos;t started their intake yet.</p>
          <button
            onClick={() => router.push('/doctor/patients')}
            className="px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700"
          >
            Return to Patients
          </button>
        </div>
      </div>
    );
  }

  const patientUser = (connection as { patient?: { id: string; user: { firstName: string | null; lastName: string | null; imageUrl: string | null; email: string | null; } | null; } | null })?.patient?.user;
  const patientName = patientUser
    ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  const completeness = session.completeness ?? 0;
  const currentStageIndex = getCurrentStageIndex(completeness);
  const messages = sessionData.messages;
  const medicalData = sessionData.session.medicalData as MedicalData | null;
  const isReviewed = session.status === 'reviewed';
  const isReady = session.status === 'ready';

  return (
    <div className="h-[calc(100dvh-4rem)] grid grid-rows-[auto_1fr] bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 shadow-sm z-20">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => router.push('/doctor/patients')}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
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
                  <h1 className="font-semibold text-slate-800 truncate">{patientName}</h1>
                  <p className="text-sm text-slate-500">Intake Session</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {isReviewed && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Reviewed
                </span>
              )}
              {isReady && !isReviewed && (
                <button
                  onClick={() => markAsReviewed.mutate({ sessionId: session.id })}
                  disabled={markAsReviewed.isPending}
                  className="px-3 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
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

      {/* Content Area */}
      <div className="overflow-y-auto">
        <div className="max-w-4xl mx-auto p-3 sm:p-4 grid md:grid-cols-3 gap-4">
          {/* Messages Column */}
          <div className="md:col-span-2 space-y-4">
            {/* Read-only banner - different styling for reviewed sessions */}
            {isReviewed ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  This intake session has been reviewed. No further changes can be made.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  This is a read-only view of the patient&apos;s intake conversation.
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Bot className="w-5 h-5 text-medical-600" />
                Conversation
              </h2>
              
              {messages.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No messages yet.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[92%] sm:max-w-[85%] min-w-0 rounded-2xl p-3 ${
                          msg.role === 'user'
                            ? 'bg-medical-600 text-white rounded-br-sm'
                            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                        }`}
                      >
                        {msg.role === 'model' && msg.activeAgent && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${AGENT_COLORS[msg.activeAgent] || 'bg-slate-400'}`}>
                              <Bot className="w-3 h-3" />
                              {AGENT_LABELS[msg.activeAgent] || msg.activeAgent}
                            </div>
                          </div>
                        )}

                        {msg.images && msg.images.length > 0 && (
                          <div className="flex gap-2 mb-2 flex-wrap">
                            {msg.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={getImageSrc(img)}
                                alt="Upload"
                                className="h-20 w-auto rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        )}

                        <div className={`prose prose-sm max-w-none min-w-0 whitespace-pre-wrap break-words prose-p:whitespace-pre-wrap prose-p:break-words ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Medical Data Summary Column */}
          <div className="space-y-4">
            {/* Chief Complaint */}
            {medicalData?.chiefComplaint && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Chief Complaint
                </h3>
                <p className="text-slate-600">{medicalData.chiefComplaint}</p>
              </div>
            )}

            {/* Review of Systems (Symptoms) */}
            {medicalData?.reviewOfSystems && medicalData.reviewOfSystems.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Review of Systems</h3>
                <ul className="space-y-1">
                  {medicalData.reviewOfSystems.map((item: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-medical-500 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medications */}
            {medicalData?.medications && medicalData.medications.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-2">Medications</h3>
                <ul className="space-y-1">
                  {medicalData.medications.map((med, idx) => (
                    <li key={idx} className="text-sm text-slate-600">{med}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Allergies */}
            {medicalData?.allergies && medicalData.allergies.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Allergies
                </h3>
                <ul className="space-y-1">
                  {medicalData.allergies.map((allergy, idx) => (
                    <li key={idx} className="text-sm text-slate-600">{allergy}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clinical Handover (SBAR) */}
            {medicalData?.clinicalHandover && (
              <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Clinical Handover (SBAR)
                </h3>
                <div className="space-y-3 text-sm">
                  {medicalData.clinicalHandover.situation && (
                    <div>
                      <p className="font-medium text-green-700">Situation</p>
                      <p className="text-green-900">{medicalData.clinicalHandover.situation}</p>
                    </div>
                  )}
                  {medicalData.clinicalHandover.background && (
                    <div>
                      <p className="font-medium text-green-700">Background</p>
                      <p className="text-green-900">{medicalData.clinicalHandover.background}</p>
                    </div>
                  )}
                  {medicalData.clinicalHandover.assessment && (
                    <div>
                      <p className="font-medium text-green-700">Assessment</p>
                      <p className="text-green-900">{medicalData.clinicalHandover.assessment}</p>
                    </div>
                  )}
                  {medicalData.clinicalHandover.recommendation && (
                    <div>
                      <p className="font-medium text-green-700">Recommendation</p>
                      <p className="text-green-900">{medicalData.clinicalHandover.recommendation}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
