'use client';

import React, { useState, useMemo } from 'react';
import { api } from '@/trpc/react';
import {
  Users,
  Calendar,
  Activity,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// Date range presets
const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

// Granularity options
const GRANULARITY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

type Granularity = 'daily' | 'weekly' | 'monthly';

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'medical' | 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
}

function StatsCard({ title, value, icon, color, trend, subtitle }: StatsCardProps) {
  const colorClasses = {
    medical: 'bg-medical-50 text-medical-600 border-medical-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
          {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}% vs previous period
            </p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-white/50">{icon}</div>
      </div>
    </div>
  );
}

// Simple Bar Chart Component
interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  showLabels?: boolean;
}

function SimpleBarChart({ data, height = 200, showLabels = true }: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div
            className={`w-full rounded-t transition-all ${item.color || 'bg-medical-500'}`}
            style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: item.value > 0 ? 4 : 0 }}
            title={`${item.label}: ${item.value}`}
          />
          {showLabels && (
            <span className="text-xs text-slate-500 mt-1 truncate w-full text-center">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// Line Chart Component (simplified)
interface LineChartProps {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
}

function SimpleLineChart({ data, height = 150, color = '#0ea5e9' }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = 100 - ((d.value - minValue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}


// Chart Card Component
interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

function ChartCard({ title, subtitle, children, actions }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Date Range Picker Component
interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onPresetSelect: (days: number) => void;
}

function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange, onPresetSelect }: DateRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">From:</label>
        <input
          type="date"
          value={startDate.split('T')[0]}
          onChange={(e) => onStartDateChange(new Date(e.target.value).toISOString())}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600">To:</label>
        <input
          type="date"
          value={endDate.split('T')[0]}
          onChange={(e) => onEndDateChange(new Date(e.target.value).toISOString())}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
        />
      </div>
      <div className="flex items-center gap-1">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.days}
            onClick={() => onPresetSelect(preset.days)}
            className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  // Date range state
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  });

  const [granularity, setGranularity] = useState<Granularity>('daily');

  // Handle preset selection
  const handlePresetSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
    // Auto-adjust granularity based on date range
    if (days <= 14) setGranularity('daily');
    else if (days <= 90) setGranularity('weekly');
    else setGranularity('monthly');
  };

  // Fetch analytics data
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = api.analytics.getOverview.useQuery(dateRange);
  const { data: userGrowth, isLoading: userGrowthLoading } = api.analytics.getUserGrowth.useQuery({ ...dateRange, granularity });
  const { data: appointmentStats, isLoading: appointmentLoading } = api.analytics.getAppointmentStats.useQuery({ ...dateRange, granularity });
  const { data: intakeStats, isLoading: intakeLoading } = api.analytics.getIntakeStats.useQuery({ ...dateRange, granularity });

  // Export mutations
  const { refetch: exportUserGrowth } = api.analytics.exportUserGrowth.useQuery(
    { ...dateRange, granularity },
    { enabled: false }
  );
  const { refetch: exportAppointments } = api.analytics.exportAppointmentStats.useQuery(
    { ...dateRange, granularity },
    { enabled: false }
  );
  const { refetch: exportPDF } = api.analytics.generatePDFReport.useQuery(
    dateRange,
    { enabled: false }
  );

  const handleExportUserGrowth = async () => {
    const result = await exportUserGrowth();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportAppointments = async () => {
    const result = await exportAppointments();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportPDF = async () => {
    const result = await exportPDF();
    if (result.data) {
      // Open HTML in new window for printing as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(result.data.html);
        printWindow.document.close();
        // Trigger print dialog after content loads
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  // Format chart data
  const userGrowthChartData = useMemo(() => {
    if (!userGrowth?.timeSeries) return [];
    return userGrowth.timeSeries.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item.total,
    }));
  }, [userGrowth]);

  const appointmentChartData = useMemo(() => {
    if (!appointmentStats?.timeSeries) return [];
    return appointmentStats.timeSeries.map(item => ({
      label: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item.total,
      color: 'bg-blue-500',
    }));
  }, [appointmentStats]);

  const intakeChartData = useMemo(() => {
    if (!intakeStats?.timeSeries) return [];
    return intakeStats.timeSeries.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item.total,
    }));
  }, [intakeStats]);

  const isLoading = overviewLoading || userGrowthLoading || appointmentLoading || intakeLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
          <div className="h-12 bg-slate-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-200 rounded-xl"></div>
            <div className="h-64 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics & Reports</h1>
          <p className="text-slate-500 mt-1">Platform performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-medical-600 hover:bg-medical-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={() => refetchOverview()}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <DateRangePicker
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onStartDateChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
            onEndDateChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
            onPresetSelect={handlePresetSelect}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Granularity:</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical-500"
            >
              {GRANULARITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="New Users"
          value={overview?.users.new ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="medical"
          subtitle={`${overview?.users.newDoctors ?? 0} doctors, ${overview?.users.newPatients ?? 0} patients`}
        />
        <StatsCard
          title="New Connections"
          value={overview?.connections.new ?? 0}
          icon={<Activity className="w-5 h-5" />}
          color="blue"
        />
        <StatsCard
          title="Appointments"
          value={overview?.appointments.total ?? 0}
          icon={<Calendar className="w-5 h-5" />}
          color="green"
          subtitle={`${overview?.appointments.completionRate ?? 0}% completion rate`}
        />
        <StatsCard
          title="Intake Sessions"
          value={overview?.intakes.total ?? 0}
          icon={<MessageSquare className="w-5 h-5" />}
          color="purple"
          subtitle={`${overview?.intakes.completionRate ?? 0}% completion rate`}
        />
      </div>


      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <ChartCard
          title="User Growth"
          subtitle={`Total: ${userGrowth?.totals.users ?? 0} users`}
          actions={
            <button
              onClick={handleExportUserGrowth}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          }
        >
          <SimpleLineChart data={userGrowthChartData} color="#0ea5e9" />
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-800">{userGrowth?.totals.users ?? 0}</p>
              <p className="text-xs text-slate-500">Total Users</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{userGrowth?.totals.doctors ?? 0}</p>
              <p className="text-xs text-slate-500">Doctors</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{userGrowth?.totals.patients ?? 0}</p>
              <p className="text-xs text-slate-500">Patients</p>
            </div>
          </div>
        </ChartCard>

        {/* Appointment Stats Chart */}
        <ChartCard
          title="Appointment Volume"
          subtitle={`${appointmentStats?.summary.total ?? 0} total appointments`}
          actions={
            <button
              onClick={handleExportAppointments}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          }
        >
          <SimpleBarChart data={appointmentChartData} height={150} />
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-bold">{appointmentStats?.summary.completed ?? 0}</span>
              </div>
              <p className="text-xs text-green-600">Completed</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="font-bold">{appointmentStats?.summary.cancelled ?? 0}</span>
              </div>
              <p className="text-xs text-red-600">Cancelled</p>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-yellow-600">
                <AlertCircle className="w-4 h-4" />
                <span className="font-bold">{appointmentStats?.summary.noShow ?? 0}</span>
              </div>
              <p className="text-xs text-yellow-600">No Show</p>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-blue-600">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold">{appointmentStats?.summary.completionRate ?? 0}%</span>
              </div>
              <p className="text-xs text-blue-600">Rate</p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* AI Intake Stats */}
      <ChartCard
        title="AI Intake Sessions"
        subtitle="Chat session metrics and completion rates"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SimpleLineChart data={intakeChartData} color="#8b5cf6" height={180} />
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600">
                <MessageSquare className="w-5 h-5" />
                <span className="text-2xl font-bold">{intakeStats?.summary.totalSessions ?? 0}</span>
              </div>
              <p className="text-sm text-purple-600 mt-1">Total Sessions</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-2xl font-bold">{intakeStats?.summary.completedSessions ?? 0}</span>
              </div>
              <p className="text-sm text-green-600 mt-1">Completed ({intakeStats?.summary.completionRate ?? 0}%)</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-bold">{intakeStats?.summary.avgSessionDurationMinutes ?? 0} min</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">Avg Session Duration</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-600">
                <Activity className="w-5 h-5" />
                <span className="text-2xl font-bold">{intakeStats?.summary.avgMessagesPerSession ?? 0}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">Avg Messages/Session</p>
            </div>
          </div>
        </div>
      </ChartCard>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-medium text-slate-600 mb-2">Avg Completeness</h4>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-medical-600">{intakeStats?.summary.avgCompleteness ?? 0}%</span>
          </div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-medical-500 rounded-full transition-all"
              style={{ width: `${intakeStats?.summary.avgCompleteness ?? 0}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-medium text-slate-600 mb-2">Total Messages</h4>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-blue-600">{(intakeStats?.summary.totalMessages ?? 0).toLocaleString()}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">AI chat messages exchanged</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-medium text-slate-600 mb-2">Appointment Completion</h4>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-green-600">{appointmentStats?.summary.completionRate ?? 0}%</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Of scheduled appointments completed</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-medium text-slate-600 mb-2">No-Show Rate</h4>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-yellow-600">{appointmentStats?.summary.noShowRate ?? 0}%</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Patients who missed appointments</p>
        </div>
      </div>
    </div>
  );
}
