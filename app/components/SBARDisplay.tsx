'use client';

import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, History, AlertCircle, Check, Clock, Loader2, Copy, Download, CheckCircle } from 'lucide-react';
import { SBARContent } from '../lib/sbar-extractor';

interface SBARDisplayProps {
  content: SBARContent | null;
  isLoading?: boolean;
  lastUpdated?: number | null;
  error?: string | null;
}

/**
 * SBARDisplay Component
 * 
 * Displays SBAR-formatted clinical analysis using color-coded cards.
 * Supports loading states, error handling, and timestamp display.
 * Preserves scroll position during content updates with 50px tolerance.
 */
export const SBARDisplay: React.FC<SBARDisplayProps> = ({
  content,
  isLoading = false,
  lastUpdated = null,
  error = null,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollPositionRef = useRef<number>(0);
  const previousContentRef = useRef<SBARContent | null>(null);
  const [liveRegionMessage, setLiveRegionMessage] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Capture scroll position before content update
  useEffect(() => {
    if (scrollContainerRef.current && content !== previousContentRef.current) {
      // Store current scroll position before update
      previousScrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
  }, [content]);

  // Restore scroll position after content renders
  useEffect(() => {
    if (scrollContainerRef.current && content && content !== previousContentRef.current) {
      const container = scrollContainerRef.current;
      const savedScrollPosition = previousScrollPositionRef.current;
      
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (container && savedScrollPosition > 0) {
          container.scrollTop = savedScrollPosition;
        }
      });
      
      // Update previous content reference
      previousContentRef.current = content;
    }
  }, [content]);

  // Screen reader announcements for loading/complete states
  useEffect(() => {
    if (isLoading) {
      setLiveRegionMessage('Updating clinical analysis...');
    } else if (content && content !== previousContentRef.current) {
      setLiveRegionMessage('Clinical analysis updated successfully');
      // Clear message after announcement
      const timer = setTimeout(() => setLiveRegionMessage(''), 1000);
      return () => clearTimeout(timer);
    } else if (error) {
      setLiveRegionMessage(`Analysis error: ${error}`);
      const timer = setTimeout(() => setLiveRegionMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, content, error]);

  /**
   * Copy SBAR content to clipboard
   */
  const handleCopyToClipboard = async () => {
    if (!content) return;
    
    const sbarText = formatSBARAsText(content);
    
    try {
      await navigator.clipboard.writeText(sbarText);
      setCopySuccess(true);
      setLiveRegionMessage('SBAR report copied to clipboard');
      
      // Reset success indicator after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
        setLiveRegionMessage('');
      }, 2000);
    } catch (err) {
      setLiveRegionMessage('Failed to copy to clipboard');
      setTimeout(() => setLiveRegionMessage(''), 3000);
    }
  };

  /**
   * Export SBAR content to file
   */
  const handleExportToFile = () => {
    if (!content) return;
    
    const sbarText = formatSBARAsText(content);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `SBAR-Report-${timestamp}.txt`;
    
    try {
      const blob = new Blob([sbarText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setLiveRegionMessage('SBAR report exported successfully');
      setTimeout(() => setLiveRegionMessage(''), 2000);
    } catch (err) {
      setLiveRegionMessage('Failed to export SBAR report');
      setTimeout(() => setLiveRegionMessage(''), 3000);
    }
  };

  return (
    <div ref={scrollContainerRef} className="space-y-4">
      {/* ARIA live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveRegionMessage}
      </div>
      
      {/* Header with Timestamp and Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Timestamp Display */}
        {lastUpdated && (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Last updated: {formatTimestamp(lastUpdated)}
          </div>
        )}
        
        {/* Action Buttons */}
        {content && !isLoading && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToClipboard}
              disabled={!content}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Copy SBAR report to clipboard"
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleExportToFile}
              disabled={!content}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Export SBAR report to file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Updating analysis...
        </div>
      )}
      
      {/* Error Display - preserves existing content */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {/* SBAR Cards */}
      {content && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SBARCard
            title="Situation"
            icon={<User className="w-4 h-4" />}
            content={content.situation}
            colorTheme="blue"
          />
          <SBARCard
            title="Background"
            icon={<History className="w-4 h-4" />}
            content={content.background}
            colorTheme="slate"
          />
          <SBARCard
            title="Assessment"
            icon={<AlertCircle className="w-4 h-4" />}
            content={content.assessment}
            colorTheme="amber"
          />
          <SBARCard
            title="Recommendation"
            icon={<Check className="w-4 h-4" />}
            content={content.recommendation}
            colorTheme="emerald"
          />
        </div>
      )}
    </div>
  );
};

/**
 * SBARCard Component
 * 
 * Individual card for displaying one section of SBAR format.
 * Imported from MedicalSidebar pattern.
 * Memoized to prevent unnecessary re-renders.
 */
interface SBARCardProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  colorTheme: 'blue' | 'slate' | 'amber' | 'emerald';
}

const SBARCard: React.FC<SBARCardProps> = React.memo(({ title, icon, content, colorTheme }) => {
  const styles = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      headerText: 'text-blue-800',
      headerBg: 'bg-blue-100',
      bodyText: 'text-blue-900',
      prose: 'prose-headings:text-blue-800 prose-strong:text-blue-900'
    },
    slate: {
      border: 'border-slate-200',
      bg: 'bg-slate-50',
      headerText: 'text-slate-700',
      headerBg: 'bg-slate-200',
      bodyText: 'text-slate-800',
      prose: 'prose-headings:text-slate-700 prose-strong:text-slate-900'
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      headerText: 'text-amber-800',
      headerBg: 'bg-amber-100',
      bodyText: 'text-amber-900',
      prose: 'prose-headings:text-amber-800 prose-strong:text-amber-900'
    },
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      headerText: 'text-emerald-800',
      headerBg: 'bg-emerald-100',
      bodyText: 'text-emerald-900',
      prose: 'prose-headings:text-emerald-800 prose-strong:text-emerald-900'
    }
  };

  const currentStyle = styles[colorTheme];

  return (
    <section 
      className={`border ${currentStyle.border} rounded-xl overflow-hidden shadow-sm`}
      aria-labelledby={`sbar-${title.toLowerCase()}-heading`}
    >
      <div className={`${currentStyle.headerBg} p-3 flex items-center gap-2 border-b ${currentStyle.border}`}>
        <span aria-hidden="true">{icon}</span>
        <h3 
          id={`sbar-${title.toLowerCase()}-heading`}
          className={`text-xs font-bold uppercase tracking-widest ${currentStyle.headerText}`}
        >
          {title}
        </h3>
      </div>
      <div className={`${currentStyle.bg} p-4 text-sm leading-relaxed ${currentStyle.bodyText}`}>
        <div className={`prose prose-sm max-w-none ${currentStyle.prose} prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-headings:uppercase`}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
});

SBARCard.displayName = 'SBARCard';

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  
  // Less than 1 minute ago
  if (diffSecs < 60) {
    return 'just now';
  }
  
  // Less than 1 hour ago
  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // Less than 24 hours ago
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  // Format as time if today, otherwise include date
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format SBAR content as plain text for copying/exporting
 */
function formatSBARAsText(content: SBARContent): string {
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `SBAR CLINICAL REPORT
Generated: ${timestamp}

═══════════════════════════════════════════════════════════════

SITUATION
${content.situation}

───────────────────────────────────────────────────────────────

BACKGROUND
${content.background}

───────────────────────────────────────────────────────────────

ASSESSMENT
${content.assessment}

───────────────────────────────────────────────────────────────

RECOMMENDATION
${content.recommendation}

═══════════════════════════════════════════════════════════════

This report was generated by the MeetDoc clinical decision support system.
`;
}
