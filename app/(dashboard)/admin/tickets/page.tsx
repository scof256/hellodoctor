'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  TicketIcon,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  User,
  UserCheck,
  X,
  RefreshCw,
} from 'lucide-react';

// Types
type TicketStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory = 'technical' | 'billing' | 'account' | 'feature_request' | 'bug_report' | 'other';

// Status configuration
const statusConfig: Record<TicketStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: <AlertCircle className="w-4 h-4" /> },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
  waiting_on_user: { label: 'Waiting', color: 'bg-orange-100 text-orange-700', icon: <MessageSquare className="w-4 h-4" /> },
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
  technical: 'Technical',
  billing: 'Billing',
  account: 'Account',
  feature_request: 'Feature',
  bug_report: 'Bug',
  other: 'Other',
};

// Stats Card Component
function StatsCard({ 
  title, 
  value, 
  icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  color: 'blue' | 'yellow' | 'orange' | 'green' | 'red' | 'slate';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="p-3 rounded-lg bg-white/50">{icon}</div>
      </div>
    </div>
  );
}

// Ticket Row Component
function TicketRow({ 
  ticket, 
  onAssign, 
  onStatusChange 
}: { 
  ticket: {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    responseCount: number;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      imageUrl: string | null;
    } | null;
    assignedUser: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
    } | null;
  };
  onAssign: (ticketId: string) => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
}) {
  const status = statusConfig[ticket.status as TicketStatus] || statusConfig.open;
  const priority = priorityConfig[ticket.priority as TicketPriority] || priorityConfig.medium;
  const userName = ticket.user 
    ? `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() || ticket.user.email
    : 'Unknown';

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-medium">
            {ticket.user?.imageUrl ? (
              <img
                src={ticket.user.imageUrl}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <Link 
              href={`/admin/tickets/${ticket.id}`}
              className="font-medium text-slate-800 hover:text-medical-600 truncate block"
            >
              {ticket.subject}
            </Link>
            <p className="text-xs text-slate-500 truncate">{userName}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priority.color}`}>
          {priority.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {categoryLabels[ticket.category as TicketCategory] || ticket.category}
      </td>
      <td className="px-4 py-3">
        {ticket.assignedUser ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 text-xs">
              {ticket.assignedUser.imageUrl ? (
                <img
                  src={ticket.assignedUser.imageUrl}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                (ticket.assignedUser.firstName?.charAt(0) || 'A')
              )}
            </div>
            <span className="text-sm text-slate-600">
              {ticket.assignedUser.firstName}
            </span>
          </div>
        ) : (
          <button
            onClick={() => onAssign(ticket.id)}
            className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
          >
            <UserCheck className="w-4 h-4" />
            Assign
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {ticket.responseCount}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        {new Date(ticket.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/admin/tickets/${ticket.id}`}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 inline-block"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );
}

// Assign Modal Component
function AssignModal({ 
  isOpen, 
  ticketId, 
  onClose, 
  onAssign 
}: { 
  isOpen: boolean; 
  ticketId: string | null;
  onClose: () => void;
  onAssign: (ticketId: string, userId: string | null) => void;
}) {
  const { data: admins } = api.admin.getUsers.useQuery(
    { role: 'super_admin', limit: 50 },
    { enabled: isOpen }
  );

  if (!isOpen || !ticketId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Assign Ticket</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          <button
            onClick={() => {
              onAssign(ticketId, null);
              onClose();
            }}
            className="w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <X className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="font-medium text-slate-800">Unassign</p>
              <p className="text-sm text-slate-500">Remove current assignment</p>
            </div>
          </button>
          {admins?.users.map((admin) => (
            <button
              key={admin.id}
              onClick={() => {
                onAssign(ticketId, admin.id);
                onClose();
              }}
              className="w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 font-medium">
                {admin.imageUrl ? (
                  <img
                    src={admin.imageUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  (admin.firstName?.charAt(0) || admin.email.charAt(0)).toUpperCase()
                )}
              </div>
              <div>
                <p className="font-medium text-slate-800">
                  {admin.firstName} {admin.lastName}
                </p>
                <p className="text-sm text-slate-500">{admin.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminTicketsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; ticketId: string | null }>({
    isOpen: false,
    ticketId: null,
  });

  const utils = api.useUtils();

  // Fetch tickets
  const { data: ticketsData, isLoading: ticketsLoading, refetch } = api.support.getAllTickets.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
    search: searchQuery || undefined,
    limit: 50,
  });

  // Fetch stats
  const { data: statsData } = api.support.getStats.useQuery();

  // Mutations
  const assignMutation = api.support.assignTicket.useMutation({
    onSuccess: () => {
      utils.support.getAllTickets.invalidate();
      utils.support.getStats.invalidate();
    },
  });

  const updateStatusMutation = api.support.updateStatus.useMutation({
    onSuccess: () => {
      utils.support.getAllTickets.invalidate();
      utils.support.getStats.invalidate();
    },
  });

  const handleAssign = (ticketId: string, userId: string | null) => {
    assignMutation.mutate({ ticketId, assignedTo: userId });
  };

  const handleStatusChange = (ticketId: string, status: TicketStatus) => {
    updateStatusMutation.mutate({ ticketId, status });
  };

  const tickets = ticketsData?.tickets ?? [];
  const stats = statsData ?? {
    open: 0,
    inProgress: 0,
    waitingOnUser: 0,
    resolved: 0,
    closed: 0,
    unassigned: 0,
    urgentOrHigh: 0,
    avgResolutionTimeHours: 0,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Support Tickets</h1>
          <p className="text-slate-500 mt-1">Manage and respond to user support requests</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatsCard
          title="Open"
          value={stats.open}
          icon={<AlertCircle className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgress}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
        />
        <StatsCard
          title="Waiting"
          value={stats.waitingOnUser}
          icon={<MessageSquare className="w-5 h-5" />}
          color="orange"
        />
        <StatsCard
          title="Unassigned"
          value={stats.unassigned}
          icon={<User className="w-5 h-5" />}
          color="red"
        />
        <StatsCard
          title="Urgent/High"
          value={stats.urgentOrHigh}
          icon={<AlertCircle className="w-5 h-5" />}
          color="red"
        />
        <StatsCard
          title="Avg Resolution"
          value={stats.avgResolutionTimeHours}
          icon={<Clock className="w-5 h-5" />}
          color="green"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'all')}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500"
          >
            <option value="all">All Priority</option>
            {Object.entries(priorityConfig).map(([value, config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Ticket</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Assigned</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Replies</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ticketsLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="animate-pulse flex flex-col items-center">
                      <div className="w-8 h-8 bg-slate-200 rounded-full mb-2"></div>
                      <div className="h-4 bg-slate-200 rounded w-32"></div>
                    </div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <TicketIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">No tickets found</p>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    onAssign={(id) => setAssignModal({ isOpen: true, ticketId: id })}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination info */}
        {ticketsData && (
          <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            Showing {tickets.length} of {ticketsData.total} tickets
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <AssignModal
        isOpen={assignModal.isOpen}
        ticketId={assignModal.ticketId}
        onClose={() => setAssignModal({ isOpen: false, ticketId: null })}
        onAssign={handleAssign}
      />
    </div>
  );
}
