'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  MessageSquare,
  Search,
  Send,
  Check,
  ClipboardList,
  ArrowLeft,
} from 'lucide-react';

interface Conversation {
  connectionId: string;
  patient: {
    id: string;
    user: {
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
      email: string | null;
    } | null;
  } | null;
  lastMessage?: {
    content: string;
    createdAt: Date;
    isFromMe: boolean;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
  isRead: boolean;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    primaryRole: string;
  };
}

function renderTextWithLinks(text: string) {
  // Check for meeting invite format: [JOIN_MEETING:url]
  const meetingMatch = text.match(/\[JOIN_MEETING:(https?:\/\/[^\]]+)\]/);
  if (meetingMatch) {
    const meetingUrl = meetingMatch[1];
    const textBeforeButton = text.replace(/\[JOIN_MEETING:https?:\/\/[^\]]+\]/, '').trim();
    
    return (
      <div className="space-y-3">
        {textBeforeButton && <span>{textBeforeButton}</span>}
        <Link
          href={meetingUrl || '#'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Join Video Call
        </Link>
      </div>
    );
  }

  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return parts.map((part, idx) => {
    const isUrl = part.startsWith('http://') || part.startsWith('https://');
    if (!isUrl) {
      return <span key={idx}>{part}</span>;
    }

    const match = part.match(/^(https?:\/\/\S+?)([),.!?]*)$/);
    const url = match?.[1] ?? part;
    const trailing = match?.[2] ?? '';

    return (
      <span key={idx}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="underline break-all"
        >
          {url}
        </a>
        {trailing}
      </span>
    );
  });
}


function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const patient = conversation.patient;
  const patientName = patient?.user
    ? `${patient.user.firstName || ''} ${patient.user.lastName || ''}`.trim() || 'Unknown Patient'
    : 'Unknown Patient';

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 ${
        isSelected ? 'bg-medical-50 border-l-4 border-l-medical-500' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
            {patient?.user?.imageUrl ? (
              <img
                src={patient.user.imageUrl}
                alt={patientName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              patientName.charAt(0).toUpperCase()
            )}
          </div>
          {conversation.unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-medical-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`font-medium truncate ${conversation.unreadCount > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
              {patientName}
            </p>
            {conversation.lastMessage && (
              <span className="text-xs text-slate-400">
                {new Date(conversation.lastMessage.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
          {conversation.lastMessage && (
            <p className={`text-sm truncate mt-0.5 ${conversation.unreadCount > 0 ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
              {conversation.lastMessage.isFromMe && <span className="text-slate-400">You: </span>}
              {conversation.lastMessage.content}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message, currentUserId }: { message: Message; currentUserId: string }) {
  const isFromMe = message.senderId === currentUserId;
  const hasMeetingButton = message.content.includes('[JOIN_MEETING:');

  return (
    <div className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] sm:max-w-[70%] min-w-0 rounded-2xl px-3 py-2 sm:px-4 ${
          isFromMe
            ? 'bg-medical-600 text-white rounded-br-md'
            : 'bg-slate-100 text-slate-800 rounded-bl-md'
        }`}
      >
        {hasMeetingButton ? (
          <div className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(message.content)}</div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(message.content)}</p>
        )}
        <div className={`flex items-center justify-end gap-1 mt-1 ${isFromMe ? 'text-medical-200' : 'text-slate-400'}`}>
          <span className="text-xs">
            {new Date(message.createdAt).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
          {isFromMe && (
            <Check className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}


export default function DoctorMessagesPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-8rem)] animate-pulse">
        <div className="h-full bg-slate-200 rounded-xl"></div>
      </div>
    }>
      <DoctorMessagesContent />
    </Suspense>
  );
}

function DoctorMessagesContent() {
  const searchParams = useSearchParams();
  const initialConnectionId = searchParams.get('connection');
  
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(initialConnectionId);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(!!initialConnectionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMarkAsReadAttemptRef = useRef<Record<string, number>>({});

  const utils = api.useUtils();

  // Fetch current user
  const { data: userData } = api.user.getMe.useQuery();
  const currentUserId = userData?.id;

  // Fetch conversations with unread counts - poll every 10 seconds for real-time updates
  const { data: conversationsData, isLoading: conversationsLoading } = 
    api.message.getConversations.useQuery(undefined, {
      refetchInterval: 10000, // Poll every 10 seconds
      refetchIntervalInBackground: false,
    });

  // Fetch messages for selected conversation - poll every 5 seconds when active
  const { data: messagesData, isLoading: messagesLoading } = 
    api.message.getConversation.useQuery(
      { connectionId: selectedConnectionId ?? '' },
      { 
        enabled: !!selectedConnectionId,
        refetchInterval: 5000, // Poll every 5 seconds for new messages
        refetchIntervalInBackground: false,
      }
    );

  // Send message mutation
  const sendMessage = api.message.send.useMutation({
    onSuccess: () => {
      setNewMessage('');
      utils.message.getConversation.invalidate({ connectionId: selectedConnectionId! });
    },
  });

  // Mark messages as read
  const markAsRead = api.message.markAsRead.useMutation({
    onSuccess: () => {
      utils.message.getConversation.invalidate({ connectionId: selectedConnectionId! });
      utils.message.getConversations.invalidate();
    },
  });

  const messages = messagesData?.messages ?? [];

  // Build conversations list from the getConversations endpoint
  const conversations: Conversation[] = (conversationsData?.conversations ?? []).map(conv => ({
    connectionId: conv.connectionId,
    patient: conv.otherParty.role === 'patient' ? {
      id: conv.otherParty.userId,
      user: {
        firstName: conv.otherParty.firstName,
        lastName: conv.otherParty.lastName,
        imageUrl: conv.otherParty.imageUrl,
        email: null,
      },
    } : null,
    lastMessage: conv.latestMessage ? {
      content: conv.latestMessage.content,
      createdAt: conv.latestMessage.createdAt,
      isFromMe: conv.latestMessage.isFromMe,
    } : undefined,
    unreadCount: conv.unreadCount,
  }));

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const patientName = conv.patient?.user
      ? `${conv.patient.user.firstName || ''} ${conv.patient.user.lastName || ''}`.toLowerCase()
      : '';
    return patientName.includes(searchQuery.toLowerCase());
  });

  // Get selected conversation
  const selectedConversation = conversations.find(c => c.connectionId === selectedConnectionId);
  const selectedPatientName = selectedConversation?.patient?.user
    ? `${selectedConversation.patient.user.firstName || ''} ${selectedConversation.patient.user.lastName || ''}`.trim()
    : 'Unknown Patient';

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (!selectedConnectionId || !currentUserId) return;
    if (markAsRead.isPending) return;

    const hasUnreadFromOther = messages.some((m) => !m.isRead && m.senderId !== currentUserId);
    if (!hasUnreadFromOther) return;

    const now = Date.now();
    const lastAttempt = lastMarkAsReadAttemptRef.current[selectedConnectionId] ?? 0;
    if (now - lastAttempt < 15000) return;
    lastMarkAsReadAttemptRef.current[selectedConnectionId] = now;

    markAsRead.mutate({ connectionId: selectedConnectionId });
  }, [selectedConnectionId, messages, currentUserId, markAsRead]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConnectionId) return;
    sendMessage.mutate({
      connectionId: selectedConnectionId,
      content: newMessage.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectConversation = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setShowMobileChat(true);
  };

  if (conversationsLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] animate-pulse">
        <div className="h-full bg-slate-200 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] bg-white rounded-xl border border-slate-200 overflow-hidden flex">
      {/* Conversations List */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Search Header */}
        <div className="p-3 sm:p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No conversations</p>
              <p className="text-sm text-slate-400 mt-1">
                {searchQuery ? 'No patients match your search' : 'Messages from patients will appear here'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.connectionId}
                conversation={conv}
                isSelected={conv.connectionId === selectedConnectionId}
                onClick={() => handleSelectConversation(conv.connectionId)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        {selectedConnectionId ? (
          <>
            {/* Chat Header */}
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                {selectedConversation?.patient?.user?.imageUrl ? (
                  <img
                    src={selectedConversation.patient.user.imageUrl}
                    alt={selectedPatientName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  selectedPatientName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{selectedPatientName}</p>
                <p className="text-xs text-slate-500">Patient</p>
              </div>
              <Link
                href={`/doctor/patients/${selectedConnectionId}/intake`}
                className="p-2 text-medical-600 hover:bg-medical-50 rounded-lg transition-colors"
                title="View Intake"
              >
                <ClipboardList className="w-5 h-5" />
              </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-2 border-medical-200 border-t-medical-600 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation</p>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} currentUserId={currentUserId} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 sm:p-4 border-t border-slate-100">
              <div className="flex items-end gap-2">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessage.isPending}
                  className="p-2.5 sm:p-3 bg-medical-600 text-white rounded-xl hover:bg-medical-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium text-slate-600">Select a conversation</p>
            <p className="text-sm">Choose a patient to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
