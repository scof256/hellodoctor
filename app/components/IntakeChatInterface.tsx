'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, IntakeStage, AgentRole } from '../types';
import { Send, Image as ImageIcon, Loader2, Search, CheckCircle2, Stethoscope, UserCog, Plus, ZoomIn, ZoomOut, X, Bot, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useUploadThing } from '@/lib/uploadthing-client';
import { api } from '@/trpc/react';
import VirtualMessageList from './VirtualMessageList';
import { useMode } from '../contexts/ModeContext';
import { ProgressStepper, type Step } from './ProgressStepper';

/** Threshold for enabling virtual scrolling (Requirements: 7.1) */
const VIRTUAL_SCROLL_THRESHOLD = 50;
/** Default item height for virtual scrolling */
const DEFAULT_ITEM_HEIGHT = 120;

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface IntakeChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string, imageUrls: string[]) => void;
  onFilesUploaded?: (files: UploadedFile[]) => void;
  isLoading: boolean;
  currentStage?: IntakeStage;
  completeness?: number;
  variant?: 'patient' | 'doctor';
  sessionId?: string;
  showTracker?: boolean;
  /** Callback for loading older messages (infinite scroll) */
  onLoadMore?: () => void;
  /** Quick reply options for Simple Mode */
  quickReplies?: QuickReply[];
  /** Total number of questions for progress display */
  totalQuestions?: number;
  /** Current question number for progress display */
  currentQuestion?: number;
}

interface QuickReply {
  id: string;
  text: string;
  icon?: string;
}

const STAGES: { id: IntakeStage; label: string; desc: string }[] = [
  { id: 'vitals', label: 'Vitals', desc: 'Basic Info' },
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

/**
 * Enhanced Chat Interface with UploadThing integration for intake sessions
 * Requirements: 11.2, 11.6, 11.8, 6.1, 6.2, 6.3, 6.4, 6.6, 6.8
 */
const IntakeChatInterface: React.FC<IntakeChatInterfaceProps> = ({ 
  messages, 
  onSendMessage,
  onFilesUploaded,
  isLoading, 
  currentStage, 
  completeness,
  variant = 'patient',
  sessionId,
  showTracker = true,
  onLoadMore,
  quickReplies = [],
  totalQuestions = 10,
  currentQuestion = 0,
}) => {
  const { isSimpleMode } = useMode();
  const [input, setInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [containerHeight, setContainerHeight] = useState(400);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Determine if virtual scrolling should be used (Requirements: 7.1, 7.2)
  const useVirtualScroll = !isMobile && variant === 'doctor' && messages.length > VIRTUAL_SCROLL_THRESHOLD;
  
  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (messagesContainerRef.current) {
        setContainerHeight(messagesContainerRef.current.clientHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }

    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  // tRPC mutation for storing file metadata in database
  const storeFileMetadata = api.intake.storeFileMetadata.useMutation({
    onError: (err) => {
      console.error('Failed to store file metadata:', err);
    },
  });

  // UploadThing hook for file uploads
  const { startUpload, isUploading } = useUploadThing('intakeImageUploader', {
    headers: sessionId ? { 'x-session-id': sessionId } : undefined,
    onClientUploadComplete: (res) => {
      if (res) {
        const newFiles: UploadedFile[] = res.map((file) => ({
          url: file.ufsUrl,
          name: file.name,
          size: file.size,
          type: file.type,
        }));
        setUploadedFiles((prev) => [...prev, ...newFiles]);
        onFilesUploaded?.(newFiles);
        setUploadError(null);

        // Store file metadata in database (Requirements: 11.6, 11.8)
        if (sessionId && newFiles.length > 0) {
          storeFileMetadata.mutate({
            sessionId,
            files: newFiles.map((f) => ({
              url: f.url,
              fileName: f.name,
              fileType: f.type,
              fileSize: f.size,
            })),
          });
        }
      }
    },
    onUploadError: (err) => {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload image. Please try again.');
    },
  });

  const scrollToBottom = useCallback(() => {
    if (!useVirtualScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    // Virtual scroll handles its own scroll-to-bottom
  }, [useVirtualScroll]);

  useEffect(() => {
    if (!useVirtualScroll) {
      scrollToBottom();
    }
  }, [messages, useVirtualScroll, scrollToBottom]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    const next = Math.min(textarea.scrollHeight, 128);
    textarea.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      
      setUploadError(null);
      const files = Array.from(e.target.files);
      
      // Validate file count
      if (uploadedFiles.length + files.length > 4) {
        setUploadError('Maximum 4 images allowed per message');
        e.target.value = '';
        return;
      }

      // Validate file sizes
      const oversizedFiles = files.filter((f) => f.size > 8 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        setUploadError('Each image must be under 8MB');
        e.target.value = '';
        return;
      }

      await startUpload(files);
      e.target.value = '';
    },
    [startUpload, uploadedFiles.length]
  );

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading || isUploading) return;
    
    // Send message with image URLs
    const imageUrls = uploadedFiles.map((f) => f.url);
    onSendMessage(input, imageUrls);
    setInput('');
    setUploadedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
    }
  };

  const handleQuickReply = (reply: QuickReply) => {
    if (isLoading || isUploading) return;
    onSendMessage(reply.text, []);
  };

  const activeStageIndex = currentStage ? STAGES.findIndex(s => s.id === currentStage) : 0;
  const isDoctor = variant === 'doctor';
  
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

  const getBubbleStyle = (msg: Message) => {
    if (msg.role === 'user') {
      return `${theme.userBubble} text-white rounded-br-md`;
    } 
    if (msg.role === 'doctor') {
      return `bg-indigo-900 text-white border-indigo-700 rounded-bl-md shadow-indigo-100`;
    }
    return `${theme.aiBubble} text-slate-800 border rounded-bl-md`;
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

  // Helper to determine if image is a URL or base64
  const getImageSrc = (img: string) => {
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }
    return `data:image/jpeg;base64,${img}`;
  };

  return (
    <div className={`flex flex-col h-full ${theme.bg} relative`}>
      
      {/* Tracker / Header */}
      {showTracker && (
        <div className={`bg-white border-b border-slate-200 p-3 shadow-sm z-10 ${!isDoctor ? 'pb-16' : ''}`}>
          {isDoctor ? (
             <div className="flex items-center gap-2 justify-center py-2 text-purple-800">
                <Stethoscope className="w-5 h-5" />
                <span className="font-bold text-sm uppercase tracking-widest">Consultant Mode Active</span>
             </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {/* Simple Mode: Show question progress */}
              {isSimpleMode() ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Medical Form</span>
                  <span className="text-sm font-bold text-medical-600">
                    {currentQuestion} of {totalQuestions} questions answered
                  </span>
                </div>
              ) : (
                <>
                  {/* Advanced Mode: Show detailed progress with ProgressStepper */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase md:hidden">Current Step: <span className="text-medical-600">{STAGES[activeStageIndex]?.label}</span></span>
                    <span className="text-xs font-bold text-medical-600">{completeness}% Complete</span>
                  </div>

                  {/* Mobile: Show bar variant */}
                  <div className="md:hidden">
                    <ProgressStepper
                      steps={STAGES.map(s => ({ id: s.id, label: s.label, description: s.desc }))}
                      currentStep={activeStageIndex}
                      completedSteps={Array.from({ length: activeStageIndex }, (_, i) => i)}
                      variant="bar"
                      showLabels={true}
                    />
                  </div>

                  {/* Desktop: Show numbered steps variant */}
                  <div className="hidden md:block">
                    <ProgressStepper
                      steps={STAGES.map(s => ({ id: s.id, label: s.label, description: s.desc }))}
                      currentStep={activeStageIndex}
                      completedSteps={Array.from({ length: activeStageIndex }, (_, i) => i)}
                      variant="numbered"
                      showLabels={true}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-hidden relative"
      >
        {/* Use virtual scrolling for large message lists (Requirements: 7.1, 7.2) */}
        {useVirtualScroll ? (
          <VirtualMessageList
            messages={messages}
            itemHeight={DEFAULT_ITEM_HEIGHT}
            bufferSize={10}
            containerHeight={containerHeight}
            variant={variant}
            onImageClick={handleImageClick}
            onLoadMore={onLoadMore}
            autoScrollToBottom={true}
          />
        ) : (
          <div className="h-full overflow-y-auto p-3 sm:p-4 space-y-4 pb-24 scroll-smooth">
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
                  className={`max-w-[92%] sm:max-w-[75%] min-w-0 rounded-2xl p-3 sm:p-4 shadow-sm ${getBubbleStyle(msg)}`}
                >
                  {msg.role === 'doctor' && (
                     <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/20">
                        <div className="bg-white p-1 rounded-full text-indigo-900">
                            <UserCog className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Dr. Smith (Attending)</span>
                     </div>
                  )}

                  {/* Simple Mode: Show friendly AI name and avatar */}
                  {msg.role === 'model' && isSimpleMode() && !isDoctor && (
                     <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-medical-400 to-medical-600 flex items-center justify-center text-white text-lg">
                           👩‍⚕️
                        </div>
                        <span className="text-sm font-semibold text-medical-700">Nurse Joy</span>
                     </div>
                  )}

                  {/* Advanced Mode: Show technical agent information */}
                  {msg.role === 'model' && !isSimpleMode() && msg.activeAgent && !isDoctor && (
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
                          src={getImageSrc(img)} 
                          alt="User upload" 
                          className="h-32 w-auto rounded-lg object-cover border border-white/20 cursor-zoom-in hover:opacity-90 transition-opacity"
                          onClick={() => handleImageClick(img)}
                        />
                      ))}
                    </div>
                  )}
                  
                  <div className={`prose prose-sm max-w-none min-w-0 whitespace-pre-wrap break-words prose-p:whitespace-pre-wrap prose-p:break-words prose-p:my-0 ${
                    msg.role === 'user' || msg.role === 'doctor' 
                      ? 'prose-invert text-white prose-p:text-white prose-headings:text-white prose-strong:text-white' 
                      : `text-slate-700 prose-p:leading-relaxed prose-strong:${theme.accentText} prose-strong:font-bold prose-headings:text-slate-800`
                    }`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>

                  {msg.groundingMetadata?.groundingChunks && (
                    <div className="mt-3 pt-3 border-t border-slate-200/50 text-xs">
                       <div className="flex items-center gap-1 text-slate-500 mb-1 font-semibold">
                          <Search className="w-3 h-3" /> Sources
                       </div>
                       <div className="flex flex-wrap gap-2">
                        {(msg.groundingMetadata.groundingChunks as Array<{ web?: { uri?: string; title?: string } }>).map((chunk, i) => 
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
                    <span className="text-sm text-slate-500 font-medium">
                      {isSimpleMode() ? 'Nurse Joy is typing...' : 'HelloDoctor is consulting sub-agents...'}
                    </span>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Loading indicator for virtual scroll mode */}
        {useVirtualScroll && isLoading && (
          <div className="absolute bottom-24 left-4 right-4 flex justify-start pointer-events-none">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-4 shadow-sm flex items-center gap-2">
              <Loader2 className={`w-4 h-4 animate-spin ${theme.accentText}`} />
              <span className="text-sm text-slate-500 font-medium">
                {isSimpleMode() ? 'Nurse Joy is typing...' : 'HelloDoctor is consulting sub-agents...'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4">
        {/* Quick Reply Buttons (Simple Mode) */}
        {isSimpleMode() && quickReplies.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-2 mb-3 max-w-4xl mx-auto">
            {quickReplies.map((reply) => (
              <button
                key={reply.id}
                onClick={() => handleQuickReply(reply)}
                className="px-4 py-2 bg-white border-2 border-medical-500 text-medical-700 rounded-full font-medium text-sm hover:bg-medical-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {reply.icon && <span>{reply.icon}</span>}
                {reply.text}
              </button>
            ))}
          </div>
        )}

        {/* Upload error message */}
        {uploadError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-2 max-w-4xl mx-auto">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{uploadError}</span>
            <button
              onClick={() => setUploadError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Uploaded files preview */}
        {uploadedFiles.length > 0 && (
           <div className="flex gap-2 mb-2 overflow-x-auto items-center p-1 max-w-4xl mx-auto">
             {uploadedFiles.map((file, i) => (
               <div key={`${file.url}-${i}`} className="relative group shrink-0 animate-in fade-in zoom-in duration-200">
                 <img src={file.url} className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm" alt={file.name} />
                 <button 
                  onClick={() => handleRemoveFile(i)}
                  disabled={isLoading || isUploading}
                  className="absolute -top-2 -right-2 bg-white text-red-500 border border-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-50 transition-colors disabled:opacity-50"
                 >
                   <X className="w-3 h-3" />
                 </button>
               </div>
             ))}
             
             {uploadedFiles.length < 4 && (
               <label
                  className={`h-16 w-16 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shrink-0 gap-1 cursor-pointer ${
                    isLoading || isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Add another image"
               >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">Add</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    disabled={isLoading || isUploading}
                  />
               </label>
             )}
           </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2 items-end max-w-4xl mx-auto">
          <label
            className={`p-2 sm:p-3 text-slate-500 hover:bg-slate-100 rounded-full transition-colors cursor-pointer hover:${theme.accentText} ${
              isLoading || isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Upload photo"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={isLoading || isUploading}
            />
          </label>
          
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={isDoctor ? "Consult with AI, add exam findings, or suggest tests..." : "Describe your symptoms..."}
              className={`w-full bg-slate-100 border-0 rounded-2xl px-3 py-2 pr-10 sm:px-4 sm:py-3 sm:pr-12 text-slate-800 ${theme.ring} focus:ring-2 resize-none max-h-32`}
              rows={1}
              disabled={isLoading || isUploading}
            />
          </div>
          
          <button
            type="submit"
            disabled={(!input && uploadedFiles.length === 0) || isLoading || isUploading}
            className={`p-2.5 sm:p-3 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md ${theme.button}`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200" onClick={() => setViewingImage(null)}>
           <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
              <span className="text-white/80 text-sm font-medium ml-2">Image Viewer</span>
              <button 
                onClick={() => setViewingImage(null)} 
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all pointer-events-auto"
              >
                <X className="w-6 h-6" />
              </button>
           </div>

           <div className="flex-1 overflow-auto flex items-center justify-center p-4">
               <img 
                  src={getImageSrc(viewingImage)}
                  alt="Full view"
                  className="transition-all duration-300 ease-out shadow-2xl"
                  style={{
                      maxWidth: zoomLevel === 1 ? '100%' : 'none',
                      maxHeight: zoomLevel === 1 ? '100%' : 'none',
                      width: zoomLevel > 1 ? `${zoomLevel * 100}%` : 'auto',
                      cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in',
                  }}
                  onClick={(e) => {
                      e.stopPropagation();
                      setZoomLevel(prev => prev === 1 ? 2 : 1);
                  }}
               />
           </div>

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

export default IntakeChatInterface;
