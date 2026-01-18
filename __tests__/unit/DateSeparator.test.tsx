import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { DateSeparator } from '@/app/components/DateSeparator';
import * as dateUtils from '@/app/lib/date-utils';

describe('DateSeparator Component', () => {
  it('should render with correct structure', () => {
    const testDate = new Date('2026-01-15T12:00:00Z');
    const { container } = render(<DateSeparator date={testDate} />);
    
    // Check that the main container exists with correct classes
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toBeInTheDocument();
    expect(mainDiv).toHaveClass('flex', 'items-center', 'gap-3', 'my-4');
    
    // Check that there are two divider lines
    const dividers = container.querySelectorAll('.h-px.bg-slate-200');
    expect(dividers).toHaveLength(2);
    
    // Check that the text span exists with correct classes
    const textSpan = container.querySelector('span');
    expect(textSpan).toBeInTheDocument();
    expect(textSpan).toHaveClass('text-xs', 'font-semibold', 'text-slate-500', 'uppercase', 'tracking-wider', 'px-2');
  });

  it('should call formatDateLabel with correct date', () => {
    const testDate = new Date('2026-01-15T12:00:00Z');
    const formatSpy = vi.spyOn(dateUtils, 'formatDateLabel');
    
    render(<DateSeparator date={testDate} />);
    
    expect(formatSpy).toHaveBeenCalledWith(testDate);
    
    formatSpy.mockRestore();
  });

  it('should display the formatted date label', () => {
    const testDate = new Date('2026-01-15T12:00:00Z');
    
    render(<DateSeparator date={testDate} />);
    
    // The formatDateLabel function should format this date
    // Since we're not mocking it, we expect the actual formatted output
    // The date will be "January 15" since it's in the current year (2026)
    const textSpan = screen.getByText(/January 15/);
    expect(textSpan).toBeInTheDocument();
  });

  it('should apply custom className prop', () => {
    const testDate = new Date('2026-01-15T12:00:00Z');
    const customClass = 'custom-separator-class';
    const { container } = render(<DateSeparator date={testDate} className={customClass} />);
    
    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass(customClass);
  });

  it('should apply default empty className when not provided', () => {
    const testDate = new Date('2026-01-15T12:00:00Z');
    const { container } = render(<DateSeparator date={testDate} />);
    
    const mainDiv = container.firstChild as HTMLElement;
    // Should have the base classes but no additional custom class
    expect(mainDiv).toHaveClass('flex', 'items-center', 'gap-3', 'my-4');
  });
});
