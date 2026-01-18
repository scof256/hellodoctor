'use client';

import React, { useState, useMemo, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import MedicalSidebar from './MedicalSidebar';
import { LazyBookingModal, LazyDirectChatOverlay } from '../lib/lazy-components';
import { 
  Message, MedicalData, DoctorThought, 
  INITIAL_MEDICAL_DATA, INITIAL_THOUGHT, 
  IntakeStage, DirectMessage, AgentResponse 
} from '../types';
import { calculateUIState, determineAgent } from '../lib/agent-router';
import { mergeMedicalData, validateMedicalData } from '../lib/medical-data-processor';
import { Menu, X, CalendarCheck, User, Stethoscope, MessageSquare } from 'lucide-react';

const AppClient: React.FC = () => {
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
    // Use centralized UI state calculation to ensure consistency
    return calculateUIState(medicalData);
  }, [medicalData]);

  const processResponse = (response: AgentResponse, groundingMetadata: unknown) => {
    try {
      // Use the simplified medical data processor for reliable data merging
      const updatedMedicalData = mergeMedicalData(
        medicalData,
        response.updatedData || {},
        response.activeAgent
      );

      // Validate the merged data for consistency
      const validation = validateMedicalData(updatedMedicalData);
      if (!validation.isValid) {
        console.warn('Medical data validation warnings:', validation.errors);
        // Continue with the data but log warnings for debugging
      }

      // Update medical data state with merged and validated data
      setMedicalData(updatedMedicalData);
      
      // Update doctor thought with fallback to current thought
      setThought(response.thought || thought);
      
      // Create the message with proper fallbacks
      return {
        id: (Date.now() + 1).toString(),
        role: 'model' as const,
        text: response.reply || "I apologize, but I am having trouble processing that information right now. Could you please try rephrasing your response?",
        timestamp: new Date(),
        groundingMetadata,
        activeAgent: updatedMedicalData.currentAgent // Use the determined agent from merged data
      };
    } catch (error) {
      console.error('Error processing response:', error);
      
      // Fallback: preserve existing medical data and provide error message
      const fallbackAgent = determineAgent(medicalData);
      
      return {
        id: (Date.now() + 1).toString(),
        role: 'model' as const,
        text: "I encountered an issue processing your response. Let me try to continue with what we have so far.",
        timestamp: new Date(),
        groundingMetadata,
        activeAgent: fallbackAgent
      };
    }
  };


  const handleSendMessage = async (text: string, images: string[]) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      images,
      timestamp: new Date()
    };

    if (viewMode === 'patient') {
      const newHistory = [...messages, userMsg];
      setMessages(newHistory);
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
        setMessages([...newHistory, modelMsg]);
      } catch (error) {
        console.error("Failed to send patient message", error);
        
        // Provide more helpful error message and maintain agent context
        const currentAgent = medicalData.currentAgent;
        const errorMessage = {
          id: Date.now().toString(),
          role: 'model' as const,
          text: "I apologize, but I encountered a connection error. Please try again, and I'll continue helping you with your medical intake.",
          timestamp: new Date(),
          activeAgent: currentAgent
        };
        
        setMessages([...newHistory, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    } else {
      const newHistory = [...doctorMessages, userMsg];
      setDoctorMessages(newHistory);
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
        setDoctorMessages([...newHistory, modelMsg]);
      } catch (error) {
        console.error("Failed to send doctor message", error);
        
        // Provide contextual error message for doctor mode
        const errorMessage = {
          id: Date.now().toString(),
          role: 'model' as const,
          text: "I apologize, but I encountered a connection error. Please try again, and I'll continue assisting with the clinical decision support.",
          timestamp: new Date()
        };
        
        setDoctorMessages([...newHistory, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTopicTrigger = async (field: keyof MedicalData) => {
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
    const apiHistory = [...messages, directiveMsg];

    try {
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
      
      // Provide helpful feedback when topic trigger fails
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'model',
        text: `I'm having trouble accessing the ${fieldName} topic right now. You can try asking me about it directly, and I'll do my best to help.`,
        timestamp: new Date(),
        activeAgent: medicalData.currentAgent
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDirectMessage = (text: string) => {
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
  };

  useEffect(() => {
    if (directMessages.length > 0) {
      const lastMsg = directMessages[directMessages.length - 1];
      if (lastMsg.sender !== viewMode && !isDMOpen) {
        setUnreadDMCount(prev => prev + 1);
      }
    }
  }, [directMessages, viewMode, isDMOpen]);


  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans relative">
      
      {!isDMOpen && (
        <div className="md:hidden fixed top-4 right-4 z-50">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
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
                onClick={() => setViewMode('patient')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === 'patient' ? 'bg-white text-medical-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <User className="w-3 h-3" /> Patient
              </button>
              <button 
                onClick={() => setViewMode('doctor')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${viewMode === 'doctor' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Stethoscope className="w-3 h-3" /> Doctor
              </button>
            </div>
            {viewMode === 'patient' && medicalData.bookingStatus === 'ready' && (
              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="hidden md:flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg animate-pulse transition-all"
              >
                <CalendarCheck className="w-5 h-5" /> Book Now
              </button>
            )}
          </div>
        </header>
        
        <div className="flex-1 overflow-hidden relative">
          {viewMode === 'doctor' && (
            <div className="absolute inset-0 bg-purple-50/50 pointer-events-none z-0" style={{backgroundImage: 'radial-gradient(circle, #e9d5ff 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.5}}></div>
          )}

          <ChatInterface 
            messages={viewMode === 'patient' ? messages : doctorMessages} 
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            currentStage={stage}
            completeness={completeness}
            variant={viewMode}
          />
          
          {viewMode === 'patient' && medicalData.bookingStatus === 'ready' && (
            <div className="absolute bottom-24 left-6 z-20 md:hidden">
              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-full font-bold shadow-xl animate-bounce"
              >
                <CalendarCheck className="w-5 h-5" /> Book
              </button>
            </div>
          )}
        </div>

        <div className="absolute bottom-24 right-6 md:bottom-28 md:right-6 z-30">
          <button 
            onClick={() => setIsDMOpen(!isDMOpen)}
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

        <LazyDirectChatOverlay 
          isOpen={isDMOpen}
          onClose={() => setIsDMOpen(false)}
          messages={directMessages}
          onSendMessage={handleSendDirectMessage}
          currentUser={viewMode}
        />
      </div>

      <div className={`
        fixed inset-y-0 right-0 w-full md:w-2/5 lg:w-1/3 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40
        md:relative md:transform-none md:shadow-none md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <MedicalSidebar 
          data={medicalData} 
          thought={thought} 
          onTopicTrigger={handleTopicTrigger}
        />
      </div>

      {/* Booking Modal - Demo mode since no real connection data in standalone demo */}
      <LazyBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        connectionId=""
        doctorId=""
        onBooked={() => {
          setMedicalData(prev => ({ ...prev, bookingStatus: 'booked' }));
          setIsBookingModalOpen(false);
          const confirmMsg: Message = {
            id: Date.now().toString(),
            role: 'model',
            text: `**Appointment Confirmed!** \n\nYour appointment has been booked and the clinical handover note has been forwarded to the doctor.`,
            timestamp: new Date(),
            activeAgent: 'HandoverSpecialist'
          };
          setMessages(prev => [...prev, confirmMsg]);
        }}
      />
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default AppClient;
