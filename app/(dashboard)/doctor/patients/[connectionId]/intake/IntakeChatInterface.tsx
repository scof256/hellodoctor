'use client';

import { useEffect, useRef } from 'react';
import { Message, ContextLayer } from '@/types';
import { Bot, User, FileText, Activity, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import MessageInput from './MessageInput';

interface IntakeChatInterfaceProps {
  messages: Message[];
  patientName: string;
  connectionId: string;
  isReadOnly?: boolean;
  onMessageSent?: () => void;
}

const AGENT_COLORS = {
  'VitalsTriageAgent': 'bg-teal-500',
  'Triage': 'bg-teal-500',
  'ClinicalInvestigator': 'bg-blue-500',
  'RecordsClerk': 'bg-orange-500',
  'HistorySpecialist': 'bg-indigo-500',
  'HandoverSpecialist': 'bg-green-500'
} as const;

const AGENT_LABELS = {
  'VitalsTriageAgent': 'Vitals',
  'Triage': 'Triage',
  'ClinicalInvestigator': 'Investigator',
  'RecordsClerk': 'Records',
  'HistorySpecialist': 'History',
  'HandoverSpecialist': 'Summary'
} as const;

/**
 * IntakeChatInterface Component
 * 
 * Displays the intake conversation with visual differentiation between:
 * - Patient messages (gray, read-only, contextLayer: 'patient-intake')
 * - Doctor messages (purple, editable, contextLayer: 'doctor-enhancement')
 * - AI agent messages (gray, with agent badge)
 * 
 * Features:
 * - Chronological message ordering (Requirement 2.1)
 * - Message timestamps and sender identification (Requirement 2.7)
 * - Auto-scroll to newest messages (Requirement 2.8)
 * - Visual indicators for message types (Requirement 2.9, 5.7)
 * - Context layer separation (Requirement 2.2)
 * 
 * Requirements: 2.1, 2.2, 2.6, 2.7, 2.9, 5.7
 */
export default function IntakeChatInterface({
  messages,
  patientName,
  connectionId,
  isReadOnly = false,
  onMessageSent,
}: IntakeChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest messages (Requirement 2.8)
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Helper to get image source
  const getImageSrc = (img: string) => {
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return `data:image/jpeg;base64,${img}`;
  };

  // Helper to format timestamp (Requirement 2.7)
  const formatTimestamp = (timestamp: Date) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  // Helper to determine if message is from patient intake or doctor enhancement
  const getMessageContext = (msg: Message): ContextLayer => {
    // If contextLayer is explicitly set, use it
    if (msg.contextLayer) {
      return msg.contextLayer;
    }

    // Otherwise infer from role
    // Patient messages and AI messages are part of patient-intake
    // Doctor messages are part of doctor-enhancement
    if (msg.role === 'doctor') {
      return 'doctor-enhancement';
    }

    return 'patient-intake';
  };

  // Helper to get message type indicator
  const getMessageTypeIndicator = (msg: Message) => {
    const contextLayer = getMessageContext(msg);

    // Check if this is a test result or exam finding based on content or metadata
    // For now, we'll use simple heuristics - this can be enhanced with proper metadata
    const isTestResult = msg.text.toLowerCase().includes('test result') ||
      msg.text.toLowerCase().includes('lab result');
    const isExamFinding = msg.text.toLowerCase().includes('exam finding') ||
      msg.text.toLowerCase().includes('physical exam');

    if (contextLayer === 'doctor-enhancement') {
      if (isTestResult) {
        return {
          icon: <FileText className="w-3 h-3" />,
          label: 'Test Result',
          color: 'bg-medical-600',
        };
      }
      if (isExamFinding) {
        return {
          icon: <Activity className="w-3 h-3" />,
          label: 'Exam Finding',
          color: 'bg-purple-600',
        };
      }
      return {
        icon: <FileText className="w-3 h-3" />,
        label: 'Doctor Note',
        color: 'bg-purple-600',
      };
    }

    return null;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Read-only banner */}
      {isReadOnly && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            This intake session has been reviewed. This is a read-only view.
          </p>
        </div>
      )}

      {/* Messages container with auto-scroll (Requirement 2.8) */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-500">
              <Bot className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">No messages yet.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Render messages in chronological order (Requirement 2.1) */}
            {messages.map((msg) => {
              const contextLayer = getMessageContext(msg);
              const isPatientIntake = contextLayer === 'patient-intake';
              const isDoctorEnhancement = contextLayer === 'doctor-enhancement';
              const isUserMessage = msg.role === 'user';
              const isAIMessage = msg.role === 'model';
              const messageTypeIndicator = getMessageTypeIndicator(msg);

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUserMessage || isDoctorEnhancement ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[85%] min-w-0 rounded-2xl p-4 shadow-sm
                      ${isUserMessage && isPatientIntake
                        ? 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'
                        : isDoctorEnhancement
                          ? 'bg-purple-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'
                      }
                      ${messageTypeIndicator ? 'border-l-4' : ''}
                      ${messageTypeIndicator?.color === 'bg-medical-600' ? 'border-l-medical-600' : ''}
                      ${messageTypeIndicator?.color === 'bg-purple-600' ? 'border-l-purple-600' : ''}
                    `}
                  >
                    {/* Message header with sender identification and timestamp (Requirement 2.7) */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Sender identification */}
                        {isUserMessage && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-medium text-slate-600">
                              {patientName}
                            </span>
                          </div>
                        )}

                        {/* AI Agent badge */}
                        {isAIMessage && msg.activeAgent && (
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${AGENT_COLORS[msg.activeAgent] || 'bg-slate-400'}`}>
                            <Bot className="w-3 h-3" />
                            {AGENT_LABELS[msg.activeAgent] || msg.activeAgent}
                          </div>
                        )}

                        {/* Doctor enhancement indicator */}
                        {isDoctorEnhancement && (
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">
                              Doctor
                            </span>
                          </div>
                        )}

                        {/* Message type indicator (test result, exam finding) */}
                        {messageTypeIndicator && (
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${messageTypeIndicator.color}`}>
                            {messageTypeIndicator.icon}
                            {messageTypeIndicator.label}
                          </div>
                        )}

                        {/* Read-only indicator for patient intake messages */}
                        {isPatientIntake && !isAIMessage && (
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Read-only
                          </span>
                        )}
                      </div>

                      {/* Timestamp (Requirement 2.7) */}
                      <div className={`flex items-center gap-1 text-xs ${isDoctorEnhancement ? 'text-purple-200' : 'text-slate-400'}`}>
                        <Clock className="w-3 h-3" />
                        <span>{formatTimestamp(msg.timestamp)}</span>
                      </div>
                    </div>

                    {/* Images if present */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {msg.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={getImageSrc(img)}
                            alt={`Attachment ${idx + 1}`}
                            className="h-32 w-auto rounded-lg object-cover border-2 border-white/20"
                          />
                        ))}
                      </div>
                    )}

                    {/* Message content */}
                    <div
                      className={`
                        prose prose-sm max-w-none min-w-0 
                        whitespace-pre-wrap break-words 
                        prose-p:whitespace-pre-wrap prose-p:break-words
                        prose-p:leading-relaxed prose-p:my-1
                        prose-ul:my-1 prose-ol:my-1
                        prose-li:my-0.5
                        prose-headings:my-2 prose-headings:font-semibold
                        prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                        ${isDoctorEnhancement
                          ? 'prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:bg-purple-800'
                          : 'prose-slate text-slate-700 prose-strong:text-medical-600 prose-strong:font-bold prose-headings:text-slate-800'
                        }
                      `}
                    >
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Auto-scroll anchor (Requirement 2.8) */}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input Area - only show if not read-only */}
      {!isReadOnly && (
        <MessageInput
          connectionId={connectionId}
          onMessageSent={onMessageSent}
          disabled={isReadOnly}
        />
      )}
    </div>
  );
}
