'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, CheckCircle, ChevronLeft, MapPin } from 'lucide-react';
import { api } from '@/trpc/react';
import { ConfirmationScreen } from './ConfirmationScreen';
import { ProgressStepper, type Step } from './ProgressStepper';

// Import skeleton component for loading states
const TimeSlotSkeleton = () => (
  <button className="w-full p-4 border-2 border-slate-200 rounded-xl text-left animate-pulse" disabled>
    <div className="h-5 bg-slate-200 rounded w-24 mb-1"></div>
    <div className="h-4 bg-slate-200 rounded w-16"></div>
  </button>
);

interface SimplifiedBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  doctorId: string;
  intakeSessionId?: string;
  onBooked: () => void;
}

type BookingStep = 'week' | 'day' | 'time' | 'confirm' | 'success';

type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening';

interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  reason?: string;
  location?: string | null;
}

interface GroupedSlots {
  Morning: TimeSlot[];
  Afternoon: TimeSlot[];
  Evening: TimeSlot[];
}

const SimplifiedBookingModal: React.FC<SimplifiedBookingModalProps> = ({
  isOpen,
  onClose,
  connectionId,
  doctorId,
  intakeSessionId,
  onBooked,
}) => {
  const [step, setStep] = useState<BookingStep>('week');
  const [selectedWeek, setSelectedWeek] = useState<'this_week' | 'next_week' | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    label: string;
    scheduledAtIso: string;
    location?: string | null;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  const utils = api.useUtils();

  // Define booking steps for progress indicator
  const bookingSteps: Step[] = [
    { id: 'week', label: 'Week', description: 'Choose week' },
    { id: 'day', label: 'Day', description: 'Select date' },
    { id: 'time', label: 'Time', description: 'Pick time' },
    { id: 'confirm', label: 'Confirm', description: 'Review' },
  ];

  // Calculate current step index and completed steps
  const currentStepIndex = bookingSteps.findIndex(s => s.id === step);
  const completedSteps = bookingSteps
    .slice(0, currentStepIndex)
    .map((_, index) => index);

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

  const dateOptions = useMemo(() => {
    if (!selectedWeek) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedWeek === 'this_week') {
      const end = endOfWeek(today);
      const days: Date[] = [];
      const cur = new Date(today);
      while (cur <= end) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return days;
    }

    // next_week
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
  }, [selectedWeek]);

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

  const availableSlots = (availableSlotsData?.slots ?? []) as TimeSlot[];

  // Group time slots by time of day
  const groupedSlots = useMemo((): GroupedSlots => {
    const groups: GroupedSlots = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };

    availableSlots.forEach((slot) => {
      const hour = parseInt(slot.startTime.split(':')[0] ?? '0', 10);
      
      if (hour < 12) {
        groups.Morning.push(slot);
      } else if (hour >= 12 && hour < 17) {
        groups.Afternoon.push(slot);
      } else {
        groups.Evening.push(slot);
      }
    });

    return groups;
  }, [availableSlots]);

  useEffect(() => {
    if (!isOpen) return;
    setStep('week');
    setSelectedWeek(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setIsOnline(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleWeekSelect = (week: 'this_week' | 'next_week') => {
    setSelectedWeek(week);
    setStep('day');
  };

  const handleDaySelect = (date: string) => {
    setSelectedDate(date);
    setStep('time');
  };

  const handleTimeSelect = (slot: TimeSlot) => {
    if (!selectedDate || !slot.isAvailable) return;
    
    const scheduledAtIso = new Date(`${selectedDate}T${slot.startTime}:00`).toISOString();
    setSelectedSlot({
      label: `${selectedDateLabel} at ${slot.startTime}`,
      scheduledAtIso,
      location: slot.location ?? null,
    });
    setStep('confirm');
  };

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
          setStep('success');
          setTimeout(() => {
            onBooked();
          }, 2500);
        },
      }
    );
  };

  const handleBack = () => {
    if (step === 'day') {
      setStep('week');
      setSelectedWeek(null);
    } else if (step === 'time') {
      setStep('day');
      setSelectedDate(null);
    } else if (step === 'confirm') {
      setStep('time');
      setSelectedSlot(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        {/* Progress Indicator - Show for all steps except success */}
        {step !== 'success' && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <ProgressStepper
              steps={bookingSteps}
              currentStep={currentStepIndex}
              completedSteps={completedSteps}
              variant="dots"
              showLabels={true}
            />
          </div>
        )}

        {/* Step 1: Week Selection */}
        {step === 'week' && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#25D366]/10 p-3 rounded-full text-[#25D366]">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Choose a Week</h2>
                <p className="text-sm text-slate-500">When would you like to visit?</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleWeekSelect('this_week')}
                className="w-full p-6 rounded-2xl border-2 border-slate-200 hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-slate-800 mb-1">This Week</div>
                    <div className="text-sm text-slate-500">
                      {(() => {
                        const today = new Date();
                        const end = endOfWeek(today);
                        return `${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                      })()}
                    </div>
                  </div>
                  <Calendar className="w-8 h-8 text-slate-400 group-hover:text-[#25D366] transition-colors" />
                </div>
              </button>

              <button
                onClick={() => handleWeekSelect('next_week')}
                className="w-full p-6 rounded-2xl border-2 border-slate-200 hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-slate-800 mb-1">Next Week</div>
                    <div className="text-sm text-slate-500">
                      {(() => {
                        const today = new Date();
                        const thisWeekEnd = endOfWeek(today);
                        const nextWeekStart = new Date(thisWeekEnd);
                        nextWeekStart.setDate(nextWeekStart.getDate() + 1);
                        const nextWeekEnd = endOfWeek(nextWeekStart);
                        return `${nextWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${nextWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                      })()}
                    </div>
                  </div>
                  <Calendar className="w-8 h-8 text-slate-400 group-hover:text-[#25D366] transition-colors" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Day Selection */}
        {step === 'day' && (
          <div className="p-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#25D366]/10 p-3 rounded-full text-[#25D366]">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Choose a Day</h2>
                <p className="text-sm text-slate-500">Select your preferred date</p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-6 px-6">
              <div className="flex gap-3 pb-2">
                {dateOptions.map((d) => {
                  const ymd = toYmd(d);
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = d.getDate();
                  const monthName = d.toLocaleDateString('en-US', { month: 'short' });
                  
                  return (
                    <button
                      key={ymd}
                      onClick={() => handleDaySelect(ymd)}
                      className="shrink-0 w-24 p-4 rounded-2xl border-2 border-slate-200 hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all"
                    >
                      <div className="text-xs text-slate-500 mb-1">{dayName}</div>
                      <div className="text-2xl font-bold text-slate-800 mb-1">{dayNum}</div>
                      <div className="text-xs text-slate-500">{monthName}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Time Selection */}
        {step === 'time' && (
          <div className="p-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#25D366]/10 p-3 rounded-full text-[#25D366]">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Choose a Time</h2>
                <p className="text-sm text-slate-500">{selectedDateLabel}</p>
              </div>
            </div>

            {/* Online/In-person toggle */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setIsOnline(false)}
                className={`flex-1 px-4 py-3 rounded-xl text-base font-semibold border-2 transition-all ${
                  !isOnline
                    ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366]'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                In-person
              </button>
              <button
                onClick={() => setIsOnline(true)}
                className={`flex-1 px-4 py-3 rounded-xl text-base font-semibold border-2 transition-all ${
                  isOnline
                    ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366]'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Online
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {slotsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <TimeSlotSkeleton key={i} />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-6 text-center text-slate-500">No times available for this day</div>
              ) : (
                <>
                  {(['Morning', 'Afternoon', 'Evening'] as TimeOfDay[]).map((timeOfDay) => {
                    const slots = groupedSlots[timeOfDay];
                    if (slots.length === 0) return null;

                    return (
                      <div key={timeOfDay}>
                        <div className="text-sm font-semibold text-slate-600 mb-2">{timeOfDay}</div>
                        <div className="space-y-2">
                          {slots.map((slot, idx) => (
                            <button
                              key={`${slot.startTime}-${idx}`}
                              onClick={() => handleTimeSelect(slot)}
                              disabled={!slot.isAvailable}
                              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                !slot.isAvailable
                                  ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'border-slate-200 hover:border-[#25D366] hover:bg-[#25D366]/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-base">
                                    {slot.startTime}
                                  </div>
                                  {slot.location && !isOnline && (
                                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                      <MapPin className="w-3 h-3" />
                                      <span>{slot.location}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm font-medium text-slate-500">
                                  {slot.isAvailable ? 'Available' : 'Booked'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 'confirm' && (
          <div className="p-6">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-[#25D366]/10 p-3 rounded-full text-[#25D366]">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Confirm Booking</h2>
                <p className="text-sm text-slate-500">Review your appointment</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 mb-6 space-y-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Date & Time</div>
                <div className="text-base font-semibold text-slate-800">{selectedSlot?.label}</div>
              </div>
              
              <div>
                <div className="text-xs text-slate-500 mb-1">Type</div>
                <div className="text-base font-semibold text-slate-800">
                  {isOnline ? 'Online (Video Call)' : 'In-person Visit'}
                </div>
              </div>

              {!isOnline && selectedSlot?.location && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Location</div>
                  <div className="text-base font-semibold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {selectedSlot.location}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleConfirm}
              disabled={createAppointment.isPending}
              className="w-full bg-[#25D366] text-white py-4 rounded-xl text-lg font-bold hover:bg-[#20BA5A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createAppointment.isPending ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        )}

        {/* Success Screen */}
        {step === 'success' && (
          <ConfirmationScreen
            icon={<CheckCircle />}
            title="Booking Confirmed!"
            message="Your appointment has been successfully scheduled"
            details={[
              {
                label: 'Date & Time',
                value: selectedSlot?.label ?? '',
              },
              {
                label: 'Type',
                value: isOnline ? 'Online (Video Call)' : 'In-person Visit',
              },
              ...((!isOnline && selectedSlot?.location) ? [{
                label: 'Location',
                value: selectedSlot.location,
              }] : []),
            ]}
            primaryAction={{
              label: 'Done',
              onTap: () => {
                onBooked();
                onClose();
              },
            }}
            autoClose={3000}
            onClose={() => {
              onBooked();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SimplifiedBookingModal;
