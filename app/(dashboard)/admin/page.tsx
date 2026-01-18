'use client';

import React from 'react';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  Users,
  UserCheck,
  Calendar,
  Activity,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Shield,
  Settings,
  FileText,
  Stethoscope,
} from 'lucide-react';
import type { ActivityFeedItem, PendingDoctorItem } from '@/types/dashboard';

// ============================================================================
// SKELETON COMPONENTS - Progressive Loading (Requirements: 3.1, 3.2, 3.3)
// ============================================================================

function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 bg-slate-50 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-20 bg-slate-200 rounded mb-2"></div>
          <div className="h-8 w-12 bg-slate-200 rounded"></div>
        </div>
        <div className="p-3 rounded-lg bg-slate-200 w-11 h-11"></div>
      </div>
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 animate-pulse">
      <div className="p-2 rounded-lg bg-slate-200 w-10 h-10"></div>
      <div className="flex-1 min-w-0">
        <div className="h-4 w-32 bg-slate-200 rounded mb-2"></div>
        <div className="h-3 w-24 bg-slate-200 rounded"></div>
      </div>
      <div className="h-3 w-12 bg-slate-200 rounded"></div>
    </div>
  );
}

function PendingDoctorCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-slate-200"></div>
      <div className="flex-1 min-w-0">
        <div className="h-4 w-28 bg-slate-200 rounded mb-2"></div>
        <div className="h-3 w-36 bg-slate-200 rounded"></div>
      </div>
      <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
    </div>
  );
}

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'medical' | 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  trend?: string;
  href?: string;
}

function StatsCard({ title, value, icon, color, trend, href }: StatsCardProps) {
  const colorClasses = {
    medical: 'bg-medical-50 text-medical-600 border-medical-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  const content = (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
          {trend && (
            <p className="text-xs mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-white/50">{icon}</div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// ACTIVITY ITEM COMPONENT
// ============================================================================

interface ActivityItemProps {
  activity: ActivityFeedItem;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const userName = activity.user
    ? `${activity.user.firstName || ''} ${activity.user.lastName || ''}`.trim() || 'Unknown User'
    : 'System';

  const actionLabels: Record<string, string> = {
    user_created: 'New user registered',
    user_activated: 'User activated',
    user_suspended: 'User suspended',
    user_role_changed: 'User role changed',
    doctor_approved: 'Doctor approved',
    doctor_rejected: 'Doctor rejected',
    config_updated: 'Configuration updated',
    config_created: 'Configuration created',
    login: 'User logged in',
    logout: 'User logged out',
  };

  const actionIcons: Record<string, React.ReactNode> = {
    user_created: <Users className="w-4 h-4 text-green-500" />,
    user_activated: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    user_suspended: <AlertCircle className="w-4 h-4 text-red-500" />,
    user_role_changed: <Shield className="w-4 h-4 text-blue-500" />,
    doctor_approved: <UserCheck className="w-4 h-4 text-green-500" />,
    doctor_rejected: <AlertCircle className="w-4 h-4 text-red-500" />,
    config_updated: <Settings className="w-4 h-4 text-purple-500" />,
    config_created: <Settings className="w-4 h-4 text-purple-500" />,
    login: <Activity className="w-4 h-4 text-blue-500" />,
    logout: <Activity className="w-4 h-4 text-slate-500" />,
  };

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors">
      <div className="p-2 rounded-lg bg-slate-100">
        {actionIcons[activity.action] || <Activity className="w-4 h-4 text-slate-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">
          {actionLabels[activity.action] || activity.action}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          by {userName} • {activity.resourceType}
        </p>
      </div>
      <p className="text-xs text-slate-400">
        {new Date(activity.createdAt).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>
    </div>
  );
}

// ============================================================================
// PENDING DOCTOR CARD COMPONENT
// ============================================================================

interface PendingDoctorCardProps {
  doctor: PendingDoctorItem;
}

function PendingDoctorCard({ doctor }: PendingDoctorCardProps) {
  const doctorName = doctor.user
    ? `${doctor.user.firstName || ''} ${doctor.user.lastName || ''}`.trim() || 'Unknown'
    : 'Unknown';

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
      <div className="w-10 h-10 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 font-bold text-sm">
        {doctor.user?.imageUrl ? (
          <img
            src={doctor.user.imageUrl}
            alt={doctorName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <Stethoscope className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{doctorName}</p>
        <p className="text-xs text-slate-500 truncate">
          {doctor.specialty || 'No specialty'} • {doctor.clinicName || 'No clinic'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
          Pending
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SYSTEM HEALTH INDICATOR COMPONENT
// ============================================================================

function SystemHealthIndicator() {
  // In a real app, this would check actual system health
  const healthStatus = {
    api: 'healthy',
    database: 'healthy',
    auth: 'healthy',
    storage: 'healthy',
  };

  const statusColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">System Health</h2>
      </div>
      <div className="p-4 space-y-3">
        {Object.entries(healthStatus).map(([service, status]) => (
          <div key={service} className="flex items-center justify-between">
            <span className="text-sm text-slate-600 capitalize">{service}</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusColors[status as keyof typeof statusColors]}`} />
              <span className="text-xs text-slate-500 capitalize">{status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// QUICK ACTIONS COMPONENT
// ============================================================================

function QuickActions() {
  const actions = [
    { href: '/admin/users', label: 'Manage Users', icon: <Users className="w-5 h-5" /> },
    { href: '/admin/doctors', label: 'Verify Doctors', icon: <UserCheck className="w-5 h-5" /> },
    { href: '/admin/config', label: 'Platform Settings', icon: <Settings className="w-5 h-5" /> },
    { href: '/admin/audit', label: 'Audit Logs', icon: <FileText className="w-5 h-5" /> },
    { href: '/admin/analytics', label: 'Analytics & Reports', icon: <TrendingUp className="w-5 h-5" /> },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">Quick Actions</h2>
      </div>
      <div className="p-2">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-slate-600 hover:text-slate-800"
          >
            {action.icon}
            <span className="text-sm font-medium">{action.label}</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="p-8 text-center text-slate-400">
      <div className="mx-auto mb-3 opacity-30">{icon}</div>
      <p className="font-medium text-slate-600">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function AdminOverviewPage() {
  // Use consolidated dashboard query - fetches stats, activity, pendingDoctors in parallel
  // Requirements: 1.3, 3.1, 3.2, 3.3
  const { data: dashboardData, isLoading: dashboardLoading } = 
    api.dashboard.getAdminDashboard.useQuery(undefined, {
      refetchInterval: 60000, // Poll every 60 seconds (admin stats have 60s stale time)
      refetchIntervalInBackground: false,
    });

  // Extract data from consolidated response
  const stats = dashboardData?.stats;
  const activities = dashboardData?.activity ?? [];
  const pendingDoctors = dashboardData?.pendingDoctors ?? [];

  // Progressive loading: show stats skeletons first, then content
  // Requirements: 3.1, 3.2, 3.3, 3.4
  const isStatsLoading = dashboardLoading;
  const isListsLoading = dashboardLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Platform overview and management</p>
        </div>
        {!isStatsLoading && (stats?.pendingVerifications ?? 0) > 0 && (
          <Link
            href="/admin/doctors"
            className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <p className="text-sm text-yellow-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {stats?.pendingVerifications} pending verification{(stats?.pendingVerifications ?? 0) > 1 ? 's' : ''}
            </p>
          </Link>
        )}
      </div>

      {/* Stats Cards - Progressive loading with skeletons (Requirements: 3.1, 3.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isStatsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Total Users"
              value={stats?.totalUsers ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="medical"
              href="/admin/users"
            />
            <StatsCard
              title="Total Doctors"
              value={stats?.totalDoctors ?? 0}
              icon={<Stethoscope className="w-5 h-5" />}
              color="blue"
              href="/admin/doctors"
            />
            <StatsCard
              title="Total Patients"
              value={stats?.totalPatients ?? 0}
              icon={<UserCheck className="w-5 h-5" />}
              color="green"
            />
            <StatsCard
              title="Today's Appointments"
              value={stats?.todayAppointments ?? 0}
              icon={<Calendar className="w-5 h-5" />}
              color="purple"
            />
          </>
        )}
      </div>

      {/* Secondary Stats - Progressive loading with skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isStatsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Active Users (30d)"
              value={stats?.activeUsers ?? 0}
              icon={<Activity className="w-5 h-5" />}
              color="green"
            />
            <StatsCard
              title="Total Connections"
              value={stats?.totalConnections ?? 0}
              icon={<Users className="w-5 h-5" />}
              color="blue"
            />
            <StatsCard
              title="Completed Intakes"
              value={stats?.completedIntakes ?? 0}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="medical"
            />
            <StatsCard
              title="Pending Verifications"
              value={stats?.pendingVerifications ?? 0}
              icon={<Clock className="w-5 h-5" />}
              color={stats?.pendingVerifications ? 'yellow' : 'green'}
              href="/admin/doctors"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Recent Activity</h2>
              <p className="text-sm text-slate-500">Platform-wide activity feed</p>
            </div>
            <Link
              href="/admin/audit"
              className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isListsLoading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map(i => (
                <ActivityItemSkeleton key={i} />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-12 h-12" />}
              title="No recent activity"
              description="Activity will appear here as users interact with the platform"
            />
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Pending Verifications */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Pending Verifications</h2>
              <Link
                href="/admin/doctors"
                className="text-sm text-medical-600 hover:text-medical-700 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {isListsLoading ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3].map(i => (
                  <PendingDoctorCardSkeleton key={i} />
                ))}
              </div>
            ) : pendingDoctors.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-50" />
                <p className="text-sm font-medium text-slate-600">All caught up!</p>
                <p className="text-xs mt-1">No pending verifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingDoctors.map((doctor) => (
                  <PendingDoctorCard key={doctor.id} doctor={doctor} />
                ))}
              </div>
            )}
          </div>

          {/* System Health */}
          <SystemHealthIndicator />

          {/* Quick Actions */}
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
