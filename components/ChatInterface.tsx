
import React, { useState, useRef, useEffect } from 'react';
import { Message, IntakeStage, AgentRole } from '../types';
import { Send, Image as ImageIcon, Loader2, Search, CheckCircle2, Circle, ChevronRight, Stethoscope, UserCog, Plus, ZoomIn, ZoomOut, X, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, images: string[]) => void;
  isLoading: boolean;
  currentStage?: IntakeStage;
  completeness?: number;
  variant?: 'patient' | 'doctor';
}

const STAGES: { id: IntakeStage; label: string; desc: string }[] = [
  { id: 'triage', label: 'Basics', desc: 'Main Symptom' },
  { id: 'investigation', label: 'Symptoms', desc: 'Details & Pain' },
  { id: 'records', label: 'Records', desc: 'Tests & Scans' },
  { id: 'profile', label: 'History', desc: 'Meds & Health' },
  { id: 'context', label: 'Lifestyle', desc: 'Social Factors' },
  { id: 'summary', label: 'Review', desc: 'Final Check' },
];

const AGENT_COLORS: Record<AgentRole, string> = {
  'Triage': 'bg-teal-600',
  'ClinicalInvestigator': 'bg-blue-600',
  'RecordsClerk': 'bg-orange-500',
  'HistorySpecialist': 'bg-indigo-600',
  'HandoverSpecialist': 'bg-green-600'
};

const AGENT_LABELS: Record<AgentRole, string> = {
  'Triage': 'Triage Specialist',
  'ClinicalInvestigator': 'Clinical Investigator',
  'RecordsClerk': 'Medical Records',
  'HistorySpecialist': 'History & Intake',
  'HandoverSpecialist': 'Senior Attending'
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  currentStage, 
  completeness,
  variant = 'patient'
}) => {
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImages([...selectedImages, base64Data]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;
    onSendMessage(input, selectedImages);
    setInput('');
    setSelectedImages([]);
  };

  const activeStageIndex = currentStage ? STAGES.findIndex(s => s.id === currentStage) : 0;
  const isDoctor = variant === 'doctor';
  
  // Theme configuration
  const theme = isDoctor ? {
    bg: 'bg-purple-50',
    userBubble: 'bg-purple-700',
    aiBubble: 'bg-white border-purple-200',
    accentText: 'text-purple-700',
    button: 'bg-purple-700 hover:bg-purple-800',
    ring: 'focus:ring-purple-500'
  } : {
    bg: 'bg-slate-50',
    userBubble: 'bg-medical-600',
    aiBubble: 'bg-white border-slate-200',
    accentText: 'text-medical-600',
    button: 'bg-medical-600 hover:bg-medical-700',
    ring: 'focus:ring-medical-500'
  };

  // Helper to determine message style
  const getBubbleStyle = (msg: Message) => {
    if (msg.role === 'user') {
      return `${theme.userBubble} text-white rounded-br-none`;
    } 
    if (msg.role === 'doctor') {
      // Distinct style for Human Doctor intervention
      return `bg-indigo-900 text-white border-indigo-700 rounded-bl-none shadow-indigo-100`;
    }
    // AI Model
    return `${theme.aiBubble} text-slate-800 border rounded-bl-none`;
  };

  const handleImageClick = (img: string) => {
    setViewingImage(img);
    setZoomLevel(1);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(prev - 0.5, 1));
  };

  return (
    <div className={`flex flex-col h-full ${theme.bg} relative`}>
      
      {/* 1. Tracker / Header */}
      <div className="bg-white border-b border-slate-200 p-3 shadow-sm z-10">
        {isDoctor ? (
           <div className="flex items-center gap-2 justify-center py-2 text-purple-800">
              <Stethoscope className="w-5 h-5" />
              <span className="font-bold text-sm uppercase tracking-widest">Consultant Mode Active</span>
           </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {/* Mobile Simple Tracker */}
            <div className="md:hidden flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Current Step: <span className="text-medical-600">{STAGES[activeStageIndex].label}</span></span>
              <span className="text-xs font-bold text-medical-600">{completeness}% Complete</span>
            </div>
            <div className="md:hidden w-full bg-slate-100 rounded-full h-1.5 mb-2">
              <div className="bg-medical-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${completeness}%` }}></div>
            </div>

            {/* Desktop Stepper */}
            <div className="hidden md:flex items-center justify-between w-full px-2">
              {STAGES.map((stage, index) => {
                const isActive = index === activeStageIndex;
                const isCompleted = index < activeStageIndex;
                
                return (
                  <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center relative group cursor-default">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                        ${isCompleted ? 'bg-medical-500 border-medical-500 text-white' : 
                          isActive ? 'bg-white border-medical-600 text-medical-600 shadow-md scale-110' : 
                          'bg-white border-slate-200 text-slate-300'}
                      `}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-xs font-bold">{index + 1}</span>}
                      </div>
                      <div className="text-center mt-1 absolute top-full w-24">
                        <span className={`block text-xs font-bold ${isActive ? 'text-medical-700' : 'text-slate-400'}`}>
                          {stage.label}
                        </span>
                        {isActive && <span className="block text-[10px] text-slate-500 leading-tight">{stage.desc}</span>}
                      </div>
                    </div>
                    
                    {index !== STAGES.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-medical-200' : 'bg-slate-100'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
            <div className="text-6xl mb-4">{isDoctor ? '🩺' : '📋'}</div>
            <p className="text-lg">{isDoctor ? 'Start brainstorming with HelloDoctor.' : 'HelloDoctor is ready for intake.'}</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${getBubbleStyle(msg)}`}
            >
              {/* Doctor Label */}
              {msg.role === 'doctor' && (
                 <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
                    <div className="bg-white p-1 rounded-full text-indigo-900">
                        <UserCog className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">Dr. Smith (Attending)</span>
                 </div>
              )}

              {/* Sub-Agent Label (A2A Protocol Visualizer) */}
              {msg.role === 'model' && msg.activeAgent && !isDoctor && (
                 <div className="flex items-center gap-2 mb-2">
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 ${AGENT_COLORS[msg.activeAgent] || 'bg-slate-400'}`}>
                       <Bot className="w-3 h-3" />
                       {AGENT_LABELS[msg.activeAgent] || msg.activeAgent}
                    </div>
                 </div>
              )}

              {msg.images && msg.images.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {msg.images.map((img, idx) => (
                    <img 
                      key={idx} 
                      src={`data:image/jpeg;base64,${img}`} 
                      alt="User upload" 
                      className="h-32 w-auto rounded-lg object-cover border border-white/20 cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => handleImageClick(img)}
                    />
                  ))}
                </div>
              )}
              
              <div className={`prose prose-sm max-w-none ${
                msg.role === 'user' || msg.role === 'doctor' 
                  ? 'prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white' 
                  : `text-slate-700 prose-p:leading-relaxed prose-strong:${theme.accentText} prose-strong:font-bold prose-headings:text-slate-800`
                }`}>
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>

              {/* Grounding Sources */}
              {msg.groundingMetadata?.groundingChunks && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 text-xs">
                   <div className="flex items-center gap-1 text-slate-500 mb-1 font-semibold">
                      <Search className="w-3 h-3" /> Sources
                   </div>
                   <div className="flex flex-wrap gap-2">
                    {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => 
                      chunk.web?.uri ? (
                        <a 
                          key={i} 
                          href={chunk.web.uri} 
                          target="_blank" 
                          rel="noreferrer"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded truncate max-w-[200px] flex items-center gap-1 transition-colors"
                        >
                          {chunk.web.title || new URL(chunk.web.uri).hostname}
                        </a>
                      ) : null
                    )}
                   </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2">
                <Loader2 className={`w-4 h-4 animate-spin ${theme.accentText}`} />
                <span className="text-sm text-slate-500 font-medium">HelloDoctor is consulting sub-agents...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4">
        {selectedImages.length > 0 && (
           <div className="flex gap-2 mb-2 overflow-x-auto items-center p-1">
             {selectedImages.map((img, i) => (
               <div key={i} className="relative group shrink-0 animate-in fade-in zoom-in duration-200">
                 <img src={`data:image/jpeg;base64,${img}`} className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm" />
                 <button 
                  onClick={() => setSelectedImages(selectedImages.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 bg-white text-red-500 border border-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-50 transition-colors"
                 >
                   &times;
                 </button>
               </div>
             ))}
             
             {/* Add Image Button */}
             <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-16 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shrink-0 gap-1"
                title="Add another image"
             >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase">Add</span>
             </button>
           </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 items-end max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 text-slate-500 hover:bg-slate-100 rounded-full transition-colors hover:${theme.accentText}`}
            title="Upload photo"
          >
            <ImageIcon className="w-6 h-6" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleImageSelect}
          />
          
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={isDoctor ? "Consult with AI, add exam findings, or suggest tests..." : "Describe your symptoms..."}
              className={`w-full bg-slate-100 border-0 rounded-2xl px-4 py-3 pr-12 text-slate-800 ${theme.ring} focus:ring-2 resize-none max-h-32`}
              rows={1}
            />
          </div>
          
          <button
            type="submit"
            disabled={(!input && selectedImages.length === 0) || isLoading}
            className={`p-3 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md ${theme.button}`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200" onClick={() => setViewingImage(null)}>
           {/* Top Controls */}
           <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
              <span className="text-white/80 text-sm font-medium ml-2">Image Viewer</span>
              <button 
                onClick={() => setViewingImage(null)} 
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all pointer-events-auto"
              >
                <X className="w-6 h-6" />
              </button>
           </div>

           {/* Scrollable Image Area */}
           <div className="flex-1 overflow-auto flex items-center justify-center p-4">
               <img 
                  src={`data:image/jpeg;base64,${viewingImage}`}
                  alt="Full view"
                  className="transition-all duration-300 ease-out shadow-2xl"
                  style={{
                      // If zoom is 1, fit to screen. If zoom > 1, expand naturally
                      maxWidth: zoomLevel === 1 ? '100%' : 'none',
                      maxHeight: zoomLevel === 1 ? '100%' : 'none',
                      // Forces the width to grow relative to viewport for reading
                      width: zoomLevel > 1 ? `${zoomLevel * 100}%` : 'auto',
                      cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in',
                  }}
                  onClick={(e) => {
                      e.stopPropagation();
                      setZoomLevel(prev => prev === 1 ? 2 : 1);
                  }}
               />
           </div>

           {/* Bottom Controls */}
           <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-xl" onClick={e => e.stopPropagation()}>
              <button onClick={handleZoomOut} className="text-white hover:text-blue-300 transition-colors disabled:opacity-30" disabled={zoomLevel <= 1}>
                 <ZoomOut className="w-6 h-6" />
              </button>
              <span className="text-white font-mono min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
              <button onClick={handleZoomIn} className="text-white hover:text-blue-300 transition-colors disabled:opacity-30" disabled={zoomLevel >= 5}>
                 <ZoomIn className="w-6 h-6" />
              </button>
           </div>
        </div>
      )}

    </div>
  );
};

export default ChatInterface;
