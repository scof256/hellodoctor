'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/trpc/react';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  User,
} from 'lucide-react';

// Types
type TicketStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory = 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'other';

// Status configuration
const statusConfig: Record<TicketStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <AlertCircle className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: <Clock className="w-4 h-4" /> },
  waiting_on_user: { label: 'Waiting on You', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: <MessageSquare className="w-4 h-4" /> },
  resolved: { label: 'Resolved', color: 'text-green-700', bgColor: 'bg-green-100', icon: <CheckCircle2 className="w-4 h-4" /> },
  closed: { label: 'Closed', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: <CheckCircle2 className="w-4 h-4" /> },
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

// Response Component
function ResponseItem({ response }: { response: {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    primaryRole: string;
  } | null;
}}) {
  const isAdmin = response.user?.primaryRole === 'super_admin';
  const userName = response.user 
    ? `${response.user.firstName || ''} ${response.user.lastName || ''}`.trim() || 'User'
    : 'Unknown';

  return (
    <div className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isAdmin ? 'bg-medical-100 text-medical-600' : 'bg-slate-100 text-slate-600'
      }`}>
        {response.user?.imageUrl ? (
          <img
            src={response.user.imageUrl}
            alt={userName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <User className="w-5 h-5" />
        )}
      </div>
      <div className={`flex-1 max-w-[80%] ${isAdmin ? 'text-right' : ''}`}>
        <div className={`inline-block p-4 rounded-xl ${
          isAdmin 
            ? 'bg-medical-50 text-slate-800' 
            : 'bg-slate-100 text-slate-800'
        }`}>
          <p className="whitespace-pre-wrap">{response.content}</p>
        </div>
        <div className={`flex items-center gap-2 mt-1 text-xs text-slate-400 ${isAdmin ? 'justify-end' : ''}`}>
          <span className="font-medium">{userName}</span>
          {isAdmin && <span className="px-1.5 py-0.5 bg-medical-100 text-medical-600 rounded text-xs">Support</span>}
          <span>•</span>
          <span>{new Date(response.createdAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.ticketId as string;
  
  const [replyContent, setReplyContent] = useState('');

  const utils = api.useUtils();

  const { data: ticket, isLoading, error } = api.support.getTicketById.useQuery(
    { ticketId },
    { enabled: !!ticketId }
  );

  const respondMutation = api.support.respond.useMutation({
    onSuccess: () => {
      setReplyContent('');
      utils.support.getTicketById.invalidate({ ticketId });
    },
  });

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    respondMutation.mutate({
      ticketId,
      content: replyContent,
      isInternal: false,
    });
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

  if (error || !ticket) {
    return (
      <div className="space-y-6">
        <Link
          href="/support"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Support
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Ticket Not Found</h2>
          <p className="text-slate-500">The ticket you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
        </div>
      </div>
    );
  }

  const status = statusConfig[ticket.status as TicketStatus] || statusConfig.open;
  const priority = priorityConfig[ticket.priority as TicketPriority] || priorityConfig.medium;
  const isTicketClosed = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/support"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Support
      </Link>

      {/* Ticket Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
                {status.icon}
                {status.label}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${priority.color}`}>
                {priority.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">{ticket.subject}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Category</p>
            <p className="font-medium text-slate-800">
              {categoryLabels[ticket.category as TicketCategory] || ticket.category}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Created</p>
            <p className="font-medium text-slate-800">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Last Updated</p>
            <p className="font-medium text-slate-800">
              {new Date(ticket.updatedAt).toLocaleDateString()}
            </p>
          </div>
          {ticket.assignedUser && (
            <div>
              <p className="text-slate-500">Assigned To</p>
              <p className="font-medium text-slate-800">
                {ticket.assignedUser.firstName} {ticket.assignedUser.lastName}
              </p>
            </div>
          )}
        </div>

        {/* Original Description */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 mb-2">Description</h3>
          <p className="text-slate-800 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            Conversation {ticket.responses?.length ? `(${ticket.responses.length})` : ''}
          </h2>
        </div>

        {/* Messages */}
        <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
          {ticket.responses?.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No responses yet</p>
            </div>
          ) : (
            ticket.responses?.map((response) => (
              <ResponseItem key={response.id} response={response} />
            ))
          )}
        </div>

        {/* Reply Form */}
        {!isTicketClosed ? (
          <form onSubmit={handleSubmitReply} className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex gap-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500 resize-none"
                maxLength={5000}
              />
              <button
                type="submit"
                disabled={!replyContent.trim() || respondMutation.isPending}
                className="self-end px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {respondMutation.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {respondMutation.error && (
              <p className="text-red-500 text-sm mt-2">{respondMutation.error.message}</p>
            )}
          </form>
        ) : (
          <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-slate-500">
            This ticket is {ticket.status}. You cannot add more replies.
          </div>
        )}
      </div>
    </div>
  );
}
