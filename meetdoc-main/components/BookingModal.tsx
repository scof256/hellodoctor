import React, { useState } from 'react';
import { Calendar, Clock, CheckCircle } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  if (!isOpen) return null;

  // Mock slots
  const slots = [
    { day: 'Today', time: '14:30 PM' },
    { day: 'Today', time: '16:00 PM' },
    { day: 'Tomorrow', time: '09:00 AM' },
    { day: 'Tomorrow', time: '11:30 AM' },
  ];

  const handleConfirm = () => {
    if (selectedDate) {
      setStep('confirm');
      setTimeout(() => {
        onConfirm(selectedDate);
      }, 1500);
    }
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
                <p className="text-sm text-slate-500">Choose a time for Dr. Smith</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {slots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(`${slot.day} at ${slot.time}`)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                    selectedDate === `${slot.day} at ${slot.time}`
                      ? 'border-medical-500 bg-medical-50 text-medical-700 ring-1 ring-medical-500'
                      : 'border-slate-200 hover:border-medical-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold">{slot.day}</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{slot.time}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selectedDate}
              className="w-full bg-medical-600 text-white py-3 rounded-xl font-bold hover:bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Booking
            </button>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">Booking Confirmed!</h3>
            <p className="text-slate-500">We have sent your intake analysis to the doctor. See you {selectedDate}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingModal;