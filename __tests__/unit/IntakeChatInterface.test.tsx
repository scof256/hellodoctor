import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import IntakeChatInterface from '@/app/(dashboard)/doctor/patients/[connectionId]/intake/IntakeChatInterface';
import type { Message } from '@/types';

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('IntakeChatInterface', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      text: 'I have a headache',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      contextLayer: 'patient-intake',
    },
    {
      id: '2',
      role: 'model',
      text: 'Can you describe the headache?',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      activeAgent: 'Triage',
      contextLayer: 'patient-intake',
    },
    {
      id: '3',
      role: 'doctor',
      text: 'Test result: Blood pressure normal',
      timestamp: new Date('2024-01-01T10:05:00Z'),
      contextLayer: 'doctor-enhancement',
    },
  ];

  it('should render messages in chronological order', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // Check that all messages are rendered
    expect(screen.getByText('I have a headache')).toBeInTheDocument();
    expect(screen.getByText('Can you describe the headache?')).toBeInTheDocument();
    expect(screen.getByText('Test result: Blood pressure normal')).toBeInTheDocument();
  });

  it('should display patient name for user messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should display agent badge for AI messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // Check for agent label
    expect(screen.getByText('Triage')).toBeInTheDocument();
  });

  it('should display doctor label for doctor messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    expect(screen.getByText('Doctor')).toBeInTheDocument();
  });

  it('should show read-only indicator for patient intake messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // Patient intake messages should have read-only indicator
    const readOnlyIndicators = screen.getAllByText('Read-only');
    expect(readOnlyIndicators.length).toBeGreaterThan(0);
  });

  it('should display timestamps for all messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // All messages should have timestamps (formatted as "X ago")
    const timestamps = screen.getAllByText(/ago$/);
    expect(timestamps.length).toBe(mockMessages.length);
  });

  it('should show empty state when no messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={[]}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('should display read-only banner when isReadOnly is true', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    expect(screen.getByText(/This intake session has been reviewed/)).toBeInTheDocument();
  });

  it('should differentiate patient messages with gray background', () => {
    const { container } = render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // Patient messages should have slate background
    const patientMessage = container.querySelector('.bg-slate-100');
    expect(patientMessage).toBeInTheDocument();
  });

  it('should differentiate doctor messages with purple background', () => {
    const { container } = render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // Doctor messages should have purple background
    const doctorMessage = container.querySelector('.bg-purple-600');
    expect(doctorMessage).toBeInTheDocument();
  });

  it('should display test result indicator for test result messages', () => {
    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={mockMessages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    // The doctor message contains "test result" so should have indicator
    expect(screen.getByText('Test Result')).toBeInTheDocument();
  });

  it('should render images when present in messages', () => {
    const messagesWithImages: Message[] = [
      {
        id: '1',
        role: 'user',
        text: 'Here is my rash',
        images: ['https://example.com/image.jpg'],
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={messagesWithImages}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    const image = screen.getByAltText('Attachment 1');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('should handle base64 images correctly', () => {
    const messagesWithBase64: Message[] = [
      {
        id: '1',
        role: 'user',
        text: 'Here is my rash',
        images: ['base64encodedstring'],
        timestamp: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    render(
      <IntakeChatInterface
        connectionId="test-connection-id"
        messages={messagesWithBase64}
        patientName="John Doe"
        isReadOnly={true}
      />
    );

    const image = screen.getByAltText('Attachment 1');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'data:image/jpeg;base64,base64encodedstring');
  });
});
