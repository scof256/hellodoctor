/**
 * Integration tests for ChatInterface with date separators
 * Tests that date separators render correctly in the ChatInterface component
 * Requirements: 1.1, 1.2, 1.3
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import ChatInterface from '../../app/components/ChatInterface';
import { Message } from '../../app/types';

describe('ChatInterface with Date Separators', () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock scrollIntoView which is not available in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('should render separators between different dates', () => {
    // Create messages from different dates
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        text: 'Message from two days ago',
        timestamp: twoDaysAgo,
      },
      {
        id: '2',
        role: 'model',
        text: 'Response from two days ago',
        timestamp: twoDaysAgo,
      },
      {
        id: '3',
        role: 'user',
        text: 'Message from yesterday',
        timestamp: yesterday,
      },
      {
        id: '4',
        role: 'model',
        text: 'Response from yesterday',
        timestamp: yesterday,
      },
      {
        id: '5',
        role: 'user',
        text: 'Message from today',
        timestamp: today,
      },
    ];

    render(
      <ChatInterface
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    // Should have 3 date separators (one for each unique date)
    const separators = screen.getAllByText(/Today|Yesterday|January|February|March|April|May|June|July|August|September|October|November|December/);
    
    // Filter to only date separator text (not message content)
    const dateSeparators = separators.filter(el => 
      el.classList.contains('uppercase') && 
      el.classList.contains('tracking-wider')
    );
    
    expect(dateSeparators.length).toBe(3);
    
    // Verify the messages are rendered
    expect(screen.getByText('Message from two days ago')).toBeInTheDocument();
    expect(screen.getByText('Message from yesterday')).toBeInTheDocument();
    expect(screen.getByText('Message from today')).toBeInTheDocument();
  });

  it('should display single separator for same-date messages', () => {
    const today = new Date();
    
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        text: 'First message today',
        timestamp: today,
      },
      {
        id: '2',
        role: 'model',
        text: 'Second message today',
        timestamp: today,
      },
      {
        id: '3',
        role: 'user',
        text: 'Third message today',
        timestamp: today,
      },
    ];

    render(
      <ChatInterface
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    // Should have exactly 1 date separator showing "Today"
    const todaySeparators = screen.getAllByText('Today').filter(el => 
      el.classList.contains('uppercase') && 
      el.classList.contains('tracking-wider')
    );
    
    expect(todaySeparators.length).toBe(1);
    
    // Verify all messages are rendered
    expect(screen.getByText('First message today')).toBeInTheDocument();
    expect(screen.getByText('Second message today')).toBeInTheDocument();
    expect(screen.getByText('Third message today')).toBeInTheDocument();
  });

  it('should not display separators for empty message list', () => {
    const messages: Message[] = [];

    render(
      <ChatInterface
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    // Should show empty state message
    expect(screen.getByText('HelloDoctor is ready for intake.')).toBeInTheDocument();
    
    // Should not have any date separators
    const separators = screen.queryAllByText(/Today|Yesterday|January|February|March|April|May|June|July|August|September|October|November|December/);
    const dateSeparators = separators.filter(el => 
      el.classList.contains('uppercase') && 
      el.classList.contains('tracking-wider')
    );
    
    expect(dateSeparators.length).toBe(0);
  });

  it('should maintain existing functionality with stage tracker', () => {
    const today = new Date();
    
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        text: 'Test message',
        timestamp: today,
      },
    ];

    render(
      <ChatInterface
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
        currentStage="triage"
        completeness={25}
      />
    );

    // Stage tracker should still be present - check for the completeness percentage
    expect(screen.getByText('25% Complete')).toBeInTheDocument();
    
    // Message should be rendered
    expect(screen.getByText('Test message')).toBeInTheDocument();
    
    // Date separator should be present
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('should maintain existing functionality with image viewer', () => {
    const today = new Date();
    
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        text: 'Message with image',
        timestamp: today,
        images: ['base64imagedata'],
      },
    ];

    render(
      <ChatInterface
        messages={messages}
        onSendMessage={mockOnSendMessage}
        isLoading={false}
      />
    );

    // Message should be rendered
    expect(screen.getByText('Message with image')).toBeInTheDocument();
    
    // Image should be rendered
    const images = screen.getAllByAltText('User upload');
    expect(images.length).toBe(1);
    
    // Date separator should be present
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
