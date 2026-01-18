'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  Settings,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location?: string;
  isActive: boolean;
}

interface BlockedDate {
  id: string;
  date: Date;
  reason: string | null;
}


function TimeSlotEditor({ 
  slot, 
  onUpdate, 
  onRemove 
}: { 
  slot: AvailabilitySlot; 
  onUpdate: (slot: AvailabilitySlot) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={slot.startTime}
          onChange={(e) => onUpdate({ ...slot, startTime: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500 text-sm"
        />
        <span className="text-slate-400">to</span>
        <input
          type="time"
          value={slot.endTime}
          onChange={(e) => onUpdate({ ...slot, endTime: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={slot.location ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            onUpdate({ ...slot, location: value ? value : undefined });
          }}
          placeholder="Location (optional)"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500 text-sm"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={slot.isActive}
            onChange={(e) => onUpdate({ ...slot, isActive: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-medical-600 focus:ring-medical-500"
          />
          <span className="text-sm text-slate-600">Active</span>
        </label>
        <button
          onClick={onRemove}
          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DayScheduleCard({
  day,
  slots,
  onAddSlot,
  onUpdateSlot,
  onRemoveSlot,
}: {
  day: { value: number; label: string; short: string };
  slots: AvailabilitySlot[];
  onAddSlot: () => void;
  onUpdateSlot: (index: number, slot: AvailabilitySlot) => void;
  onRemoveSlot: (index: number) => void;
}) {
  const daySlots = slots.filter(s => s.dayOfWeek === day.value);
  const hasActiveSlots = daySlots.some(s => s.isActive);

  return (
    <div className={`bg-white rounded-xl border ${hasActiveSlots ? 'border-medical-200' : 'border-slate-200'} overflow-hidden`}>
      <div className={`px-4 py-3 border-b ${hasActiveSlots ? 'bg-medical-50 border-medical-100' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${hasActiveSlots ? 'text-medical-700' : 'text-slate-600'}`}>
            {day.label}
          </h3>
          {hasActiveSlots && (
            <span className="text-xs text-medical-600 font-medium">
              {daySlots.filter(s => s.isActive).length} slot{daySlots.filter(s => s.isActive).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        {daySlots.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-2">No availability set</p>
        ) : (
          daySlots.map((slot, idx) => {
            const globalIndex = slots.findIndex(s => s === slot);
            return (
              <TimeSlotEditor
                key={idx}
                slot={slot}
                onUpdate={(updated) => onUpdateSlot(globalIndex, updated)}
                onRemove={() => onRemoveSlot(globalIndex)}
              />
            );
          })
        )}
        <button
          onClick={onAddSlot}
          className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-medical-300 hover:text-medical-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Time Slot
        </button>
      </div>
    </div>
  );
}


function BlockedDateCard({
  blockedDate,
  onUnblock,
  isUnblocking,
}: {
  blockedDate: BlockedDate;
  onUnblock: () => void;
  isUnblocking: boolean;
}) {
  const date = new Date(blockedDate.date);
  
  return (
    <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
      <div>
        <p className="font-medium text-red-700">
          {date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        {blockedDate.reason && (
          <p className="text-sm text-red-600 mt-0.5">{blockedDate.reason}</p>
        )}
      </div>
      <button
        onClick={onUnblock}
        disabled={isUnblocking}
        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function AppointmentSettingsCard({
  duration,
  bufferTime,
  maxDaily,
  onUpdate,
  isSaving,
}: {
  duration: number;
  bufferTime: number;
  maxDaily: number;
  onUpdate: (settings: { duration: number; bufferTime: number; maxDaily: number }) => void;
  isSaving: boolean;
}) {
  const [localDuration, setLocalDuration] = useState(duration);
  const [localBuffer, setLocalBuffer] = useState(bufferTime);
  const [localMaxDaily, setLocalMaxDaily] = useState(maxDaily);

  useEffect(() => {
    setLocalDuration(duration);
    setLocalBuffer(bufferTime);
    setLocalMaxDaily(maxDaily);
  }, [duration, bufferTime, maxDaily]);

  const hasChanges = localDuration !== duration || localBuffer !== bufferTime || localMaxDaily !== maxDaily;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-500" />
        <h3 className="font-semibold text-slate-700">Appointment Settings</h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Appointment Duration (minutes)
          </label>
          <select
            value={localDuration}
            onChange={(e) => setLocalDuration(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
          >
            <option value={15}>15 minutes</option>
            <option value={20}>20 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
            <option value={90}>90 minutes</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Buffer Time Between Appointments (minutes)
          </label>
          <select
            value={localBuffer}
            onChange={(e) => setLocalBuffer(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
          >
            <option value={0}>No buffer</option>
            <option value={5}>5 minutes</option>
            <option value={10}>10 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Maximum Daily Appointments
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={localMaxDaily}
            onChange={(e) => setLocalMaxDaily(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
          />
        </div>
        {hasChanges && (
          <button
            onClick={() => onUpdate({ duration: localDuration, bufferTime: localBuffer, maxDaily: localMaxDaily })}
            disabled={isSaving}
            className="w-full py-2 bg-medical-600 text-white rounded-lg font-medium hover:bg-medical-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}


export default function DoctorAvailabilityPage() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const utils = api.useUtils();

  // Fetch doctor profile for settings
  const { data: doctorProfile, isLoading: profileLoading } = api.doctor.getMyProfile.useQuery();

  // Fetch current availability
  const { data: availabilityData, isLoading: availabilityLoading } = api.doctor.getAvailability.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch blocked dates
  const { data: blockedDatesData, isLoading: blockedLoading } = api.doctor.getBlockedDates.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Mutations
  const setAvailability = api.doctor.setAvailability.useMutation({
    onSuccess: () => {
      setHasChanges(false);
      setSaveMessage({ type: 'success', text: 'Availability saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
      utils.doctor.getAvailability.invalidate();
    },
    onError: (error) => {
      setSaveMessage({ type: 'error', text: error.message });
      setTimeout(() => setSaveMessage(null), 5000);
    },
  });

  const blockDate = api.doctor.blockDate.useMutation({
    onSuccess: () => {
      setNewBlockDate('');
      setNewBlockReason('');
      setShowBlockForm(false);
      utils.doctor.getBlockedDates.invalidate();
    },
  });

  const unblockDate = api.doctor.unblockDate.useMutation({
    onSuccess: () => {
      utils.doctor.getBlockedDates.invalidate();
    },
  });

  const updateProfile = api.doctor.updateProfile.useMutation({
    onSuccess: () => {
      utils.doctor.getMyProfile.invalidate();
    },
  });

  // Initialize slots from fetched data
  useEffect(() => {
    if (availabilityData?.availability) {
      setSlots(availabilityData.availability.map(a => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        location: a.location ?? undefined,
        isActive: a.isActive,
      })));
    }
  }, [availabilityData]);

  const handleAddSlot = (dayOfWeek: number) => {
    setSlots([...slots, {
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
      location: undefined,
      isActive: true,
    }]);
    setHasChanges(true);
  };

  const handleUpdateSlot = (index: number, updatedSlot: AvailabilitySlot) => {
    const newSlots = [...slots];
    newSlots[index] = updatedSlot;
    setSlots(newSlots);
    setHasChanges(true);
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSaveAvailability = () => {
    setAvailability.mutate({ availability: slots });
  };

  const handleBlockDate = () => {
    if (!newBlockDate) return;
    blockDate.mutate({
      date: new Date(newBlockDate).toISOString(),
      reason: newBlockReason || undefined,
    });
  };

  const handleUpdateSettings = (settings: { duration: number; bufferTime: number; maxDaily: number }) => {
    updateProfile.mutate({
      appointmentDuration: settings.duration,
      bufferTime: settings.bufferTime,
      maxDailyAppointments: settings.maxDaily,
    });
  };

  const blockedDates = blockedDatesData?.blockedDates ?? [];
  const isLoading = profileLoading || availabilityLoading || blockedLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="h-48 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Availability</h1>
          <p className="text-slate-500 mt-1">Set your weekly schedule and block specific dates</p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSaveAvailability}
            disabled={setAvailability.isPending}
            className="px-6 py-2.5 bg-medical-600 text-white rounded-xl font-medium hover:bg-medical-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {setAvailability.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        )}
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          saveMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {saveMessage.text}
        </div>
      )}

      {/* Weekly Schedule */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-medical-600" />
          Weekly Schedule
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS_OF_WEEK.map((day) => (
            <DayScheduleCard
              key={day.value}
              day={day}
              slots={slots}
              onAddSlot={() => handleAddSlot(day.value)}
              onUpdateSlot={handleUpdateSlot}
              onRemoveSlot={handleRemoveSlot}
            />
          ))}
        </div>
      </div>

      {/* Bottom Section: Blocked Dates & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocked Dates */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              <h3 className="font-semibold text-slate-700">Blocked Dates</h3>
            </div>
            <button
              onClick={() => setShowBlockForm(!showBlockForm)}
              className="text-sm text-medical-600 hover:text-medical-700 font-medium"
            >
              {showBlockForm ? 'Cancel' : '+ Block Date'}
            </button>
          </div>
          <div className="p-4 space-y-3">
            {showBlockForm && (
              <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newBlockDate}
                    onChange={(e) => setNewBlockDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    placeholder="e.g., Holiday, Conference"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical-500"
                  />
                </div>
                <button
                  onClick={handleBlockDate}
                  disabled={!newBlockDate || blockDate.isPending}
                  className="w-full py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {blockDate.isPending ? 'Blocking...' : 'Block This Date'}
                </button>
              </div>
            )}
            
            {blockedDates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No blocked dates</p>
            ) : (
              blockedDates.map((bd) => (
                <BlockedDateCard
                  key={bd.id}
                  blockedDate={bd}
                  onUnblock={() => unblockDate.mutate({ blockedDateId: bd.id })}
                  isUnblocking={unblockDate.isPending}
                />
              ))
            )}
          </div>
        </div>

        {/* Appointment Settings */}
        <AppointmentSettingsCard
          duration={doctorProfile?.appointmentDuration ?? 30}
          bufferTime={doctorProfile?.bufferTime ?? 10}
          maxDaily={doctorProfile?.maxDailyAppointments ?? 20}
          onUpdate={handleUpdateSettings}
          isSaving={updateProfile.isPending}
        />
      </div>
    </div>
  );
}
