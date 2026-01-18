'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/trpc/react';
import {
  HelpCircle,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Filter,
  X,
} from 'lucide-react';

// Types
type TicketStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory = 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'other';

// Status configuration
const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: <AlertCircle className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
  waiting_on_user: { label: 'Waiting on You', color: 'bg-orange-100 text-orange-700', icon: <MessageSquare className="w-4 h-4" /> },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-600', icon: <CheckCircle2 className="w-4 h-4" /> },
};

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-600' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-600' },
};

const categoryLabels: Record<TicketCategory, string> = {
  technical: 'Technical Issue',
  billing: 'Billing',
  account: 'Account',
  feature_request: 'Feature Request',
  bug_report: 'Bug Report',
  other: 'Other',
};


// Create Ticket Modal Component
function CreateTicketModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialSubject,
  initialDescription,
  initialCategory,
  initialPriority,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  initialSubject?: string;
  initialDescription?: string;
  initialCategory?: TicketCategory;
  initialPriority?: TicketPriority;
}) {
  const [subject, setSubject] = useState(initialSubject || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [category, setCategory] = useState<TicketCategory>(initialCategory || 'technical');
  const [priority, setPriority] = useState<TicketPriority>(initialPriority || 'medium');
  const [error, setError] = useState<string | null>(null);
  
  // Update form when initial values change (e.g., from URL params)
  useEffect(() => {
    if (initialSubject) setSubject(initialSubject);
    if (initialDescription) setDescription(initialDescription);
    if (initialCategory) setCategory(initialCategory);
    if (initialPriority) setPriority(initialPriority);
  }, [initialSubject, initialDescription, initialCategory, initialPriority]);

  const createTicket = api.support.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
      // Reset form
      setSubject('');
      setDescription('');
      setCategory('technical');
      setPriority('medium');
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    createTicket.mutate({ subject, description, category, priority });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Create Support Ticket</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500"
              >
                {Object.entries(priorityConfig).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe your issue in detail..."
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500 resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-slate-400 mt-1">{description.length}/5000 characters</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTicket.isPending}
              className="flex-1 px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors disabled:opacity-50"
            >
              {createTicket.isPending ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Ticket Card Component
function TicketCard({ ticket }: { ticket: {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}}) {
  const status = statusConfig[ticket.status as TicketStatus] || statusConfig.open;
  const priority = priorityConfig[ticket.priority as TicketPriority] || priorityConfig.medium;

  return (
    <Link
      href={`/support/${ticket.id}`}
      className="block p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priority.color}`}>
              {priority.label}
            </span>
          </div>
          <h3 className="font-medium text-slate-800 truncate">{ticket.subject}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {categoryLabels[ticket.category as TicketCategory] || ticket.category} • 
            Created {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
      </div>
    </Link>
  );
}

// Empty State Component
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
        <HelpCircle className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-800 mb-2">No support tickets</h3>
      <p className="text-slate-500 mb-6 max-w-sm mx-auto">
        Need help? Create a support ticket and our team will assist you.
      </p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create Ticket
      </button>
    </div>
  );
}


// Main Client Component
export default function SupportPageClient() {
  const searchParams = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  
  // Pre-filled ticket data from URL params (e.g., from intake error recovery - Requirement 7.4)
  const [initialTicketData, setInitialTicketData] = useState<{
    subject?: string;
    description?: string;
    category?: TicketCategory;
    priority?: TicketPriority;
  }>({});

  const utils = api.useUtils();
  
  const { data, isLoading, refetch } = api.support.getMyTickets.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 50,
  });

  const tickets = data?.tickets ?? [];

  // Handle URL params for auto-opening support ticket from error recovery flow - Requirement 7.4
  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    const errorCount = searchParams.get('errorCount');
    const context = searchParams.get('context');
    
    if (context === 'intake_errors' && sessionId) {
      // Pre-fill ticket with error context
      const subject = 'Intake Chat - Multiple Errors Occurred';
      const description = `I encountered multiple errors during my medical intake session.

Session ID: ${sessionId}
Error Count: ${errorCount || 'Unknown'}
Context: Intake Chat Errors

Please help me resolve this issue so I can complete my intake.

[Please describe what you were trying to do when the errors occurred]`;
      
      setInitialTicketData({
        subject,
        description,
        category: 'technical',
        priority: errorCount && parseInt(errorCount) >= 5 ? 'high' : 'medium',
      });
      
      // Auto-open the create ticket modal
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  const handleCreateSuccess = () => {
    refetch();
    utils.support.getMyTickets.invalidate();
    // Clear initial data after successful creation
    setInitialTicketData({});
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support</h1>
          <p className="text-slate-500 mt-1">Get help with any issues or questions</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-500 flex items-center gap-1">
          <Filter className="w-4 h-4" /> Filter:
        </span>
        {(['all', 'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-medical-100 text-medical-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status === 'all' ? 'All' : statusConfig[status].label}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            Your Tickets {data?.total ? `(${data.total})` : ''}
          </h2>
        </div>

        {tickets.length === 0 ? (
          <EmptyState onCreateClick={() => setIsCreateModalOpen(true)} />
        ) : (
          <div>
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          // Clear initial data when modal is closed
          setInitialTicketData({});
        }}
        onSuccess={handleCreateSuccess}
        initialSubject={initialTicketData.subject}
        initialDescription={initialTicketData.description}
        initialCategory={initialTicketData.category}
        initialPriority={initialTicketData.priority}
      />
    </div>
  );
}
