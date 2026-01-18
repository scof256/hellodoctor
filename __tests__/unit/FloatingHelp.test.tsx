import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { FloatingHelp, type HelpContent } from '@/app/components/FloatingHelp';

describe('FloatingHelp Component', () => {
  const mockHelpContent: HelpContent = {
    title: 'Test Help',
    description: 'This is a test help description.',
    steps: ['Step 1: Do this', 'Step 2: Do that', 'Step 3: Complete'],
    screenshot: '/test-screenshot.png',
    contactOptions: {
      phone: '+256700000000',
      whatsapp: '256700000000',
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    // Reset any mocks before each test
    vi.clearAllMocks();
  });

  describe('Rendering and Positioning', () => {
    it('should render the floating help button', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('floating-help-button');
    });

    it('should render button with correct size (56x56px)', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        width: '56px',
        height: '56px',
      });
    });

    it('should render button with question mark icon', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveTextContent('?');
    });

    it('should position button at bottom-right by default', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        position: 'fixed',
        bottom: '16px',
        right: '16px',
      });
    });

    it('should position button at bottom-left when specified', () => {
      render(<FloatingHelp contextId="test-context" position="bottom-left" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        position: 'fixed',
        bottom: '16px',
        left: '16px',
      });
    });

    it('should have blue background color (#0088CC)', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        backgroundColor: '#0088CC',
        color: '#FFFFFF',
      });
    });

    it('should have circular shape (border-radius: 50%)', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        borderRadius: '50%',
      });
    });

    it('should have elevated shadow', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      });
    });

    it('should have high z-index (1000)', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveStyle({
        zIndex: 1000,
      });
    });

    it('should include context-id as data attribute', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveAttribute('data-context-id', 'test-context');
    });
  });

  describe('Help Content Display', () => {
    it('should not show help content initially', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      expect(screen.queryByText('Test Help')).not.toBeInTheDocument();
    });

    it('should show help content when button is clicked', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Test Help')).toBeInTheDocument();
    });

    it('should display help title', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Test Help')).toBeInTheDocument();
    });

    it('should display help description', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('This is a test help description.')).toBeInTheDocument();
    });

    it('should display all steps', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Step 1: Do this')).toBeInTheDocument();
      expect(screen.getByText('Step 2: Do that')).toBeInTheDocument();
      expect(screen.getByText('Step 3: Complete')).toBeInTheDocument();
    });

    it('should display screenshot when provided', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const screenshot = screen.getByAltText('Help screenshot');
      expect(screenshot).toBeInTheDocument();
      expect(screenshot).toHaveAttribute('src', '/test-screenshot.png');
    });

    it('should display video when provided', () => {
      const contentWithVideo: HelpContent = {
        ...mockHelpContent,
        videoUrl: '/test-video.mp4',
      };

      const { container } = render(
        <FloatingHelp contextId="test-context" helpContent={contentWithVideo} />
      );

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const video = container.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', '/test-video.mp4');
    });

    it('should display contact options section', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Need more help?')).toBeInTheDocument();
    });

    it('should display phone contact button when phone is provided', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Call Support')).toBeInTheDocument();
    });

    it('should display WhatsApp contact button when whatsapp is provided', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('WhatsApp Support')).toBeInTheDocument();
    });

    it('should display email contact button when email is provided', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Email Support')).toBeInTheDocument();
    });

    it('should display close button', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const closeButton = screen.getByLabelText('Close help');
      expect(closeButton).toBeInTheDocument();
    });

    it('should close help content when close button is clicked', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Test Help')).toBeInTheDocument();

      const closeButton = screen.getByLabelText('Close help');
      fireEvent.click(closeButton);

      expect(screen.queryByText('Test Help')).not.toBeInTheDocument();
    });

    it('should close help content when backdrop is clicked', () => {
      const { container } = render(
        <FloatingHelp contextId="test-context" helpContent={mockHelpContent} />
      );

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Test Help')).toBeInTheDocument();

      // Find and click the backdrop
      const backdrop = container.querySelector('div[style*="rgba(0, 0, 0, 0.5)"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(screen.queryByText('Test Help')).not.toBeInTheDocument();
    });

    it('should display default "Help" title when no content provided', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.getByText('Help')).toBeInTheDocument();
    });
  });

  describe('Contact Actions', () => {
    it('should initiate phone call when phone button is clicked', () => {
      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const phoneButton = screen.getByText('Call Support');
      fireEvent.click(phoneButton);

      expect(window.location.href).toBe('tel:+256700000000');
    });

    it('should open WhatsApp when WhatsApp button is clicked', () => {
      // Mock window.open
      const mockOpen = vi.fn();
      window.open = mockOpen;

      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const whatsappButton = screen.getByText('WhatsApp Support');
      fireEvent.click(whatsappButton);

      expect(mockOpen).toHaveBeenCalledWith('https://wa.me/256700000000', '_blank');
    });

    it('should initiate email when email button is clicked', () => {
      // Mock window.location.href
      delete (window as any).location;
      window.location = { href: '' } as any;

      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const emailButton = screen.getByText('Email Support');
      fireEvent.click(emailButton);

      expect(window.location.href).toBe('mailto:test@example.com');
    });

    it('should not display phone button when phone is not provided', () => {
      const contentWithoutPhone: HelpContent = {
        ...mockHelpContent,
        contactOptions: {
          whatsapp: '256700000000',
          email: 'test@example.com',
        },
      };

      render(<FloatingHelp contextId="test-context" helpContent={contentWithoutPhone} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.queryByText('Call Support')).not.toBeInTheDocument();
    });

    it('should not display WhatsApp button when whatsapp is not provided', () => {
      const contentWithoutWhatsApp: HelpContent = {
        ...mockHelpContent,
        contactOptions: {
          phone: '+256700000000',
          email: 'test@example.com',
        },
      };

      render(<FloatingHelp contextId="test-context" helpContent={contentWithoutWhatsApp} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.queryByText('WhatsApp Support')).not.toBeInTheDocument();
    });

    it('should not display email button when email is not provided', () => {
      const contentWithoutEmail: HelpContent = {
        ...mockHelpContent,
        contactOptions: {
          phone: '+256700000000',
          whatsapp: '256700000000',
        },
      };

      render(<FloatingHelp contextId="test-context" helpContent={contentWithoutEmail} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      expect(screen.queryByText('Email Support')).not.toBeInTheDocument();
    });
  });

  describe('Bottom Sheet Styling', () => {
    it('should display bottom sheet with correct styling', () => {
      const { container } = render(
        <FloatingHelp contextId="test-context" helpContent={mockHelpContent} />
      );

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const bottomSheet = container.querySelector('.help-bottom-sheet');
      expect(bottomSheet).toBeInTheDocument();
      expect(bottomSheet).toHaveStyle({
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 1002,
      });
    });

    it('should display backdrop with semi-transparent background', () => {
      const { container } = render(
        <FloatingHelp contextId="test-context" helpContent={mockHelpContent} />
      );

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const backdrop = container.querySelector('div[style*="rgba(0, 0, 0, 0.5)"]');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveStyle({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1001,
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for help button', () => {
      render(<FloatingHelp contextId="test-context" />);

      const button = screen.getByLabelText('Get help');
      expect(button).toHaveAttribute('aria-label', 'Get help');
    });

    it('should have proper aria-label for close button', () => {
      render(<FloatingHelp contextId="test-context" helpContent={mockHelpContent} />);

      const button = screen.getByLabelText('Get help');
      fireEvent.click(button);

      const closeButton = screen.getByLabelText('Close help');
      expect(closeButton).toHaveAttribute('aria-label', 'Close help');
    });
  });
});
