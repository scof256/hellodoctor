'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Message, IntakeStage } from '../../types';
import { Send, Image as ImageIcon, Loader2, ZoomIn, ZoomOut, X, Plus } from 'lucide-react';
import { MemoizedMessage } from './MemoizedMessage';

/**
 * Memoized Chat Container Component
 * Requirements: 2.3, 2.5
 * 
 * This component isolates chat state to prevent sibling re-renders.
 * Uses useCallback for event handlers to prevent unnecessary child re-renders.
 */

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (text: string, images: string[]) => void;
  isLoading: boolean;
  currentStage?: IntakeStage;
  completeness?: number;
  variant?: 'patient' | 'doctor';
}

const ChatContainerComponent: React.FC<ChatContainerProps> = ({
  messages,
  onSendMessage,
  isLoading,
  variant = 'patient',
}) => {
  // Isolated state - changes here won't affect siblings (Requirements: 2.5)
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDoctor = variant === 'doctor';

  const theme = useMemo(() => isDoctor ? {
    bg: 'bg-purple-50',
    accentText: 'text-purple-700',
    button: 'bg-purple-700 hover:bg-purple-800',
    ring: 'focus:ring-purple-500'
  } : {
    bg: 'bg-slate-50',
    accentText: 'text-medical-600',
    button: 'bg-medical-600 hover:bg-medical-700',
    ring: 'focus:ring-medical-500'
  }, [isDoctor]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Memoized callbacks to prevent child re-renders (Requirements: 2.3)
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        if (base64Data) {
          setSelectedImages(prev => [...prev, base64Data]);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return;
    onSendMessage(input, selectedImages);
    setInput('');
    setSelectedImages([]);
  }, [input, selectedImages, isLoading, onSendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }, [handleSubmit]);

  const handleImageClick = useCallback((img: string) => {
    setViewingImage(img);
    setZoomLevel(1);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewingImage(null);
  }, []);

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(prev - 0.5, 1));
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleFileInputClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleToggleZoom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoomLevel(prev => prev === 1 ? 2 : 1);
  }, []);

  // Helper to determine if image is a URL or base64
  const getImageSrc = useCallback((img: string): string => {
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }
    return `data:image/jpeg;base64,${img}`;
  }, []);

  return (
    <div className={`flex flex-col h-full ${theme.bg} relative`}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 pb-24 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-50">
            <div className="text-6xl mb-4">{isDoctor ? '🩺' : '📋'}</div>
            <p className="text-lg">{isDoctor ? 'Start brainstorming with HelloDoctor.' : 'HelloDoctor is ready for intake.'}</p>
          </div>
        )}

        {/* Render memoized messages - only changed messages re-render (Requirements: 2.1, 2.2) */}
        {messages.map((msg) => (
          <MemoizedMessage
            key={msg.id}
            message={msg}
            variant={variant}
            onImageClick={handleImageClick}
          />
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

      {/* Input Area - isolated from message list state */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-3 sm:p-4">
        {selectedImages.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto items-center p-1">
            {selectedImages.map((img, i) => (
              <div key={i} className="relative group shrink-0 animate-in fade-in zoom-in duration-200">
                <img src={`data:image/jpeg;base64,${img}`} className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-sm" alt="Selected" />
                <button
                  onClick={() => handleRemoveImage(i)}
                  className="absolute -top-2 -right-2 bg-white text-red-500 border border-slate-200 rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-50 transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={handleFileInputClick}
              className="h-16 w-16 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all shrink-0 gap-1"
              title="Add another image"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase">Add</span>
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2 items-end max-w-4xl mx-auto">
          <button
            type="button"
            onClick={handleFileInputClick}
            className={`p-2 sm:p-3 text-slate-500 hover:bg-slate-100 rounded-full transition-colors hover:${theme.accentText}`}
            title="Upload photo"
          >
            <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
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
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isDoctor ? "Consult with AI, add exam findings, or suggest tests..." : "Describe your symptoms..."}
              className={`w-full bg-slate-100 border-0 rounded-2xl px-3 py-2 pr-10 sm:px-4 sm:py-3 sm:pr-12 text-slate-800 ${theme.ring} focus:ring-2 resize-none max-h-32`}
              rows={1}
            />
          </div>

          <button
            type="submit"
            disabled={(!input && selectedImages.length === 0) || isLoading}
            className={`p-2.5 sm:p-3 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md ${theme.button}`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200" onClick={handleCloseViewer}>
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <span className="text-white/80 text-sm font-medium ml-2">Image Viewer</span>
            <button
              onClick={handleCloseViewer}
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
              onClick={handleToggleZoom}
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

export const ChatContainer = React.memo(ChatContainerComponent);

export default ChatContainer;
