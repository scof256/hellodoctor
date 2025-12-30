'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Stethoscope, MessageSquare, Minus } from 'lucide-react';
import { DirectMessage } from '../types';

interface DirectChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: DirectMessage[];
  onSendMessage: (text: string) => void;
  currentUser: 'doctor' | 'patient';
}

const DirectChatOverlay: React.FC<DirectChatOverlayProps> = ({ 
  isOpen, 
  onClose, 
  messages, 
  onSendMessage,
  currentUser 
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] md:absolute md:inset-auto md:bottom-28 md:right-6 md:w-96 md:h-[500px] flex flex-col pointer-events-none">
      <div className="flex flex-col h-full bg-white md:rounded-2xl shadow-2xl pointer-events-auto border border-indigo-100 overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
        
        <div className="bg-indigo-900 p-4 flex items-center justify-between text-white shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 bg-indigo-700 rounded-full border border-indigo-500">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-indigo-900 rounded-full"></span>
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Dr. Smith</h3>
              <p className="text-[10px] text-indigo-300 uppercase tracking-wider font-semibold">Senior Consultant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-indigo-800 rounded-full transition-colors text-indigo-200 hover:text-white"
              title="Minimize"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-indigo-800 rounded-full transition-colors text-indigo-200 hover:text-white"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-xs text-center px-8">
                This is a private, direct channel between {currentUser === 'patient' ? 'you and Dr. Smith' : 'you and the patient'}. 
                The AI does not process these messages.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender === currentUser;
              return (
                <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                  }`}>
                    <p>{msg.text}</p>
                    <span className={`text-[10px] block text-right mt-1 ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentUser === 'doctor' ? "Message patient directly..." : "Ask Dr. Smith a question..."}
              className="flex-1 bg-slate-100 border-0 text-sm p-3 rounded-full focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
            <button 
              type="submit" 
              disabled={!input.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DirectChatOverlay;
