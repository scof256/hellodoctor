'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { api } from '@/trpc/react';

interface SessionSelectorProps {
  connectionId: string;
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  disabled?: boolean;
}

/**
 * SessionSelector Component
 * 
 * Allows users to switch between intake sessions for the same connection.
 * Requirements: 8.1, 8.2
 */
export default function SessionSelector({
  connectionId,
  currentSessionId,
  onSessionSelect,
  disabled = false,
}: SessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch all sessions for this connection
  const { data: sessionsData, isLoading } = api.intake.getMyIntakeSessions.useQuery(
    { connectionId },
    { enabled: !!connectionId }
  );

  const sessions = sessionsData?.sessions ?? [];

  // Get current session details
  const currentSession = useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find(s => s.id === currentSessionId);
  }, [currentSessionId, sessions]);

  // Format session display - use name if available, otherwise date + completeness
  // Requirement 4.4
  const formatSessionLabel = (session: { 
    id: string; 
    name: string | null;
    status: string; 
    completeness: number; 
    createdAt: Date;
  }) => {
    if (session.name) {
      return session.name;
    }
    const date = new Date(session.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${date} - ${session.completeness}%`;
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
      case 'reviewed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'reviewed':
        return 'Reviewed';
      case 'in_progress':
        return 'In Progress';
      case 'not_started':
        return 'Not Started';
      default:
        return status;
    }
  };

  // Don't show if only one session or no sessions
  if (sessions.length <= 1) {
    return null;
  }

  const handleSelect = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      // Save draft to localStorage before switching - Requirement 8.2
      const draftKey = `intake-draft-${currentSessionId}`;
      const inputElement = document.querySelector('textarea[placeholder*="Type"]') as HTMLTextAreaElement;
      if (inputElement?.value) {
        localStorage.setItem(draftKey, inputElement.value);
      }
      
      onSessionSelect(sessionId);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : (
          <>
            {currentSession && getStatusIcon(currentSession.status)}
            <span className="text-slate-700">
              {currentSession ? formatSessionLabel(currentSession) : 'Select Session'}
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="py-1 max-h-64 overflow-y-auto">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleSelect(session.id)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between gap-2 ${
                    session.id === currentSessionId ? 'bg-medical-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(session.status)}
                    <span className={`truncate ${session.id === currentSessionId ? 'text-medical-700 font-medium' : 'text-slate-700'}`}>
                      {formatSessionLabel(session)}
                    </span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                    session.status === 'ready' || session.status === 'reviewed'
                      ? 'bg-green-100 text-green-700'
                      : session.status === 'in_progress'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {getStatusLabel(session.status)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
