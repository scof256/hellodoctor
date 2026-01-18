/**
 * Integration tests for PatientMessagesClient with date separators
 * Tests that date separators render correctly with createdAt timestamps
 * and work with conversation switching
 * Requirements: 1.1, 5.2
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import PatientMessagesClient from '../../app/(dashboard)/patient/messages/PatientMessagesClient';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

// Mock tRPC
const mockGetMe = vi.fn();
const mockGetConversations = vi.fn();
const mockGetConversation = vi.fn();
const mockSendMessage = vi.fn();
const mockMarkAsRead = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@/trpc/react', () => ({
  api: {
    user: {
      getMe: {
        useQuery: () => mockGetMe(),
      },
    },
    message: {
      getConversations: {
        useQuery: () => mockGetConversations(),
      },
      getConversation: {
        useQuery: () => mockGetConversation(),
      },
      send: {
        useMutation: () => ({
          mutate: mockSendMessage,
          isPending: false,
        }),
      },
      markAsRead: {
        useMutation: () => ({
          mutate: mockMarkAsRead,
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      message: {
        getConversation: {
          invalidate: mockInvalidate,
        },
        getConversations: {
          invalidate: mockInvalidate,
        },
      },
    }),
  },
}));

describe('PatientMessagesClient with Date Separators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock scrollIntoView which is not available in jsdom
    Element.prototype.scrollIntoView = vi.fn();

    // Default mock for current user
    mockGetMe.mockReturnValue({
      data: { id: 'patient-123' },
    });

    // Default mock for conversations
    mockGetConversations.mockReturnValue({
      data: {
        conversations: [],
      },
      isLoading: false,
    });

    // Default mock for messages
    mockGetConversation.mockReturnValue({
      data: {
        messages: [],
      },
      isLoading: false,
    });
  });

  it('should render separators correctly with createdAt timestamps', async () => {
    // Create messages from different dates using createdAt field
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const mockConversations = [
      {
        connectionId: 'conn-1',
        otherParty: {
          userId: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          role: 'doctor' as const,
        },
        latestMessage: {
          content: 'Latest message',
          createdAt: today,
          isRead: true,
          isFromMe: false,
        },
        unreadCount: 0,
      },
    ];

    const mockMessages = [
      {
        id: 'msg-1',
        content: 'Message from two days ago',
        senderId: 'doctor-1',
        createdAt: twoDaysAgo,
        isRead: true,
        sender: {
          id: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          primaryRole: 'doctor',
        },
      },
      {
        id: 'msg-2',
        content: 'Response from two days ago',
        senderId: 'patient-123',
        createdAt: twoDaysAgo,
        isRead: true,
        sender: {
          id: 'patient-123',
          firstName: 'Jane',
          lastName: 'Doe',
          imageUrl: null,
          primaryRole: 'patient',
        },
      },
      {
        id: 'msg-3',
        content: 'Message from yesterday',
        senderId: 'doctor-1',
        createdAt: yesterday,
        isRead: true,
        sender: {
          id: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          primaryRole: 'doctor',
        },
      },
      {
        id: 'msg-4',
        content: 'Message from today',
        senderId: 'patient-123',
        createdAt: today,
        isRead: true,
        sender: {
          id: 'patient-123',
          firstName: 'Jane',
          lastName: 'Doe',
          imageUrl: null,
          primaryRole: 'patient',
        },
      },
    ];

    mockGetConversations.mockReturnValue({
      data: { conversations: mockConversations },
      isLoading: false,
    });

    mockGetConversation.mockReturnValue({
      data: { messages: mockMessages },
      isLoading: false,
    });

    // Mock useSearchParams to select the conversation
    vi.mocked(await import('next/navigation')).useSearchParams = () => ({
      get: vi.fn(() => 'conn-1'),
    });

    render(<PatientMessagesClient />);

    await waitFor(() => {
      // Should have 3 date separators (one for each unique date)
      const separators = screen.getAllByText(/Today|Yesterday|January|February|March|April|May|June|July|August|September|October|November|December/);
      
      // Filter to only date separator text (not message content)
      const dateSeparators = separators.filter(el => 
        el.classList.contains('uppercase') && 
        el.classList.contains('tracking-wider')
      );
      
      expect(dateSeparators.length).toBe(3);
    });

    // Verify the messages are rendered
    expect(screen.getByText('Message from two days ago')).toBeInTheDocument();
    expect(screen.getByText('Message from yesterday')).toBeInTheDocument();
    expect(screen.getByText('Message from today')).toBeInTheDocument();
  });

  it('should display single separator for same-date messages with createdAt', async () => {
    const today = new Date();

    const mockConversations = [
      {
        connectionId: 'conn-1',
        otherParty: {
          userId: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          role: 'doctor' as const,
        },
        latestMessage: {
          content: 'Latest message',
          createdAt: today,
          isRead: true,
          isFromMe: false,
        },
        unreadCount: 0,
      },
    ];

    const mockMessages = [
      {
        id: 'msg-1',
        content: 'First message today',
        senderId: 'doctor-1',
        createdAt: today,
        isRead: true,
        sender: {
          id: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          primaryRole: 'doctor',
        },
      },
      {
        id: 'msg-2',
        content: 'Second message today',
        senderId: 'patient-123',
        createdAt: today,
        isRead: true,
        sender: {
          id: 'patient-123',
          firstName: 'Jane',
          lastName: 'Doe',
          imageUrl: null,
          primaryRole: 'patient',
        },
      },
      {
        id: 'msg-3',
        content: 'Third message today',
        senderId: 'doctor-1',
        createdAt: today,
        isRead: true,
        sender: {
          id: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          primaryRole: 'doctor',
        },
      },
    ];

    mockGetConversations.mockReturnValue({
      data: { conversations: mockConversations },
      isLoading: false,
    });

    mockGetConversation.mockReturnValue({
      data: { messages: mockMessages },
      isLoading: false,
    });

    // Mock useSearchParams to select the conversation
    vi.mocked(await import('next/navigation')).useSearchParams = () => ({
      get: vi.fn(() => 'conn-1'),
    });

    render(<PatientMessagesClient />);

    await waitFor(() => {
      // Should have exactly 1 date separator showing "Today"
      const todaySeparators = screen.getAllByText('Today').filter(el => 
        el.classList.contains('uppercase') && 
        el.classList.contains('tracking-wider')
      );
      
      expect(todaySeparators.length).toBe(1);
    });

    // Verify all messages are rendered
    expect(screen.getByText('First message today')).toBeInTheDocument();
    expect(screen.getByText('Second message today')).toBeInTheDocument();
    expect(screen.getByText('Third message today')).toBeInTheDocument();
  });

  it('should not display separators for empty conversation', async () => {
    const mockConversations = [
      {
        connectionId: 'conn-1',
        otherParty: {
          userId: 'doctor-1',
          firstName: 'John',
          lastName: 'Smith',
          imageUrl: null,
          role: 'doctor' as const,
        },
        latestMessage: null,
        unreadCount: 0,
      },
    ];

    mockGetConversations.mockReturnValue({
      data: { conversations: mockConversations },
      isLoading: false,
    });

    mockGetConversation.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
    });

    // Mock useSearchParams to select the conversation
    vi.mocked(await import('next/navigation')).useSearchParams = () => ({
      get: vi.fn(() => 'conn-1'),
    });

    render(<PatientMessagesClient />);

    await waitFor(() => {
      // Should show empty state message
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    // Should not have any date separators
    const separators = screen.queryAllByText(/Today|Yesterday|January|February|March|April|May|June|July|August|September|October|November|December/);
    const dateSeparators = separators.filter(el => 
      el.classList.contains('uppercase') && 
      el.classList.contains('tracking-wider')
    );
    
    expect(dateSeparators.length).toBe(0);
  });
});
