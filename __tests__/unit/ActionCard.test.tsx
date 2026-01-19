import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ActionCard } from '@/app/components/ActionCard';

// Mock button-feedback module
vi.mock('@/app/lib/button-feedback', () => ({
  handleButtonPress: vi.fn(),
}));

describe('ActionCard Animation Classes', () => {
  const defaultProps = {
    title: 'Test Card',
    icon: <span>🔔</span>,
    iconColor: '#25D366',
    onTap: vi.fn(),
  };

  describe('Requirement 3.1: pulseMode prop support', () => {
    it('should apply animate-pulse-glow class when pulseMode is "auto"', () => {
      const { container } = render(
        <ActionCard {...defaultProps} pulseMode="auto" />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('animate-pulse-glow');
    });

    it('should apply animate-pulse-glow-hover class when pulseMode is "hover"', () => {
      const { container } = render(
        <ActionCard {...defaultProps} pulseMode="hover" />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('animate-pulse-glow-hover');
    });

    it('should not apply animation class when pulseMode is "none"', () => {
      const { container } = render(
        <ActionCard {...defaultProps} pulseMode="none" />
      );

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('animate-pulse-glow');
      expect(button).not.toHaveClass('animate-pulse-glow-hover');
    });

    it('should not apply animation class when pulseMode is undefined', () => {
      const { container } = render(
        <ActionCard {...defaultProps} />
      );

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('animate-pulse-glow');
      expect(button).not.toHaveClass('animate-pulse-glow-hover');
    });
  });

  describe('Requirement 3.2: Backward compatibility with isPrimary', () => {
    it('should apply animate-pulse-glow-hover when isPrimary is true and pulseMode is not set', () => {
      const { container } = render(
        <ActionCard {...defaultProps} isPrimary={true} />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('animate-pulse-glow-hover');
    });

    it('should not apply animation when isPrimary is false and pulseMode is not set', () => {
      const { container } = render(
        <ActionCard {...defaultProps} isPrimary={false} />
      );

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('animate-pulse-glow');
      expect(button).not.toHaveClass('animate-pulse-glow-hover');
    });

    it('should prioritize pulseMode over isPrimary when both are set', () => {
      const { container } = render(
        <ActionCard {...defaultProps} isPrimary={true} pulseMode="auto" />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('animate-pulse-glow');
      expect(button).not.toHaveClass('animate-pulse-glow-hover');
    });

    it('should allow pulseMode="none" to override isPrimary={true}', () => {
      const { container } = render(
        <ActionCard {...defaultProps} isPrimary={true} pulseMode="none" />
      );

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('animate-pulse-glow');
      expect(button).not.toHaveClass('animate-pulse-glow-hover');
    });
  });

  describe('Requirement 3.3: Animation consistency', () => {
    it('should only apply one animation class at a time', () => {
      const { container: autoContainer } = render(
        <ActionCard {...defaultProps} pulseMode="auto" />
      );
      const autoButton = autoContainer.querySelector('button');
      
      // Auto mode should only have animate-pulse-glow
      expect(autoButton).toHaveClass('animate-pulse-glow');
      expect(autoButton).not.toHaveClass('animate-pulse-glow-hover');

      const { container: hoverContainer } = render(
        <ActionCard {...defaultProps} pulseMode="hover" />
      );
      const hoverButton = hoverContainer.querySelector('button');
      
      // Hover mode should only have animate-pulse-glow-hover
      expect(hoverButton).toHaveClass('animate-pulse-glow-hover');
      expect(hoverButton).not.toHaveClass('animate-pulse-glow');
    });

    it('should maintain other CSS classes when animation class is applied', () => {
      const { container } = render(
        <ActionCard {...defaultProps} pulseMode="auto" />
      );

      const button = container.querySelector('button');
      
      // Should have animation class
      expect(button).toHaveClass('animate-pulse-glow');
      
      // Should also have other essential classes
      expect(button).toHaveClass('rounded-2xl');
      expect(button).toHaveClass('bg-white');
      expect(button).toHaveClass('shadow-md');
    });

    it('should not affect disabled state when animation is applied', () => {
      const { container } = render(
        <ActionCard {...defaultProps} pulseMode="auto" disabled={true} />
      );

      const button = container.querySelector('button');
      
      // Should have animation class
      expect(button).toHaveClass('animate-pulse-glow');
      
      // Should also be disabled
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50');
      expect(button).toHaveClass('cursor-not-allowed');
    });
  });

  describe('Edge cases', () => {
    it('should handle all props together correctly', () => {
      const { container } = render(
        <ActionCard
          {...defaultProps}
          subtitle="Test subtitle"
          badge={5}
          progress={75}
          pulseMode="hover"
          disabled={false}
        />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('animate-pulse-glow-hover');
      expect(button).not.toBeDisabled();
    });

    it('should render without animation when no animation props are provided', () => {
      const { container } = render(
        <ActionCard {...defaultProps} />
      );

      const button = container.querySelector('button');
      expect(button).not.toHaveClass('animate-pulse-glow');
      expect(button).not.toHaveClass('animate-pulse-glow-hover');
    });
  });
});
