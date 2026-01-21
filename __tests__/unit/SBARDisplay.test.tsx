/**
 * Unit Tests for SBARDisplay Component
 * 
 * Tests rendering with complete SBAR content, loading states, error states,
 * timestamp formatting, and color theme application.
 * 
 * Requirements: 2.1, 2.5, 3.1, 3.2, 3.3, 3.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SBARDisplay } from '../../app/components/SBARDisplay';
import { SBARContent } from '../../app/lib/sbar-extractor';

describe('SBARDisplay Component', () => {
  const mockSBARContent: SBARContent = {
    situation: 'Patient presents with acute chest pain',
    background: 'History of hypertension, no previous cardiac events',
    assessment: 'Possible acute coronary syndrome',
    recommendation: 'Immediate ECG and cardiac enzyme testing',
    type: 'summary',
    generatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering with complete SBAR content', () => {
    it('should render all four SBAR cards with correct titles', () => {
      render(<SBARDisplay content={mockSBARContent} />);

      expect(screen.getByText('Situation')).toBeInTheDocument();
      expect(screen.getByText('Background')).toBeInTheDocument();
      expect(screen.getByText('Assessment')).toBeInTheDocument();
      expect(screen.getByText('Recommendation')).toBeInTheDocument();
    });

    it('should render all SBAR content correctly', () => {
      render(<SBARDisplay content={mockSBARContent} />);

      expect(screen.getByText(/Patient presents with acute chest pain/)).toBeInTheDocument();
      expect(screen.getByText(/History of hypertension/)).toBeInTheDocument();
      expect(screen.getByText(/Possible acute coronary syndrome/)).toBeInTheDocument();
      expect(screen.getByText(/Immediate ECG and cardiac enzyme testing/)).toBeInTheDocument();
    });

    it('should not render when content is null', () => {
      const { container } = render(<SBARDisplay content={null} />);
      
      expect(screen.queryByText('Situation')).not.toBeInTheDocument();
      expect(screen.queryByText('Background')).not.toBeInTheDocument();
      expect(screen.queryByText('Assessment')).not.toBeInTheDocument();
      expect(screen.queryByText('Recommendation')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should display loading indicator when isLoading is true', () => {
      render(<SBARDisplay content={mockSBARContent} isLoading={true} />);

      expect(screen.getByText('Updating analysis...')).toBeInTheDocument();
    });

    it('should not display loading indicator when isLoading is false', () => {
      render(<SBARDisplay content={mockSBARContent} isLoading={false} />);

      expect(screen.queryByText('Updating analysis...')).not.toBeInTheDocument();
    });

    it('should display loading indicator with spinner icon', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} isLoading={true} />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error state with content preservation', () => {
    it('should display error message when error prop is provided', () => {
      const errorMessage = 'Failed to generate analysis';
      render(<SBARDisplay content={mockSBARContent} error={errorMessage} />);

      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to generate analysis/)).toBeInTheDocument();
    });

    it('should preserve existing content when error is displayed', () => {
      const errorMessage = 'Network error';
      render(<SBARDisplay content={mockSBARContent} error={errorMessage} />);

      // Error should be visible
      expect(screen.getByText(/Network error/)).toBeInTheDocument();

      // Content should still be visible
      expect(screen.getByText(/Patient presents with acute chest pain/)).toBeInTheDocument();
      expect(screen.getByText('Situation')).toBeInTheDocument();
    });

    it('should not display error when error prop is null', () => {
      render(<SBARDisplay content={mockSBARContent} error={null} />);

      expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
    });
  });

  describe('Timestamp formatting', () => {
    it('should display "just now" for timestamps less than 1 minute ago', () => {
      const now = new Date('2024-01-15T10:00:00Z').getTime();
      const timestamp = new Date('2024-01-15T09:59:30Z').getTime(); // 30 seconds ago
      
      vi.setSystemTime(now);
      
      render(<SBARDisplay content={mockSBARContent} lastUpdated={timestamp} />);

      expect(screen.getByText(/just now/)).toBeInTheDocument();
    });

    it('should display minutes ago for timestamps less than 1 hour ago', () => {
      const now = new Date('2024-01-15T10:00:00Z').getTime();
      const timestamp = new Date('2024-01-15T09:45:00Z').getTime(); // 15 minutes ago
      
      vi.setSystemTime(now);
      
      render(<SBARDisplay content={mockSBARContent} lastUpdated={timestamp} />);

      expect(screen.getByText(/15 minutes ago/)).toBeInTheDocument();
    });

    it('should display singular "minute" for 1 minute ago', () => {
      const now = new Date('2024-01-15T10:00:00Z').getTime();
      const timestamp = new Date('2024-01-15T09:59:00Z').getTime(); // 1 minute ago
      
      vi.setSystemTime(now);
      
      render(<SBARDisplay content={mockSBARContent} lastUpdated={timestamp} />);

      expect(screen.getByText(/1 minute ago/)).toBeInTheDocument();
    });

    it('should display hours ago for timestamps less than 24 hours ago', () => {
      const now = new Date('2024-01-15T10:00:00Z').getTime();
      const timestamp = new Date('2024-01-15T07:00:00Z').getTime(); // 3 hours ago
      
      vi.setSystemTime(now);
      
      render(<SBARDisplay content={mockSBARContent} lastUpdated={timestamp} />);

      expect(screen.getByText(/3 hours ago/)).toBeInTheDocument();
    });

    it('should display time for timestamps from today but more than 24 hours ago', () => {
      const now = new Date('2024-01-15T23:00:00Z').getTime();
      const timestamp = new Date('2024-01-15T08:30:00Z').getTime(); // Same day, earlier
      
      vi.setSystemTime(now);
      
      render(<SBARDisplay content={mockSBARContent} lastUpdated={timestamp} />);

      // Should show time format (e.g., "8:30 AM")
      const timestampText = screen.getByText(/Last updated:/);
      expect(timestampText).toBeInTheDocument();
    });

    it('should not display timestamp when lastUpdated is null', () => {
      render(<SBARDisplay content={mockSBARContent} lastUpdated={null} />);

      expect(screen.queryByText(/Last updated:/)).not.toBeInTheDocument();
    });

    it('should display timestamp with clock icon', () => {
      const timestamp = Date.now();
      const { container } = render(<SBARDisplay content={mockSBARContent} lastUpdated={timestamp} />);

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      // Check for clock icon (lucide-react renders as svg)
      const clockIcon = container.querySelector('svg');
      expect(clockIcon).toBeInTheDocument();
    });
  });

  describe('Color theme application', () => {
    it('should apply blue theme to Situation card', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} />);

      const situationCard = screen.getByText('Situation').closest('div');
      expect(situationCard?.className).toContain('blue');
    });

    it('should apply slate theme to Background card', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} />);

      const backgroundCard = screen.getByText('Background').closest('div');
      expect(backgroundCard?.className).toContain('slate');
    });

    it('should apply amber theme to Assessment card', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} />);

      const assessmentCard = screen.getByText('Assessment').closest('div');
      expect(assessmentCard?.className).toContain('amber');
    });

    it('should apply emerald theme to Recommendation card', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} />);

      const recommendationCard = screen.getByText('Recommendation').closest('div');
      expect(recommendationCard?.className).toContain('emerald');
    });

    it('should render cards with proper border and background styling', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} />);

      const cards = container.querySelectorAll('.border');
      expect(cards.length).toBeGreaterThan(0);

      cards.forEach(card => {
        expect(card.className).toMatch(/border-\w+-\d+/);
        expect(card.className).toMatch(/rounded-xl/);
      });
    });
  });

  describe('Animation classes', () => {
    it('should apply animation classes to SBAR cards container', () => {
      const { container } = render(<SBARDisplay content={mockSBARContent} />);

      const cardsContainer = container.querySelector('.animate-in');
      expect(cardsContainer).toBeInTheDocument();
      expect(cardsContainer?.className).toContain('fade-in');
      expect(cardsContainer?.className).toContain('slide-in-from-bottom-4');
    });
  });

  describe('Combined states', () => {
    it('should display loading, error, and content simultaneously', () => {
      const errorMessage = 'Temporary network issue';
      render(
        <SBARDisplay 
          content={mockSBARContent} 
          isLoading={true} 
          error={errorMessage}
          lastUpdated={Date.now()}
        />
      );

      // All should be visible
      expect(screen.getByText('Updating analysis...')).toBeInTheDocument();
      expect(screen.getByText(/Temporary network issue/)).toBeInTheDocument();
      expect(screen.getByText(/Patient presents with acute chest pain/)).toBeInTheDocument();
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });
});
