'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/trpc/react';
import {
  MessageSquare,
  Send,
  Loader2,
  ArrowLeft,
  User,
  Search,
  Check,
  CheckCheck,
  ClipboardList,
} from 'lucide-react';
import { ConversationListSkeleton, MessageListSkeleton } from '@/app/components/SkeletonComponents';

/**
 * Patient Messages Page
 * Requirements: 5.6, 13.4
 * 
 * Lists conversations with connected doctors and allows real-time messaging.
 */

interface ConversationItemProps {
  conversation: {
    connectionId: string;
    otherParty: {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      imageUrl: string | null;
      role: 'patient' | 'doctor';
    };
    latestMessage: {
      content: string;
      createdAt: Date;
      isRead: boolean;
      isFromMe: boolean;
    } | null;
    unreadCount: number;
  };
  isSelected: boolean;
  currentUserId: string;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, currentUserId, onClick }: ConversationItemProps) {
  const { otherParty, latestMessage, unreadCount } = conversation;
  
  const displayName = otherParty.firstName && otherParty.lastName
    ? `Dr. ${otherParty.firstName} ${otherParty.lastName}`
    : 'Doctor';
  
  const subtitle = 'Healthcare Provider';
  
  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return messageDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const isOwnMessage = latestMessage?.isFromMe ?? false;

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left ${
        isSelected ? 'bg-medical-50 border-l-4 border-medical-500' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        {otherParty.imageUrl ? (
          <img
            src={otherParty.imageUrl}
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 font-bold">
            {displayName.charAt(4) || 'D'}
          </div>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-medical-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={`font-medium truncate ${unreadCount > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
            {displayName}
          </span>
          {latestMessage && (
            <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
              {formatTime(latestMessage.createdAt)}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 truncate">{subtitle}</p>
        {latestMessage && (
          <p className={`text-sm truncate mt-1 ${unreadCount > 0 ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
            {isOwnMessage && (
              <span className="inline-flex items-center mr-1">
                {latestMessage.isRead ? (
                  <CheckCheck className="w-3 h-3 text-medical-500" />
                ) : (
                  <Check className="w-3 h-3 text-slate-400" />
                )}
              </span>
            )}
            {latestMessage.content.length > 50 
              ? latestMessage.content.substring(0, 50) + '...' 
              : latestMessage.content}
          </p>
        )}
      </div>
    </button>
  );
}


interface MessageBubbleProps {
  message: {
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
  };
  isOwn: boolean;
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

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[92%] sm:max-w-[75%] min-w-0 ${isOwn ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwn
              ? 'bg-medical-600 text-white rounded-br-none'
              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
          }`}
        >
          <div className="text-sm whitespace-pre-wrap break-words">{renderTextWithLinks(message.content)}</div>
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-slate-400">{formatTime(message.createdAt)}</span>
          {isOwn && (
            message.isRead ? (
              <CheckCheck className="w-3 h-3 text-medical-500" />
            ) : (
              <Check className="w-3 h-3 text-slate-400" />
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientMessagesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-medical-600" />
      </div>
    }>
      <PatientMessagesContent />
    </Suspense>
  );
}

function PatientMessagesContent() {
  const searchParams = useSearchParams();
  const initialConnectionId = searchParams.get('connection');
  
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(initialConnectionId);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastMarkAsReadAttemptRef = useRef<Record<string, number>>({});

  // Get current user
  const { data: userData } = api.user.getMe.useQuery();
  const currentUserId = userData?.id;

  // Get all conversations - poll every 10 seconds for real-time updates
  const { data: conversationsData, isLoading: conversationsLoading } = 
    api.message.getConversations.useQuery(undefined, {
      refetchInterval: 10000, // Poll every 10 seconds
      refetchIntervalInBackground: false,
    });

  // Get messages for selected conversation - poll every 5 seconds when active
  const { data: messagesData, isLoading: messagesLoading, refetch: refetchMessages } = 
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
      setMessageInput('');
      refetchMessages();
      inputRef.current?.focus();
    },
  });

  // Mark messages as read mutation
  const markAsRead = api.message.markAsRead.useMutation();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData?.messages]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (!selectedConnectionId || !currentUserId) return;
    if (markAsRead.isPending) return;
    if (!messagesData?.messages?.length) return;

    const hasUnread = messagesData.messages.some((m) => !m.isRead && m.senderId !== currentUserId);
    if (!hasUnread) return;

    const now = Date.now();
    const lastAttempt = lastMarkAsReadAttemptRef.current[selectedConnectionId] ?? 0;
    if (now - lastAttempt < 15000) return;
    lastMarkAsReadAttemptRef.current[selectedConnectionId] = now;

    markAsRead.mutate({ connectionId: selectedConnectionId });
  }, [selectedConnectionId, messagesData, currentUserId, markAsRead]);

  // Handle sending a message
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConnectionId || sendMessage.isPending) return;
    
    sendMessage.mutate({
      connectionId: selectedConnectionId,
      content: messageInput.trim(),
    });
  }, [messageInput, selectedConnectionId, sendMessage]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Filter conversations by search query
  const filteredConversations = conversationsData?.conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = `${conv.otherParty.firstName || ''} ${conv.otherParty.lastName || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }) ?? [];

  // Get selected conversation details
  const selectedConversation = conversationsData?.conversations.find(
    c => c.connectionId === selectedConnectionId
  );


  // Loading state
  if (conversationsLoading) {
    return (
      <div className="flex h-full bg-slate-50">
        <div className="w-full md:w-96 bg-white border-r border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-800 mb-3">Messages</h1>
          </div>
          <ConversationListSkeleton count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50">
      {/* Conversations List */}
      <div className={`w-full md:w-96 bg-white border-r border-slate-200 flex flex-col ${
        selectedConnectionId ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-medical-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-600">No conversations yet</p>
              <p className="text-sm mt-1">Connect with a doctor to start messaging</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map((conversation) => (
                <ConversationItem
                  key={conversation.connectionId}
                  conversation={conversation}
                  isSelected={selectedConnectionId === conversation.connectionId}
                  currentUserId={currentUserId ?? ''}
                  onClick={() => setSelectedConnectionId(conversation.connectionId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${
        selectedConnectionId ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedConnectionId && selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSelectedConnectionId(null)}
                className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              {selectedConversation.otherParty.imageUrl ? (
                <img
                  src={selectedConversation.otherParty.imageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-medical-100 flex items-center justify-center text-medical-600 font-bold">
                  <User className="w-5 h-5" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-slate-800 truncate">
                  Dr. {selectedConversation.otherParty.firstName}{' '}
                  {selectedConversation.otherParty.lastName}
                </h2>
                <p className="text-sm text-slate-500 truncate">
                  Healthcare Provider
                </p>
              </div>
              
              <Link
                href={`/patient/intake/${selectedConnectionId}`}
                className="shrink-0 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-medical-600 hover:bg-medical-50 rounded-lg transition-colors inline-flex items-center gap-1"
              >
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">View Intake</span>
              </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50">
              {messagesLoading ? (
                <MessageListSkeleton count={5} />
              ) : messagesData?.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-slate-600 font-medium">No messages yet</p>
                  <p className="text-sm">Send a message to start the conversation</p>
                </div>
              ) : (
                <>
                  {messagesData?.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwn={message.senderId === currentUserId}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-slate-200 p-3 sm:p-4">
              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none bg-slate-100 border-0 rounded-xl px-3 py-2 sm:px-4 sm:py-3 text-sm focus:ring-2 focus:ring-medical-500 focus:bg-white transition-colors max-h-32"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendMessage.isPending}
                  className="p-2.5 sm:p-3 bg-medical-600 text-white rounded-xl hover:bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-600">Select a conversation</p>
            <p className="text-sm mt-1">Choose a doctor from the list to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
