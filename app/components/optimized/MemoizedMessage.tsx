'use client';

import React, { useMemo } from 'react';
import { Message, AgentRole } from '../../types';
import { Search, UserCog, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/**
 * Memoized Message Component
 * Requirements: 2.1, 2.4
 * 
 * This component uses React.memo with a custom comparison function to prevent
 * unnecessary re-renders when the message list updates. The markdown parsing
 * is memoized per message to avoid redundant computation.
 */

interface MemoizedMessageProps {
  message: Message;
  variant?: 'patient' | 'doctor';
  onImageClick?: (img: string) => void;
}

const AGENT_COLORS: Record<AgentRole, string> = {
  'Triage': 'bg-teal-600',
  'ClinicalInvestigator': 'bg-blue-600',
  'RecordsClerk': 'bg-orange-500',
  'HistorySpecialist': 'bg-indigo-600',
  'HandoverSpecialist': 'bg-green-600'
};

const AGENT_LABELS: Record<AgentRole, string> = {
  'Triage': 'Triage Specialist',
  'ClinicalInvestigator': 'Clinical Investigator',
  'RecordsClerk': 'Medical Records',
  'HistorySpecialist': 'History & Intake',
  'HandoverSpecialist': 'Senior Attending'
};

// Helper to determine if image is a URL or base64
const getImageSrc = (img: string): string => {
  if (img.startsWith('http://') || img.startsWith('https://')) {
    return img;
  }
  return `data:image/jpeg;base64,${img}`;
};

const MemoizedMessageComponent: React.FC<MemoizedMessageProps> = ({
  message,
  variant = 'patient',
  onImageClick,
}) => {
  const isDoctor = variant === 'doctor';

  const theme = isDoctor ? {
    userBubble: 'bg-purple-700',
    aiBubble: 'bg-white border-purple-200',
    accentText: 'text-purple-700',
  } : {
    userBubble: 'bg-medical-600',
    aiBubble: 'bg-white border-slate-200',
    accentText: 'text-medical-600',
  };

  const getBubbleStyle = (msg: Message): string => {
    if (msg.role === 'user') {
      return `${theme.userBubble} text-white rounded-br-md`;
    }
    if (msg.role === 'doctor') {
      return `bg-indigo-900 text-white border-indigo-700 rounded-bl-md shadow-indigo-100`;
    }
    return `${theme.aiBubble} text-slate-800 border rounded-bl-md`;
  };

  // Memoize markdown parsing per message (Requirements: 2.4)
  const parsedContent = useMemo(() => {
    return (
      <ReactMarkdown>{message.text}</ReactMarkdown>
    );
  }, [message.text]);

  return (
    <div
      className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] min-w-0 rounded-2xl p-4 shadow-sm ${getBubbleStyle(message)}`}
      >
        {message.role === 'doctor' && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
            <div className="bg-white p-1 rounded-full text-indigo-900">
              <UserCog className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Dr. Smith (Attending)</span>
          </div>
        )}

        {message.role === 'model' && message.activeAgent && !isDoctor && (
          <div className="flex items-center gap-2 mb-2">
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${AGENT_COLORS[message.activeAgent] || 'bg-slate-400'}`}>
              <Bot className="w-3 h-3" />
              {AGENT_LABELS[message.activeAgent] || message.activeAgent}
            </div>
          </div>
        )}

        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {message.images.map((img, idx) => (
              <img
                key={idx}
                src={getImageSrc(img)}
                alt="User upload"
                className="h-32 w-auto rounded-lg object-cover border border-white/20 cursor-zoom-in hover:opacity-90 transition-opacity"
                onClick={() => onImageClick?.(img)}
              />
            ))}
          </div>
        )}

        <div className={`prose prose-sm max-w-none min-w-0 whitespace-pre-wrap break-words ${
          message.role === 'user' || message.role === 'doctor'
            ? 'prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white'
            : `text-slate-700 prose-p:leading-relaxed prose-strong:${theme.accentText} prose-strong:font-bold prose-headings:text-slate-800`
        }`}>
          {parsedContent}
        </div>

        {message.groundingMetadata?.groundingChunks && (
          <div className="mt-3 pt-3 border-t border-slate-200/50 text-xs">
            <div className="flex items-center gap-1 text-slate-500 mb-1 font-semibold">
              <Search className="w-3 h-3" /> Sources
            </div>
            <div className="flex flex-wrap gap-2">
              {(message.groundingMetadata.groundingChunks as Array<{ web?: { uri?: string; title?: string } }>).map((chunk, i) =>
                chunk.web?.uri ? (
                  <a
                    key={i}
                    href={chunk.web.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded truncate max-w-[200px] flex items-center gap-1 transition-colors"
                  >
                    {chunk.web.title || new URL(chunk.web.uri).hostname}
                  </a>
                ) : null
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Custom comparison function for React.memo
 * Only re-renders if the message ID changes (Requirements: 2.1)
 */
const arePropsEqual = (
  prevProps: MemoizedMessageProps,
  nextProps: MemoizedMessageProps
): boolean => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.variant === nextProps.variant
  );
};

export const MemoizedMessage = React.memo(MemoizedMessageComponent, arePropsEqual);

export default MemoizedMessage;
