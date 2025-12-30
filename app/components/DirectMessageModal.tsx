'use client';

import React, { useState } from 'react';
import { Send, UserCog, MessageSquare, X } from 'lucide-react';

interface DirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}

const DirectMessageModal: React.FC<DirectMessageModalProps> = ({ isOpen, onClose, onSend }) => {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        <div className="bg-indigo-900 p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-800 rounded-lg">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Message Patient</h2>
              <p className="text-xs text-indigo-200">Bypass AI and speak directly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-indigo-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mb-4 flex gap-3 text-sm text-blue-800">
            <MessageSquare className="w-5 h-5 shrink-0" />
            <p>This message will appear in the patient&apos;s chat stream as coming directly from <strong>Dr. Smith</strong>.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="E.g., Please upload a clearer photo of the rash, or press specifically on the lower right side..."
              className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none mb-4 text-slate-800"
              autoFocus
            />
            
            <div className="flex justify-end gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={!message.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                <Send className="w-4 h-4" /> Send Direct Message
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DirectMessageModal;
