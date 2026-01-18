'use client';

import React, { useState, useMemo } from 'react';
import { api } from '@/trpc/react';
import {
  Users,
  Calendar,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// Date range presets
const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'medical' | 'blue' | 'green' | 'yellow' | 'purple' | 'red';
  subtitle?: string;
}

function StatsCard({ title, value, icon, color, subtitle }: StatsCardProps) {
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
        </div>
        <div className="p-3 rounded-lg bg-white/50">{icon}</div>
      </div>
    </div>
  );
}

// Simple Line Chart Component
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
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
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


export default function DoctorAnalyticsPage() {
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

  // Handle preset selection
  const handlePresetSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDateRange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  };

  // Fetch doctor analytics
  const { data: analytics, isLoading, refetch } = api.analytics.getDoctorAnalytics.useQuery(dateRange);

  // Format chart data
  const patientGrowthData = useMemo(() => {
    if (!analytics?.patients.timeSeries) return [];
    return analytics.patients.timeSeries.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item.count,
    }));
  }, [analytics]);

  const appointmentData = useMemo(() => {
    if (!analytics?.appointments.timeSeries) return [];
    return analytics.appointments.timeSeries.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item.total,
    }));
  }, [analytics]);

  const intakeData = useMemo(() => {
    if (!analytics?.intakes.timeSeries) return [];
    return analytics.intakes.timeSeries.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: item.total,
    }));
  }, [analytics]);

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
          <h1 className="text-2xl font-bold text-slate-800">Practice Analytics</h1>
          <p className="text-slate-500 mt-1">Your practice performance metrics</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <DateRangePicker
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onStartDateChange={(date) => setDateRange(prev => ({ ...prev, startDate: date }))}
          onEndDateChange={(date) => setDateRange(prev => ({ ...prev, endDate: date }))}
          onPresetSelect={handlePresetSelect}
        />
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Patients"
          value={analytics?.patients.total ?? 0}
          icon={<Users className="w-5 h-5" />}
          color="medical"
          subtitle={`${analytics?.patients.new ?? 0} new in period`}
        />
        <StatsCard
          title="Appointments"
          value={analytics?.appointments.total ?? 0}
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
          subtitle={`${analytics?.appointments.completionRate ?? 0}% completion rate`}
        />
        <StatsCard
          title="Intake Sessions"
          value={analytics?.intakes.total ?? 0}
          icon={<MessageSquare className="w-5 h-5" />}
          color="purple"
          subtitle={`${analytics?.intakes.completed ?? 0} completed`}
        />
        <StatsCard
          title="Avg Intake Time"
          value={`${analytics?.intakes.avgCompletionTimeMinutes ?? 0} min`}
          icon={<Clock className="w-5 h-5" />}
          color="green"
          subtitle="Average completion time"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Growth Chart */}
        <ChartCard
          title="Patient Growth"
          subtitle={`${analytics?.patients.new ?? 0} new patients in selected period`}
        >
          <SimpleLineChart data={patientGrowthData} color="#0ea5e9" />
          <div className="mt-4 flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">{analytics?.patients.total ?? 0}</p>
              <p className="text-xs text-slate-500">Total Patients</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">+{analytics?.patients.new ?? 0}</p>
              <p className="text-xs text-slate-500">New This Period</p>
            </div>
          </div>
        </ChartCard>

        {/* Appointment Stats Chart */}
        <ChartCard
          title="Appointment Trends"
          subtitle={`${analytics?.appointments.total ?? 0} total appointments`}
        >
          <SimpleLineChart data={appointmentData} color="#8b5cf6" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-bold">{analytics?.appointments.completed ?? 0}</span>
              </div>
              <p className="text-xs text-green-600">Completed</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="font-bold">{analytics?.appointments.cancelled ?? 0}</span>
              </div>
              <p className="text-xs text-red-600">Cancelled</p>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-blue-600">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold">{analytics?.appointments.completionRate ?? 0}%</span>
              </div>
              <p className="text-xs text-blue-600">Rate</p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Intake Sessions Chart */}
      <ChartCard
        title="Intake Session Activity"
        subtitle="AI-powered intake sessions with your patients"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SimpleLineChart data={intakeData} color="#10b981" height={180} />
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600">
                <MessageSquare className="w-5 h-5" />
                <span className="text-2xl font-bold">{analytics?.intakes.total ?? 0}</span>
              </div>
              <p className="text-sm text-purple-600 mt-1">Total Sessions</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-2xl font-bold">{analytics?.intakes.completed ?? 0}</span>
              </div>
              <p className="text-sm text-green-600 mt-1">Completed</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-bold">{analytics?.intakes.avgCompletionTimeMinutes ?? 0} min</span>
              </div>
              <p className="text-sm text-blue-600 mt-1">Avg Completion Time</p>
            </div>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
