'use client';

import React, { useState, useMemo, useEffect, useCallback, createContext, useContext } from 'react';
import { ChatContainer } from './ChatContainer';
import { SidebarContainer } from './SidebarContainer';
import BookingModal from '../BookingModal';
import DirectChatOverlay from '../DirectChatOverlay';
import {
  Message, MedicalData, DoctorThought,
  INITIAL_MEDICAL_DATA, INITIAL_THOUGHT,
  IntakeStage, DirectMessage, AgentResponse
} from '../../types';
import { Menu, X, CalendarCheck, User, Stethoscope, MessageSquare } from 'lucide-react';

/**
 * Optimized AppClient Component
 * Requirements: 8.4, 8.5
 * 
 * This component splits the original AppClient into separate memoized containers
 * for chat, sidebar, and modals. Uses context selectors for global state to
 * prevent unnecessary subscriber updates.
 */

// Context for global state that needs to be shared (Requirements: 8.5)
interface AppContextValue {
  viewMode: 'patient' | 'doctor';
  isLoading: boolean;
  medicalData: MedicalData;
}

const AppContext = createContext<AppContextValue | null>(null);

// Custom hook for context selector pattern
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

const OptimizedAppClient: React.FC = () => {
  const [viewMode, setViewMode] = useState<'patient' | 'doctor'>('patient');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello. I'm HelloDoctor. I'm here to gather some preliminary information to prepare a file for your doctor. To start, could you tell me why you need an appointment today?",
      timestamp: new Date(),
      activeAgent: 'Triage'
    }
  ]);

  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [isDMOpen, setIsDMOpen] = useState(false);
  const [unreadDMCount, setUnreadDMCount] = useState(0);

  const [doctorMessages, setDoctorMessages] = useState<Message[]>([
    {
      id: 'doc-welcome',
      role: 'model',
      text: "I have reviewed the patient intake data. I am ready to assist with differential diagnosis, checking UCG protocols, or documenting new exam findings. How should we proceed?",
      timestamp: new Date()
    }
  ]);

  const [medicalData, setMedicalData] = useState<MedicalData>(INITIAL_MEDICAL_DATA);
  const [thought, setThought] = useState<DoctorThought>(INITIAL_THOUGHT);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  useEffect(() => {
    if (isDMOpen) {
      setUnreadDMCount(0);
    }
  }, [isDMOpen]);

  const { stage, completeness } = useMemo(() => {
    const fields: (keyof MedicalData)[] = [
      'chiefComplaint', 'hpi', 'medications', 'allergies',
      'pastMedicalHistory', 'familyHistory', 'socialHistory'
    ];
    let filled = 0;
    fields.forEach(field => {
      const val = medicalData[field];
      if (Array.isArray(val)) {
        if (val.length > 0) filled++;
      } else {
        if (val) filled++;
      }
    });
    if (medicalData.recordsCheckCompleted) filled += 0.5;

    const compScore = Math.min(100, Math.round((filled / fields.length) * 100));

    let currentStage: IntakeStage = 'triage';

    if (medicalData.currentAgent === 'Triage') currentStage = 'triage';
    else if (medicalData.currentAgent === 'ClinicalInvestigator') currentStage = 'investigation';
    else if (medicalData.currentAgent === 'RecordsClerk') currentStage = 'records';
    else if (medicalData.currentAgent === 'HistorySpecialist') currentStage = 'profile';
    else if (medicalData.currentAgent === 'HandoverSpecialist') currentStage = 'summary';

    return { stage: currentStage, completeness: compScore };
  }, [medicalData]);

  // Memoized process response function
  const processResponse = useCallback((response: AgentResponse, groundingMetadata: unknown) => {
    const safeUpdatedData = response.updatedData || {};

    setMedicalData(prev => ({
      ...prev,
      ...safeUpdatedData,
      medicalRecords: safeUpdatedData.medicalRecords
        ? [...new Set([...prev.medicalRecords, ...safeUpdatedData.medicalRecords])]
        : prev.medicalRecords,
      recordsCheckCompleted: safeUpdatedData.recordsCheckCompleted !== undefined
        ? safeUpdatedData.recordsCheckCompleted
        : prev.recordsCheckCompleted,
      medications: safeUpdatedData.medications
        ? [...new Set([...prev.medications, ...safeUpdatedData.medications])]
        : prev.medications,
      allergies: safeUpdatedData.allergies
        ? [...new Set([...prev.allergies, ...safeUpdatedData.allergies])]
        : prev.allergies,
      pastMedicalHistory: safeUpdatedData.pastMedicalHistory
        ? [...new Set([...prev.pastMedicalHistory, ...safeUpdatedData.pastMedicalHistory])]
        : prev.pastMedicalHistory,
      reviewOfSystems: safeUpdatedData.reviewOfSystems
        ? [...new Set([...prev.reviewOfSystems, ...safeUpdatedData.reviewOfSystems])]
        : prev.reviewOfSystems,
      clinicalHandover: safeUpdatedData.clinicalHandover
        ? safeUpdatedData.clinicalHandover
        : prev.clinicalHandover,
      currentAgent: response.activeAgent || prev.currentAgent
    }));

    setThought(response.thought || INITIAL_THOUGHT);

    return {
      id: (Date.now() + 1).toString(),
      role: 'model' as const,
      text: response.reply || "I apologize, but I am having trouble processing that information right now.",
      timestamp: new Date(),
      groundingMetadata,
      activeAgent: response.activeAgent
    };
  }, []);

  // Memoized send message handler (Requirements: 2.3)
  const handleSendMessage = useCallback(async (text: string, images: string[]) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      images,
      timestamp: new Date()
    };

    if (viewMode === 'patient') {
      setMessages(prev => {
        const newHistory = [...prev, userMsg];
        // Trigger API call
        (async () => {
          setIsLoading(true);
          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                history: newHistory,
                medicalData,
                mode: 'patient'
              })
            });

            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const modelMsg = processResponse(data.response, data.groundingMetadata);
            setMessages(current => [...current, modelMsg]);
          } catch (error) {
            console.error("Failed to send patient message", error);
            setMessages(current => [...current, {
              id: Date.now().toString(),
              role: 'model',
              text: "I apologize, but I encountered a connection error. Please try again.",
              timestamp: new Date()
            }]);
          } finally {
            setIsLoading(false);
          }
        })();
        return newHistory;
      });
    } else {
      setDoctorMessages(prev => {
        const newHistory = [...prev, userMsg];
        // Trigger API call
        (async () => {
          setIsLoading(true);
          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                history: newHistory,
                medicalData,
                mode: 'doctor'
              })
            });

            if (!response.ok) {
              throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const modelMsg = processResponse(data.response, data.groundingMetadata);
            setDoctorMessages(current => [...current, modelMsg]);
          } catch (error) {
            console.error("Failed to send doctor message", error);
            setDoctorMessages(current => [...current, {
              id: Date.now().toString(),
              role: 'model',
              text: "I apologize, but I encountered a connection error. Please try again.",
              timestamp: new Date()
            }]);
          } finally {
            setIsLoading(false);
          }
        })();
        return newHistory;
      });
    }
  }, [viewMode, medicalData, processResponse]);

  // Memoized topic trigger handler
  const handleTopicTrigger = useCallback(async (field: keyof MedicalData) => {
    if (isLoading || viewMode === 'doctor') return;
    setIsLoading(true);

    const fieldNames: Record<string, string> = {
      chiefComplaint: "Chief Complaint",
      hpi: "Details of the illness",
      medications: "Current Medications",
      allergies: "Allergies",
      pastMedicalHistory: "Past Medical History",
      familyHistory: "Family Medical History",
      socialHistory: "Lifestyle/Social History",
    };
    const fieldName = fieldNames[field] || field;

    const directiveMsg: Message = {
      id: `trigger-${Date.now()}`,
      role: 'user',
      text: `[SYSTEM_DIRECTIVE]: The user manually triggered the "${fieldName}" topic. Please activate the relevant agent to discuss this.`,
      timestamp: new Date()
    };

    try {
      const apiHistory = [...messages, directiveMsg];
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: apiHistory,
          medicalData,
          mode: 'patient'
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const modelMsg = processResponse(data.response, data.groundingMetadata);
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Failed to trigger topic", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, viewMode, messages, medicalData, processResponse]);

  // Memoized booking confirm handler
  const handleBookingConfirm = useCallback((date: string) => {
    setMedicalData(prev => ({ ...prev, bookingStatus: 'booked', appointmentDate: date }));
    setIsBookingModalOpen(false);
    const confirmMsg: Message = {
      id: Date.now().toString(),
      role: 'model',
      text: `**Appointment Confirmed!** \n\nI have booked you for **${date}** and forwarded the clinical handover note to the doctor.`,
      timestamp: new Date(),
      activeAgent: 'HandoverSpecialist'
    };
    setMessages(prev => [...prev, confirmMsg]);
  }, []);

  // Memoized direct message handler
  const handleSendDirectMessage = useCallback((text: string) => {
    const newMessage: DirectMessage = {
      id: Date.now().toString(),
      sender: viewMode,
      text,
      timestamp: new Date(),
      read: false
    };

    setDirectMessages(prev => [...prev, newMessage]);

    if (isDMOpen) {
      setUnreadDMCount(0);
    }
  }, [viewMode, isDMOpen]);

  useEffect(() => {
    if (directMessages.length > 0) {
      const lastMsg = directMessages[directMessages.length - 1];
      if (lastMsg && lastMsg.sender !== viewMode && !isDMOpen) {
        setUnreadDMCount(prev => prev + 1);
      }
    }
  }, [directMessages, viewMode, isDMOpen]);

  // Memoized UI handlers
  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleToggleDM = useCallback(() => setIsDMOpen(prev => !prev), []);
  const handleCloseDM = useCallback(() => setIsDMOpen(false), []);
  const handleOpenBooking = useCallback(() => setIsBookingModalOpen(true), []);
  const handleCloseBooking = useCallback(() => setIsBookingModalOpen(false), []);
  const handleSetPatientMode = useCallback(() => setViewMode('patient'), []);
  const handleSetDoctorMode = useCallback(() => setViewMode('doctor'), []);

  // Context value for global state (Requirements: 8.5)
  const contextValue = useMemo<AppContextValue>(() => ({
    viewMode,
    isLoading,
    medicalData
  }), [viewMode, isLoading, medicalData]);

  // Current messages based on view mode
  const currentMessages = viewMode === 'patient' ? messages : doctorMessages;

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-slate-100 overflow-hidden font-sans relative">

        {!isDMOpen && (
          <div className="md:hidden fixed top-4 right-4 z-50">
            <button
              onClick={handleToggleSidebar}
              className="bg-white p-2 rounded-full shadow-lg text-medical-700 hover:bg-medical-50 transition-colors"
            >
              {sidebarOpen ? <X /> : <Menu />}
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col h-full w-full md:w-3/5 lg:w-2/3 relative z-0">
          <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow-lg transition-colors ${viewMode === 'doctor' ? 'bg-purple-600 shadow-purple-200' : 'bg-medical-600 shadow-medical-200'}`}>
                {viewMode === 'doctor' ? '🩺' : '⚕️'}
              </div>
              <div>
                <h1 className="font-bold text-slate-800 text-lg leading-tight">HelloDoctor</h1>
                <p className="text-xs text-slate-500">
                  {viewMode === 'doctor' ? 'Clinical Decision Support' : 'Automated Intake & Booking'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
                <button
                  onClick={handleSetPatientMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === 'patient' ? 'bg-white text-medical-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <User className="w-3 h-3" /> Patient
                </button>
                <button
                  onClick={handleSetDoctorMode}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === 'doctor' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Stethoscope className="w-3 h-3" /> Doctor
                </button>
              </div>
              {viewMode === 'patient' && medicalData.bookingStatus === 'ready' && (
                <button
                  onClick={handleOpenBooking}
                  className="hidden md:flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg animate-pulse transition-all"
                >
                  <CalendarCheck className="w-5 h-5" /> Book Now
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative">
            {viewMode === 'doctor' && (
              <div className="absolute inset-0 bg-purple-50/50 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle, #e9d5ff 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.5 }}></div>
            )}

            {/* Memoized Chat Container - isolated from sidebar state (Requirements: 8.1) */}
            <ChatContainer
              messages={currentMessages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              currentStage={stage}
              completeness={completeness}
              variant={viewMode}
            />

            {viewMode === 'patient' && medicalData.bookingStatus === 'ready' && (
              <div className="absolute bottom-24 left-6 z-20 md:hidden">
                <button
                  onClick={handleOpenBooking}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-full font-bold shadow-xl animate-bounce"
                >
                  <CalendarCheck className="w-5 h-5" /> Book
                </button>
              </div>
            )}
          </div>

          <div className="absolute bottom-24 right-6 md:bottom-28 md:right-6 z-30">
            <button
              onClick={handleToggleDM}
              className={`
                group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110
                ${viewMode === 'patient' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-medical-600 hover:bg-medical-700'}
              `}
              title={viewMode === 'patient' ? "Chat with Dr. Smith" : "Message Patient"}
            >
              {unreadDMCount > 0 && !isDMOpen && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-pulse z-40">
                  {unreadDMCount}
                </span>
              )}
              {isDMOpen ? <X className="w-6 h-6 text-white" /> : <MessageSquare className="w-6 h-6 text-white" />}
              <span className="absolute right-full mr-3 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {viewMode === 'patient' ? 'Ask Dr. Smith' : 'Direct Message'}
              </span>
            </button>
          </div>

          <DirectChatOverlay
            isOpen={isDMOpen}
            onClose={handleCloseDM}
            messages={directMessages}
            onSendMessage={handleSendDirectMessage}
            currentUser={viewMode}
          />
        </div>

        {/* Memoized Sidebar Container - isolated from chat state (Requirements: 8.2) */}
        <div className={`
          fixed inset-y-0 right-0 w-full md:w-2/5 lg:w-1/3 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40
          md:relative md:transform-none md:shadow-none md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <SidebarContainer
            data={medicalData}
            thought={thought}
            onTopicTrigger={handleTopicTrigger}
          />
        </div>

        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={handleCloseBooking}
          onConfirm={handleBookingConfirm}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
            onClick={handleCloseSidebar}
          />
        )}
      </div>
    </AppContext.Provider>
  );
};

export default OptimizedAppClient;
