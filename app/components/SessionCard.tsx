'use client';

import { useState } from 'react';
import { 
  Play, 
  Eye, 
  RotateCcw, 
  Trash2, 
  Calendar, 
  MoreVertical,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';

/**
 * SessionCard Component
 * 
 * Displays individual session information with quick actions.
 * Requirements: 1.2, 1.4, 4.1, 4.2, 4.3, 7.1, 7.2, 7.3, 7.4, 7.5
 */

export interface SessionCardProps {
  session: {
    id: string;
    name: string | null;
    status: 'not_started' | 'in_progress' | 'ready' | 'reviewed';
    completeness: number;
    currentAgent: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    linkedAppointment: {
      id: string;
      scheduledAt: Date;
      duration: number;
      status: string;
    } | null;
  };
  onContinue: (sessionId: string) => void;
  onView: (sessionId: string) => void;
  onReset: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onBookAppointment: (sessionId: string) => void;
}

const statusConfig = {
  not_started: {
    label: 'Not Started',
    color: 'bg-slate-100 text-slate-600',
    icon: FileText,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-600',
    icon: Clock,
  },
  ready: {
    label: 'Ready',
    color: 'bg-green-100 text-green-600',
    icon: CheckCircle2,
  },
  reviewed: {
    label: 'Reviewed',
    color: 'bg-purple-100 text-purple-600',
    icon: Eye,
  },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Get the display name for a session.
 * Returns the session name if available, otherwise falls back to creation timestamp.
 * Requirements: 4.1, 4.2
 */
export function getSessionDisplayName(session: { name: string | null; createdAt: Date }): string {
  if (session.name) {
    return session.name;
  }
  return formatDateTime(session.createdAt);
}

export function SessionCard({
  session,
  onContinue,
  onView,
  onReset,
  onDelete,
  onBookAppointment,
}: SessionCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  
  const config = statusConfig[session.status];
  const StatusIcon = config.icon;
  const isActive = session.status === 'not_started' || session.status === 'in_progress';
  const isCompleted = session.status === 'ready' || session.status === 'reviewed';
  const canDelete = isActive && !session.linkedAppointment;
  const canBookAppointment = session.status === 'ready' && !session.linkedAppointment;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {/* Session Name - Primary Identifier */}
          <h3 className="font-medium text-slate-800 truncate mb-1">
            {getSessionDisplayName(session)}
          </h3>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {config.label}
            </span>
            {session.completeness > 0 && (
              <span className="text-xs text-slate-500">
                {session.completeness}% complete
              </span>
            )}
          </div>
        </div>
        
        {/* Dropdown Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4 text-slate-400" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]">
                <button
                  onClick={() => {
                    onReset(session.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                {canDelete && (
                  <button
                    onClick={() => {
                      onDelete(session.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {session.completeness > 0 && (
        <div className="mb-3">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${session.completeness}%` }}
            />
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="text-xs text-slate-500 space-y-1 mb-3">
        <div>Created: {formatDate(session.createdAt)}</div>
        <div>Updated: {formatDate(session.updatedAt)}</div>
        {session.currentAgent && (
          <div>Current stage: {session.currentAgent}</div>
        )}
      </div>

      {/* Linked Appointment */}
      {session.linkedAppointment && (
        <div className="mb-3 p-2 bg-teal-50 rounded-lg border border-teal-100">
          <div className="flex items-center gap-2 text-sm text-teal-700">
            <Calendar className="w-4 h-4" />
            <span>Appointment: {formatDateTime(session.linkedAppointment.scheduledAt)}</span>
          </div>
          <div className="text-xs text-teal-600 mt-1">
            Status: {session.linkedAppointment.status}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {isActive && (
          <button
            onClick={() => onContinue(session.id)}
            className="flex-1 px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Play className="w-4 h-4" />
            Continue
          </button>
        )}
        
        {isCompleted && (
          <button
            onClick={() => onView(session.id)}
            className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
        )}
        
        {canBookAppointment && (
          <button
            onClick={() => onBookAppointment(session.id)}
            className="flex-1 px-3 py-2 bg-teal-100 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            Book
          </button>
        )}
      </div>
    </div>
  );
}

export default SessionCard;
