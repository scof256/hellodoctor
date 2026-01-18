import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DirectChatOverlay from '@/app/components/DirectChatOverlay';
import { DirectMessage } from '@/app/types';

describe('DirectChatOverlay - Date Separators Integration', () => {
  const mockOnClose = vi.fn();
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    // Mock scrollIntoView for test environment
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('should render date separators between messages from different dates', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const messages: DirectMessage[] = [
      {
        id: '1',
        sender: 'doctor',
        text: 'Message from two days ago',
        timestamp: twoDaysAgo,
        read: true,
      },
      {
        id: '2',
        sender: 'patient',
        text: 'Message from yesterday',
        timestamp: yesterday,
        read: true,
      },
      {
        id: '3',
        sender: 'doctor',
        text: 'Message from today',
        timestamp: today,
        read: false,
      },
    ];

    render(
      <DirectChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        messages={messages}
        onSendMessage={mockOnSendMessage}
        currentUser="patient"
      />
    );

    // Should render "Today" separator
    expect(screen.getByText('Today')).toBeInTheDocument();
    
    // Should render "Yesterday" separator
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
    
    // Should render all messages
    expect(screen.getByText('Message from two days ago')).toBeInTheDocument();
    expect(screen.getByText('Message from yesterday')).toBeInTheDocument();
    expect(screen.getByText('Message from today')).toBeInTheDocument();
  });

  it('should render single date separator for messages from same date', () => {
    const today = new Date();

    const messages: DirectMessage[] = [
      {
        id: '1',
        sender: 'doctor',
        text: 'First message today',
        timestamp: today,
        read: true,
      },
      {
        id: '2',
        sender: 'patient',
        text: 'Second message today',
        timestamp: today,
        read: true,
      },
      {
        id: '3',
        sender: 'doctor',
        text: 'Third message today',
        timestamp: today,
        read: false,
      },
    ];

    render(
      <DirectChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        messages={messages}
        onSendMessage={mockOnSendMessage}
        currentUser="patient"
      />
    );

    // Should render only one "Today" separator
    const todaySeparators = screen.getAllByText('Today');
    expect(todaySeparators).toHaveLength(1);
    
    // Should render all messages
    expect(screen.getByText('First message today')).toBeInTheDocument();
    expect(screen.getByText('Second message today')).toBeInTheDocument();
    expect(screen.getByText('Third message today')).toBeInTheDocument();
  });

  it('should not render date separators for empty message list', () => {
    render(
      <DirectChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        messages={[]}
        onSendMessage={mockOnSendMessage}
        currentUser="patient"
      />
    );

    // Should not render any date separators
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
    
    // Should show empty state message
    expect(screen.getByText(/This is a private, direct channel/i)).toBeInTheDocument();
  });

  it('should render date separators correctly in modal context', () => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const messages: DirectMessage[] = [
      {
        id: '1',
        sender: 'doctor',
        text: 'Message from last week',
        timestamp: lastWeek,
        read: true,
      },
      {
        id: '2',
        sender: 'patient',
        text: 'Message from today',
        timestamp: today,
        read: false,
      },
    ];

    render(
      <DirectChatOverlay
        isOpen={true}
        onClose={mockOnClose}
        messages={messages}
        onSendMessage={mockOnSendMessage}
        currentUser="doctor"
      />
    );

    // Should render "Today" separator
    expect(screen.getByText('Today')).toBeInTheDocument();
    
    // Should render date separator for last week (formatted as month and day)
    const lastWeekFormatted = lastWeek.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric',
      ...(lastWeek.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {})
    });
    expect(screen.getByText(lastWeekFormatted)).toBeInTheDocument();
    
    // Should render both messages
    expect(screen.getByText('Message from last week')).toBeInTheDocument();
    expect(screen.getByText('Message from today')).toBeInTheDocument();
  });
});
