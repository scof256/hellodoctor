'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, CheckCircle, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { api } from '@/trpc/react';
import { DoctorProfileSummary } from './DoctorProfileSummary';

// Import skeleton components for loading states
const TimeSlotSkeleton = () => (
  <div className="p-3 border border-slate-200 rounded-lg animate-pulse">
    <div className="h-5 bg-slate-200 rounded w-24 mb-1"></div>
    <div className="h-4 bg-slate-200 rounded w-16"></div>
  </div>
);

const ProfileSummarySkeleton = () => (
  <div className="bg-white rounded-xl border-2 border-slate-200 p-4 mb-4 animate-pulse">
    <div className="flex items-start gap-4 mb-4">
      <div className="w-16 h-16 rounded-full bg-slate-200"></div>
      <div className="flex-1">
        <div className="h-5 bg-slate-200 rounded w-32 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-24"></div>
      </div>
    </div>
    <div className="flex gap-2 mb-3">
      <div className="h-6 bg-slate-200 rounded-full w-20"></div>
      <div className="h-6 bg-slate-200 rounded-full w-24"></div>
    </div>
    <div className="flex justify-between pt-3 border-t border-slate-200">
      <div className="h-4 bg-slate-200 rounded w-20"></div>
      <div className="h-4 bg-slate-200 rounded w-24"></div>
    </div>
  </div>
);

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  doctorId: string;
  intakeSessionId?: string;
  onBooked: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  doctorId,
  intakeSessionId,
  onBooked,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<{
    label: string;
    scheduledAtIso: string;
    location?: string | null;
  } | null>(null);
  const [dateRange, setDateRange] = useState<'this_week' | 'next_week' | 'month'>('this_week');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isOnline, setIsOnline] = useState(false);

  const utils = api.useUtils();

  const createAppointment = api.appointment.create.useMutation({
    onSuccess: async () => {
      if (intakeSessionId) {
        await utils.intake.getSession.invalidate({ sessionId: intakeSessionId });
      }
      await utils.intake.getMyIntakeSessions.invalidate();
      await utils.intake.getAllSessionsWithAppointments.invalidate();
      await utils.appointment.getMyAppointments.invalidate();
    },
  });

  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
  };

  const endOfWeek = (date: Date) => {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
  };

  const getDefaultDateForRange = (range: 'this_week' | 'next_week' | 'month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (range === 'next_week') {
      const thisWeekEnd = endOfWeek(today);
      const nextWeekStart = new Date(thisWeekEnd);
      nextWeekStart.setDate(nextWeekStart.getDate() + 1);
      return nextWeekStart;
    }

    return today;
  };

  const dateOptions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateRange === 'this_week') {
      const end = endOfWeek(today);
      const days: Date[] = [];
      const cur = new Date(today);
      while (cur <= end) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    if (dateRange === 'next_week') {
      const thisWeekEnd = endOfWeek(today);
      const nextWeekStart = new Date(thisWeekEnd);
      nextWeekStart.setDate(nextWeekStart.getDate() + 1);
      const nextWeekEnd = endOfWeek(nextWeekStart);
      const days: Date[] = [];
      const cur = new Date(nextWeekStart);
      while (cur <= nextWeekEnd) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    const days: Date[] = [];
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [dateRange]);

  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return null;
    const d = new Date(selectedDate);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }, [selectedDate]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateObj) return '';
    return selectedDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [selectedDateObj]);

  const { data: availableSlotsData, isLoading: slotsLoading } = api.appointment.getAvailableSlots.useQuery(
    {
      doctorId,
      date: selectedDate ?? toYmd(new Date()),
    },
    {
      enabled: isOpen && !!doctorId && !!selectedDate,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch doctor's public profile for display
  const { data: doctorProfile, isLoading: profileLoading } = api.doctor.getPublicProfile.useQuery(
    { doctorId },
    {
      enabled: isOpen && !!doctorId,
      refetchOnWindowFocus: false,
    }
  );

  const availableSlots = (availableSlotsData?.slots ?? []) as Array<{
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    reason?: string;
    location?: string | null;
  }>;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSlot(null);
    setStep('select');
    setDateRange('this_week');
    setIsOnline(false);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(toYmd(today));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedSlot) return;
    if (!connectionId || !doctorId) return;

    createAppointment.mutate(
      {
        connectionId,
        scheduledAt: selectedSlot.scheduledAtIso,
        intakeSessionId,
        isOnline,
      },
      {
        onSuccess: () => {
          setStep('confirm');
          setTimeout(() => {
            onBooked();
          }, 1500);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        {step === 'select' ? (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-medical-100 p-3 rounded-full text-medical-600">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Book Appointment</h2>
                <p className="text-sm text-slate-500">Choose a date and time</p>
              </div>
            </div>

            {/* Doctor Profile Summary */}
            {profileLoading ? (
              <ProfileSummarySkeleton />
            ) : doctorProfile ? (
              <DoctorProfileSummary
                doctorId={doctorId}
                name={doctorProfile.name}
                profilePhotoUrl={doctorProfile.profilePhotoUrl}
                specializations={doctorProfile.specializations}
                yearsOfExperience={doctorProfile.yearsOfExperience}
                consultationFee={doctorProfile.consultationFee}
                currency="UGX"
              />
            ) : null}

            <div className="flex items-center gap-2 mb-4">
              {([
                { key: 'this_week', label: 'This week' },
                { key: 'next_week', label: 'Next week' },
                { key: 'month', label: 'Monthly' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    const d = getDefaultDateForRange(t.key);
                    setDateRange(t.key);
                    setSelectedDate(toYmd(d));
                    setSelectedSlot(null);
                  }}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    dateRange === t.key
                      ? 'border-medical-500 bg-medical-50 text-medical-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setIsOnline(false)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  !isOnline
                    ? 'border-medical-500 bg-medical-50 text-medical-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                In-person
              </button>
              <button
                onClick={() => setIsOnline(true)}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  isOnline
                    ? 'border-medical-500 bg-medical-50 text-medical-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Online (Video)
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  if (!selectedDate) return;
                  const idx = dateOptions.findIndex((d) => toYmd(d) === selectedDate);
                  if (idx <= 0) return;
                  const prev = dateOptions[idx - 1];
                  if (!prev) return;
                  setSelectedDate(toYmd(prev));
                  setSelectedSlot(null);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-40"
                disabled={!selectedDate || dateOptions.findIndex((d) => toYmd(d) === selectedDate) <= 0}
                title="Previous day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-x-auto">
                <div className="flex items-center gap-2">
                  {dateOptions.map((d) => {
                    const ymd = toYmd(d);
                    const isSelected = ymd === selectedDate;
                    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <button
                        key={ymd}
                        onClick={() => {
                          setSelectedDate(ymd);
                          setSelectedSlot(null);
                        }}
                        className={`shrink-0 px-3 py-2 rounded-xl border text-sm transition-all ${
                          isSelected
                            ? 'border-medical-500 bg-medical-50 text-medical-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title={d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                      >
                        <div className="text-xs opacity-80">{day}</div>
                        <div className="font-semibold">{d.getDate()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  if (!selectedDate) return;
                  const idx = dateOptions.findIndex((d) => toYmd(d) === selectedDate);
                  if (idx < 0 || idx >= dateOptions.length - 1) return;
                  const next = dateOptions[idx + 1];
                  if (!next) return;
                  setSelectedDate(toYmd(next));
                  setSelectedSlot(null);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-40"
                disabled={!selectedDate || dateOptions.findIndex((d) => toYmd(d) === selectedDate) >= dateOptions.length - 1}
                title="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {selectedDateLabel && (
              <div className="text-sm text-slate-600 mb-3">
                {selectedDateLabel}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {slotsLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <TimeSlotSkeleton key={i} />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No available slots for this day.</div>
              ) : (
                availableSlots.map((slot, idx) => {
                  const label = `${slot.startTime} - ${slot.endTime}`;
                  const scheduledAtIso = selectedDate
                    ? new Date(`${selectedDate}T${slot.startTime}:00`).toISOString()
                    : '';
                  const isSelected = selectedSlot?.scheduledAtIso === scheduledAtIso;
                  return (
                    <button
                      key={`${slot.startTime}-${idx}`}
                      onClick={() => {
                        if (!selectedDate) return;
                        if (!slot.isAvailable) return;
                        setSelectedSlot({
                          label: `${selectedDateLabel} at ${slot.startTime}`,
                          scheduledAtIso,
                          location: slot.location ?? null,
                        });
                      }}
                      disabled={!slot.isAvailable}
                      className={`w-full flex items-start justify-between p-4 rounded-xl border transition-all text-left ${
                        !slot.isAvailable
                          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : isSelected
                            ? 'border-medical-500 bg-medical-50 text-medical-700 ring-1 ring-medical-500'
                            : 'border-slate-200 hover:border-medical-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{label}</span>
                        </div>
                        {slot.location && (
                          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{slot.location}</span>
                          </div>
                        )}
                        {!slot.isAvailable && slot.reason && (
                          <div className="mt-1 text-xs">{slot.reason}</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold">
                        {slot.isAvailable ? 'Select' : 'Unavailable'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selectedSlot || createAppointment.isPending}
              className="w-full bg-medical-600 text-white py-3 rounded-xl font-bold hover:bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createAppointment.isPending ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Booking Confirmed!</h3>
            <p className="text-slate-500">We have sent your intake analysis to the doctor. See you {selectedSlot?.label}.</p>
            {!isOnline && selectedSlot?.location && (
              <p className="text-slate-500 mt-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {selectedSlot.location}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingModal;
