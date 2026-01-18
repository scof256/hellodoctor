/**
 * Integration test for Tutorial Flow
 * Tests complete tutorial flow and skip functionality
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Tutorial } from '../../app/components/Tutorial';
import { TutorialWrapper } from '../../app/components/TutorialWrapper';
import { tutorialSteps } from '../../app/lib/tutorial-content';

describe('Tutorial Flow Integration', () => {
  const mockOnComplete = vi.fn();
  const mockOnSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Tutorial Component', () => {
    it('should render first tutorial step with all required elements', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Should show first step content
      expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();
      expect(
        screen.getByText(
          "Scan your doctor's QR code or use their link to connect instantly. It's that simple!"
        )
      ).toBeInTheDocument();

      // Should show illustration (emoji)
      expect(screen.getByText('👨‍⚕️')).toBeInTheDocument();

      // Should show progress dots (3 dots for 3 steps)
      const progressDots = document.querySelectorAll('button[aria-label^="Go to step"]');
      expect(progressDots.length).toBe(3);

      // Should show Next button
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();

      // Should show Skip button
      expect(screen.getByLabelText('Skip tutorial')).toBeInTheDocument();
    });

    it('should navigate through all 3 tutorial steps', async () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Step 1: Connect to Doctor
      expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();
      expect(screen.getByText('👨‍⚕️')).toBeInTheDocument();

      // Click Next
      const nextButton = screen.getByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);

      // Step 2: Fill Medical Form
      await waitFor(() => {
        expect(screen.getByText('Fill Your Medical Form')).toBeInTheDocument();
      });
      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Chat with our friendly AI assistant to complete your medical history. Answer questions at your own pace.'
        )
      ).toBeInTheDocument();

      // Click Next again
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      // Step 3: Book Appointment
      await waitFor(() => {
        expect(screen.getByText('Book Your Appointment')).toBeInTheDocument();
      });
      expect(screen.getByText('📅')).toBeInTheDocument();
      expect(
        screen.getByText(
          "Choose a time that works for you in just 3 taps. We'll send you a reminder before your appointment."
        )
      ).toBeInTheDocument();

      // Last step should show "Got it!" button
      expect(screen.getByRole('button', { name: /Got it!/i })).toBeInTheDocument();
    });

    it('should call onComplete when finishing tutorial', async () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Navigate to last step
      const nextButton = screen.getByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Fill Your Medical Form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      await waitFor(() => {
        expect(screen.getByText('Book Your Appointment')).toBeInTheDocument();
      });

      // Click "Got it!"
      const gotItButton = screen.getByRole('button', { name: /Got it!/i });
      fireEvent.click(gotItButton);

      // Should call onComplete
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should call onSkip when skip button is clicked', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Click skip button
      const skipButton = screen.getByLabelText('Skip tutorial');
      fireEvent.click(skipButton);

      // Should call onSkip
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should allow navigation via progress dots', async () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Should be on step 1
      expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();

      // Click on third progress dot
      const progressDots = document.querySelectorAll('button[aria-label^="Go to step"]');
      fireEvent.click(progressDots[2]!);

      // Should jump to step 3
      await waitFor(() => {
        expect(screen.getByText('Book Your Appointment')).toBeInTheDocument();
      });

      // Click on first progress dot
      fireEvent.click(progressDots[0]!);

      // Should jump back to step 1
      await waitFor(() => {
        expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();
      });
    });

    it('should support swipe navigation (left swipe to next)', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Should be on step 1
      expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();

      // Simulate left swipe (swipe to next)
      const container = screen.getByText('Connect to Your Doctor').closest('div[class*="rounded-2xl"]');
      expect(container).toBeInTheDocument();

      // Touch start
      fireEvent.touchStart(container!, {
        targetTouches: [{ clientX: 200 }],
      });

      // Touch move (left)
      fireEvent.touchMove(container!, {
        targetTouches: [{ clientX: 100 }],
      });

      // Touch end
      fireEvent.touchEnd(container!);

      // Should move to step 2
      expect(screen.getByText('Fill Your Medical Form')).toBeInTheDocument();
    });

    it('should support swipe navigation (right swipe to previous)', async () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Navigate to step 2 first
      const nextButton = screen.getByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Fill Your Medical Form')).toBeInTheDocument();
      });

      // Simulate right swipe (swipe to previous)
      const container = screen.getByText('Fill Your Medical Form').closest('div[class*="rounded-2xl"]');
      expect(container).toBeInTheDocument();

      // Touch start
      fireEvent.touchStart(container!, {
        targetTouches: [{ clientX: 100 }],
      });

      // Touch move (right)
      fireEvent.touchMove(container!, {
        targetTouches: [{ clientX: 200 }],
      });

      // Touch end
      fireEvent.touchEnd(container!);

      // Should move back to step 1
      expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={false}
        />
      );

      // Should not show tutorial content
      expect(screen.queryByText('Connect to Your Doctor')).not.toBeInTheDocument();
      expect(screen.queryByText('Fill Your Medical Form')).not.toBeInTheDocument();
      expect(screen.queryByText('Book Your Appointment')).not.toBeInTheDocument();
    });

    it('should highlight current step in progress dots', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      const progressDots = document.querySelectorAll('button[aria-label^="Go to step"]');
      
      // First dot should be highlighted (has bg-[#25D366] and w-6)
      const firstDot = progressDots[0];
      expect(firstDot?.className).toContain('bg-[#25D366]');
      expect(firstDot?.className).toContain('w-6');

      // Other dots should not be highlighted
      const secondDot = progressDots[1];
      expect(secondDot?.className).toContain('bg-gray-300');
    });

    it('should show completed steps in progress dots', async () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Fill Your Medical Form')).toBeInTheDocument();
      });

      const progressDots = document.querySelectorAll('button[aria-label^="Go to step"]');
      
      // First dot should show as completed (bg-[#25D366]/50)
      const firstDot = progressDots[0];
      expect(firstDot?.className).toContain('bg-[#25D366]/50');

      // Second dot should be current (bg-[#25D366] and w-6)
      const secondDot = progressDots[1];
      expect(secondDot?.className).toContain('bg-[#25D366]');
      expect(secondDot?.className).toContain('w-6');
    });
  });

  describe('TutorialWrapper with localStorage', () => {
    it('should show tutorial on first visit', () => {
      // Ensure localStorage is empty (first visit)
      expect(localStorage.getItem('hellodoctor_tutorial_completed')).toBeNull();

      render(<TutorialWrapper />);

      // Should show tutorial
      expect(screen.getByText('Connect to Your Doctor')).toBeInTheDocument();
    });

    it('should not show tutorial if already completed', () => {
      // Set tutorial as completed in localStorage
      localStorage.setItem(
        'hellodoctor_tutorial_completed',
        JSON.stringify({
          completed: true,
          skipped: false,
          completedAt: new Date().toISOString(),
        })
      );

      render(<TutorialWrapper />);

      // Should not show tutorial
      expect(screen.queryByText('Connect to Your Doctor')).not.toBeInTheDocument();
    });

    it('should not show tutorial if skipped', () => {
      // Set tutorial as skipped in localStorage
      localStorage.setItem(
        'hellodoctor_tutorial_completed',
        JSON.stringify({
          completed: false,
          skipped: true,
          completedAt: new Date().toISOString(),
        })
      );

      render(<TutorialWrapper />);

      // Should not show tutorial
      expect(screen.queryByText('Connect to Your Doctor')).not.toBeInTheDocument();
    });

    it('should save completion state to localStorage', async () => {
      render(<TutorialWrapper />);

      // Navigate through tutorial
      const nextButton = screen.getByRole('button', { name: 'Next' });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Fill Your Medical Form')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      await waitFor(() => {
        expect(screen.getByText('Book Your Appointment')).toBeInTheDocument();
      });

      // Complete tutorial
      const gotItButton = screen.getByRole('button', { name: /Got it!/i });
      fireEvent.click(gotItButton);

      // Check localStorage
      await waitFor(() => {
        const stored = localStorage.getItem('hellodoctor_tutorial_completed');
        expect(stored).not.toBeNull();
        
        const state = JSON.parse(stored!);
        expect(state.completed).toBe(true);
        expect(state.skipped).toBe(false);
      });
    });

    it('should save skip state to localStorage', () => {
      render(<TutorialWrapper />);

      // Skip tutorial
      const skipButton = screen.getByLabelText('Skip tutorial');
      fireEvent.click(skipButton);

      // Check localStorage
      const stored = localStorage.getItem('hellodoctor_tutorial_completed');
      expect(stored).not.toBeNull();
      
      const state = JSON.parse(stored!);
      expect(state.completed).toBe(false);
      expect(state.skipped).toBe(true);
    });
  });

  describe('Tutorial Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Skip button should have aria-label
      expect(screen.getByLabelText('Skip tutorial')).toBeInTheDocument();

      // Progress dots should have aria-labels
      const progressDots = document.querySelectorAll('button[aria-label^="Go to step"]');
      expect(progressDots.length).toBe(3);
      expect(progressDots[0]).toHaveAttribute('aria-label', 'Go to step 1');
      expect(progressDots[1]).toHaveAttribute('aria-label', 'Go to step 2');
      expect(progressDots[2]).toHaveAttribute('aria-label', 'Go to step 3');
    });

    it('should have proper heading hierarchy', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Title should be an h2
      const title = screen.getByText('Connect to Your Doctor');
      expect(title.tagName).toBe('H2');
    });

    it('should have keyboard-accessible buttons', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // All buttons should be focusable
      const nextButton = screen.getByRole('button', { name: 'Next' });
      const skipButton = screen.getByLabelText('Skip tutorial');
      const progressDots = document.querySelectorAll('button[aria-label^="Go to step"]');

      expect(nextButton).toBeInTheDocument();
      expect(skipButton).toBeInTheDocument();
      expect(progressDots.length).toBe(3);

      // All should be buttons (inherently keyboard accessible)
      expect(nextButton.tagName).toBe('BUTTON');
      expect(skipButton.tagName).toBe('BUTTON');
      progressDots.forEach(dot => {
        expect(dot.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Tutorial Visual Design', () => {
    it('should use WhatsApp green color for primary button', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton.className).toContain('bg-[#25D366]');
    });

    it('should display large illustrations', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Emoji should be large (120px)
      const illustration = screen.getByText('👨‍⚕️');
      expect(illustration.className).toContain('text-[120px]');
    });

    it('should have proper text sizing', () => {
      render(
        <Tutorial
          steps={tutorialSteps}
          onComplete={mockOnComplete}
          onSkip={mockOnSkip}
          isOpen={true}
        />
      );

      // Title should be 24px (text-2xl)
      const title = screen.getByText('Connect to Your Doctor');
      expect(title.className).toContain('text-2xl');

      // Description should be 16px (text-base)
      const description = screen.getByText(
        "Scan your doctor's QR code or use their link to connect instantly. It's that simple!"
      );
      expect(description.className).toContain('text-base');

      // Button should be 20px (text-xl)
      const button = screen.getByRole('button', { name: 'Next' });
      expect(button.className).toContain('text-xl');
    });
  });
});
