'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import {
  Settings,
  Save,
  Clock,
  Bell,
  Shield,
  Sparkles,
  Upload,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';

interface ConfigValue {
  value: unknown;
  description: string | null;
  updatedAt: Date;
}

type ConfigMap = Record<string, ConfigValue>;

const defaultConfigs = {
  'appointment.slot_durations': {
    value: [15, 30, 45, 60],
    description: 'Available appointment slot durations in minutes',
  },
  'appointment.default_duration': {
    value: 30,
    description: 'Default appointment duration in minutes',
  },
  'appointment.max_daily': {
    value: 20,
    description: 'Maximum appointments per doctor per day',
  },
  'platform.announcement': {
    value: '',
    description: 'Platform-wide announcement banner text',
  },
  'platform.registration_enabled': {
    value: true,
    description: 'Allow new user registrations',
  },
  'platform.maintenance_mode': {
    value: false,
    description: 'Enable maintenance mode (blocks all non-admin access)',
  },
  'ai.model': {
    value: 'gemini-2.0-flash',
    description: 'AI model for intake conversations',
  },
  'ai.temperature': {
    value: 0.7,
    description: 'AI response temperature (0-1)',
  },
  'upload.max_file_size': {
    value: 10485760,
    description: 'Maximum file upload size in bytes (default 10MB)',
  },
  'upload.allowed_types': {
    value: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    description: 'Allowed file MIME types for uploads',
  },
  'feature.direct_messaging': {
    value: true,
    description: 'Enable direct messaging between patients and doctors',
  },
  'feature.file_uploads': {
    value: true,
    description: 'Enable file uploads during intake',
  },
};

export default function AdminConfigPage() {
  const [localConfigs, setLocalConfigs] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: serverConfigs, isLoading, refetch } = api.admin.getConfig.useQuery();

  const updateConfigsMutation = api.admin.updateConfigs.useMutation({
    onSuccess: () => {
      refetch();
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });


  // Initialize local configs from server or defaults
  useEffect(() => {
    if (serverConfigs) {
      const merged: Record<string, unknown> = {};
      Object.entries(defaultConfigs).forEach(([key, def]) => {
        merged[key] = serverConfigs[key]?.value ?? def.value;
      });
      setLocalConfigs(merged);
    } else {
      const defaults: Record<string, unknown> = {};
      Object.entries(defaultConfigs).forEach(([key, def]) => {
        defaults[key] = def.value;
      });
      setLocalConfigs(defaults);
    }
  }, [serverConfigs]);

  const updateConfig = (key: string, value: unknown) => {
    setLocalConfigs(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const configs = Object.entries(localConfigs).map(([key, value]) => ({
      key,
      value,
      description: defaultConfigs[key as keyof typeof defaultConfigs]?.description,
    }));
    updateConfigsMutation.mutate({ configs });
  };

  const handleReset = () => {
    const defaults: Record<string, unknown> = {};
    Object.entries(defaultConfigs).forEach(([key, def]) => {
      defaults[key] = def.value;
    });
    setLocalConfigs(defaults);
    setHasChanges(true);
  };

  const renderConfigInput = (key: string, value: unknown, description: string) => {
    const type = typeof value;
    
    if (type === 'boolean') {
      return (
        <button
          onClick={() => updateConfig(key, !value)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {value ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          {value ? 'Enabled' : 'Disabled'}
        </button>
      );
    }
    
    if (type === 'number') {
      return (
        <input
          type="number"
          value={value as number}
          onChange={(e) => updateConfig(key, parseFloat(e.target.value) || 0)}
          className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      );
    }
    
    if (Array.isArray(value)) {
      if (typeof value[0] === 'number') {
        return (
          <input
            type="text"
            value={(value as number[]).join(', ')}
            onChange={(e) => {
              const nums = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
              updateConfig(key, nums);
            }}
            placeholder="e.g., 15, 30, 45, 60"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      }
      return (
        <textarea
          value={(value as string[]).join('\n')}
          onChange={(e) => {
            const items = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
            updateConfig(key, items);
          }}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
      );
    }
    
    // String
    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => updateConfig(key, e.target.value)}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-600" />
            Platform Configuration
          </h1>
          <p className="text-gray-600 mt-1">
            Manage platform-wide settings and feature flags
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              Saved successfully
            </span>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateConfigsMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {updateConfigsMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <span className="text-yellow-800">You have unsaved changes</span>
        </div>
      )}


      {/* Appointment Settings */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Appointment Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Available Slot Durations (minutes)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['appointment.slot_durations'].description}
              </p>
              {renderConfigInput('appointment.slot_durations', localConfigs['appointment.slot_durations'], '')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Duration (minutes)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['appointment.default_duration'].description}
              </p>
              {renderConfigInput('appointment.default_duration', localConfigs['appointment.default_duration'], '')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Daily Appointments
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['appointment.max_daily'].description}
              </p>
              {renderConfigInput('appointment.max_daily', localConfigs['appointment.max_daily'], '')}
            </div>
          </div>
        </div>
      </div>

      {/* Platform Settings */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Platform Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Announcement Banner
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {defaultConfigs['platform.announcement'].description}
            </p>
            {renderConfigInput('platform.announcement', localConfigs['platform.announcement'], '')}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Registration
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['platform.registration_enabled'].description}
              </p>
              {renderConfigInput('platform.registration_enabled', localConfigs['platform.registration_enabled'], '')}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maintenance Mode
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['platform.maintenance_mode'].description}
              </p>
              {renderConfigInput('platform.maintenance_mode', localConfigs['platform.maintenance_mode'], '')}
            </div>
          </div>
        </div>
      </div>

      {/* AI Settings */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AI Model
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['ai.model'].description}
              </p>
              <select
                value={localConfigs['ai.model'] as string}
                onChange={(e) => updateConfig('ai.model', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <optgroup label="Gemini 3 (Preview)">
                  <option value="gemini-3-preview">Gemini 3 Preview</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                </optgroup>
                <optgroup label="Gemini 2">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </optgroup>
                <optgroup label="Gemini 1.5">
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature ({String(localConfigs['ai.temperature'] ?? 0.7)})
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['ai.temperature'].description}
              </p>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localConfigs['ai.temperature'] as number}
                onChange={(e) => updateConfig('ai.temperature', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>


      {/* Upload Settings */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Upload Settings
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max File Size (bytes)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['upload.max_file_size'].description}
              </p>
              {renderConfigInput('upload.max_file_size', localConfigs['upload.max_file_size'], '')}
              <p className="text-xs text-gray-400 mt-1">
                Current: {((localConfigs['upload.max_file_size'] as number) / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allowed File Types
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {defaultConfigs['upload.allowed_types'].description}
              </p>
              {renderConfigInput('upload.allowed_types', localConfigs['upload.allowed_types'], '')}
            </div>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Feature Flags
          </h2>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Direct Messaging
                </label>
                <p className="text-xs text-gray-500">
                  {defaultConfigs['feature.direct_messaging'].description}
                </p>
              </div>
              {renderConfigInput('feature.direct_messaging', localConfigs['feature.direct_messaging'], '')}
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  File Uploads
                </label>
                <p className="text-xs text-gray-500">
                  {defaultConfigs['feature.file_uploads'].description}
                </p>
              </div>
              {renderConfigInput('feature.file_uploads', localConfigs['feature.file_uploads'], '')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
