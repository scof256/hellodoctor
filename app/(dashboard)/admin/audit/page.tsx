'use client';

import React, { useState } from 'react';
import { api } from '@/trpc/react';
import {
  FileText,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Activity,
  Shield,
  Settings,
  Users,
  Stethoscope,
  MessageSquare,
  Clock,
  X,
} from 'lucide-react';

// Action type labels and icons
const actionLabels: Record<string, string> = {
  login: 'User Login',
  logout: 'User Logout',
  login_failed: 'Failed Login',
  user_created: 'User Created',
  user_updated: 'User Updated',
  user_activated: 'User Activated',
  user_suspended: 'User Suspended',
  user_role_changed: 'Role Changed',
  doctor_created: 'Doctor Created',
  doctor_updated: 'Doctor Updated',
  doctor_approved: 'Doctor Approved',
  doctor_rejected: 'Doctor Rejected',
  patient_created: 'Patient Created',
  patient_updated: 'Patient Updated',
  connection_created: 'Connection Created',
  connection_disconnected: 'Connection Disconnected',
  appointment_created: 'Appointment Created',
  appointment_cancelled: 'Appointment Cancelled',
  appointment_completed: 'Appointment Completed',
  intake_started: 'Intake Started',
  intake_completed: 'Intake Completed',
  intake_reviewed: 'Intake Reviewed',
  message_sent: 'Message Sent',
  file_uploaded: 'File Uploaded',
  config_created: 'Config Created',
  config_updated: 'Config Updated',
  data_export: 'Data Exported',
};

const actionIcons: Record<string, React.ReactNode> = {
  login: <Activity className="w-4 h-4 text-green-500" />,
  logout: <Activity className="w-4 h-4 text-slate-500" />,
  login_failed: <Activity className="w-4 h-4 text-red-500" />,
  user_created: <Users className="w-4 h-4 text-green-500" />,
  user_updated: <Users className="w-4 h-4 text-blue-500" />,
  user_activated: <Users className="w-4 h-4 text-green-500" />,
  user_suspended: <Users className="w-4 h-4 text-red-500" />,
  user_role_changed: <Shield className="w-4 h-4 text-purple-500" />,
  doctor_created: <Stethoscope className="w-4 h-4 text-green-500" />,
  doctor_updated: <Stethoscope className="w-4 h-4 text-blue-500" />,
  doctor_approved: <Stethoscope className="w-4 h-4 text-green-500" />,
  doctor_rejected: <Stethoscope className="w-4 h-4 text-red-500" />,
  patient_created: <User className="w-4 h-4 text-green-500" />,
  patient_updated: <User className="w-4 h-4 text-blue-500" />,
  connection_created: <Users className="w-4 h-4 text-green-500" />,
  connection_disconnected: <Users className="w-4 h-4 text-orange-500" />,
  appointment_created: <Calendar className="w-4 h-4 text-green-500" />,
  appointment_cancelled: <Calendar className="w-4 h-4 text-red-500" />,
  appointment_completed: <Calendar className="w-4 h-4 text-green-500" />,
  intake_started: <FileText className="w-4 h-4 text-blue-500" />,
  intake_completed: <FileText className="w-4 h-4 text-green-500" />,
  intake_reviewed: <FileText className="w-4 h-4 text-purple-500" />,
  message_sent: <MessageSquare className="w-4 h-4 text-blue-500" />,
  file_uploaded: <FileText className="w-4 h-4 text-blue-500" />,
  config_created: <Settings className="w-4 h-4 text-purple-500" />,
  config_updated: <Settings className="w-4 h-4 text-purple-500" />,
  data_export: <Download className="w-4 h-4 text-blue-500" />,
};

const resourceTypeLabels: Record<string, string> = {
  user: 'User',
  doctor: 'Doctor',
  patient: 'Patient',
  connection: 'Connection',
  appointment: 'Appointment',
  intake_session: 'Intake Session',
  message: 'Message',
  file: 'File',
  notification: 'Notification',
  platform_config: 'Platform Config',
  audit_log: 'Audit Log',
};


// Filter Panel Component
interface FilterPanelProps {
  filters: {
    action: string;
    resourceType: string;
    startDate: string;
    endDate: string;
    search: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

function FilterPanel({ filters, onFilterChange, onClearFilters }: FilterPanelProps) {
  const hasActiveFilters = filters.action || filters.resourceType || filters.startDate || filters.endDate || filters.search;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-slate-800 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
          />
        </div>

        {/* Action Filter */}
        <select
          value={filters.action}
          onChange={(e) => onFilterChange('action', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
        >
          <option value="">All Actions</option>
          {Object.entries(actionLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Resource Type Filter */}
        <select
          value={filters.resourceType}
          onChange={(e) => onFilterChange('resourceType', e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
        >
          <option value="">All Resources</option>
          {Object.entries(resourceTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Start Date */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange('startDate', e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
          />
        </div>

        {/* End Date */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange('endDate', e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}

// Audit Log Row Component
interface AuditLogRowProps {
  log: {
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    user?: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    } | null;
  };
  onViewDetails: (log: AuditLogRowProps['log']) => void;
}

function AuditLogRow({ log, onViewDetails }: AuditLogRowProps) {
  const userName = log.user
    ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
    : 'System';

  const formattedDate = new Date(log.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(log.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100">
            {actionIcons[log.action] || <Activity className="w-4 h-4 text-slate-500" />}
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm">
              {actionLabels[log.action] || log.action}
            </p>
            <p className="text-xs text-slate-500">
              {resourceTypeLabels[log.resourceType] || log.resourceType}
              {log.resourceId && ` • ${log.resourceId.slice(0, 8)}...`}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 text-xs font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-600">{userName}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-slate-600">
          <p>{formattedDate}</p>
          <p className="text-xs text-slate-400">{formattedTime}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-slate-500 font-mono">
          {log.ipAddress || '-'}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onViewDetails(log)}
          className="text-sm text-medical-600 hover:text-medical-700 font-medium"
        >
          View Details
        </button>
      </td>
    </tr>
  );
}


// Details Modal Component
interface DetailsModalProps {
  log: AuditLogRowProps['log'] | null;
  onClose: () => void;
}

function DetailsModal({ log, onClose }: DetailsModalProps) {
  if (!log) return null;

  const userName = log.user
    ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
    : 'System';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Audit Log Details</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Action</p>
              <p className="font-medium text-slate-800 flex items-center gap-2 mt-1">
                {actionIcons[log.action] || <Activity className="w-4 h-4" />}
                {actionLabels[log.action] || log.action}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Resource Type</p>
              <p className="font-medium text-slate-800 mt-1">
                {resourceTypeLabels[log.resourceType] || log.resourceType}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">User</p>
              <p className="font-medium text-slate-800 mt-1">{userName}</p>
              {log.user?.email && (
                <p className="text-xs text-slate-500">{log.user.email}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Timestamp</p>
              <p className="font-medium text-slate-800 mt-1">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Resource ID */}
          {log.resourceId && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Resource ID</p>
              <p className="font-mono text-sm text-slate-800 mt-1 bg-slate-50 p-2 rounded">
                {log.resourceId}
              </p>
            </div>
          )}

          {/* IP Address & User Agent */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">IP Address</p>
              <p className="font-mono text-sm text-slate-800 mt-1">
                {log.ipAddress || 'Not recorded'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">User Agent</p>
              <p className="text-xs text-slate-600 mt-1 truncate" title={log.userAgent || undefined}>
                {log.userAgent || 'Not recorded'}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata as object).length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Metadata</p>
              <pre className="bg-slate-50 p-3 rounded-lg text-xs text-slate-700 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function AdminAuditLogPage() {
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogRowProps['log'] | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const limit = 20;

  // Build query params
  const queryParams = {
    action: filters.action || undefined,
    resourceType: filters.resourceType || undefined,
    startDate: filters.startDate ? new Date(filters.startDate).toISOString() : undefined,
    endDate: filters.endDate ? new Date(filters.endDate + 'T23:59:59').toISOString() : undefined,
    search: filters.search || undefined,
    limit,
    offset: page * limit,
  };

  // Fetch audit logs
  const { data, isLoading, refetch } = api.admin.getAuditLogs.useQuery(queryParams);

  // Export mutation
  const exportMutation = api.admin.exportAuditLogs.useQuery(
    {
      ...queryParams,
      limit: 10000,
    },
    { enabled: false }
  );

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      action: '',
      resourceType: '',
      startDate: '',
      endDate: '',
      search: '',
    });
    setPage(0);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.refetch();
      if (result.data?.csv) {
        // Create and download CSV file
        const blob = new Blob([result.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
          <p className="text-slate-500 mt-1">Track all platform activity and changes</p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || logs.length === 0}
          className="px-4 py-2 bg-medical-600 text-white rounded-lg hover:bg-medical-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>
          Showing {logs.length} of {total.toLocaleString()} results
        </p>
        {total > 0 && (
          <p>
            Page {page + 1} of {totalPages}
          </p>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-medical-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-slate-500 mt-3">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-600">No audit logs found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <AuditLogRow
                    key={log.id}
                    log={log}
                    onViewDetails={setSelectedLog}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded-lg ${
                      page === pageNum
                        ? 'bg-medical-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <DetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
