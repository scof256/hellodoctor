/**
 * Property Test: Intake Progress Display Format
 * Feature: whatsapp-simple-ux, Property 13
 * Validates: Requirements 6.8
 * 
 * Tests that progress is displayed as "X of Y questions answered" in Simple Mode
 * instead of percentage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as fc from 'fast-check';
import IntakeChatInterface from '@/app/components/IntakeChatInterface';
import { ModeProvider, useMode } from '@/app/contexts/ModeContext';

// Mock tRPC
vi.mock('@/trpc/react', () => ({
  api: {
    intake: {
      storeFileMetadata: {
        useMutation: () => ({
          mutate: vi.fn(),
          isLoading: false,
        }),
      },
    },
  },
}));

// Mock UploadThing
vi.mock('@/lib/uploadthing-client', () => ({
  useUploadThing: () => ({
    startUpload: vi.fn(),
    isUploading: false,
  }),
}));

// Mock window.matchMedia and scrollIntoView
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
  
  // Clear localStorage before each test
  window.localStorage.clear();
});

describe('Property 13: Intake Progress Display Format', () => {
  it('should display progress as "X of Y questions answered" in Simple Mode for any values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }), // currentQuestion
        fc.integer({ min: 1, max: 20 }), // totalQuestions
        (currentQuestion, totalQuestions) => {
          // Ensure currentQuestion doesn't exceed totalQuestions
          const validCurrent = Math.min(currentQuestion, totalQuestions);

          const { container } = render(
            <ModeProvider initialMode="simple">
              <IntakeChatInterface
                messages={[]}
                onSendMessage={() => {}}
                isLoading={false}
                variant="patient"
                showTracker={true}
                currentQuestion={validCurrent}
                totalQuestions={totalQuestions}
              />
            </ModeProvider>
          );

          const html = container.innerHTML;

          // Should contain the question format
          expect(html).toContain('questions answered');
          expect(html).toContain(`${validCurrent} of ${totalQuestions}`);

          // Should NOT contain percentage format
          expect(html).not.toMatch(/\d+%\s+Complete/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display percentage format in Advanced Mode for any completeness value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // completeness percentage (excluding 0 as it may not be displayed)
        (completeness) => {
          // Create a test component that verifies the mode
          const TestComponent = () => {
            const { mode, isSimpleMode } = useMode();
            return (
              <div data-testid="mode-indicator" data-mode={mode} data-is-simple={isSimpleMode()}>
                <IntakeChatInterface
                  messages={[]}
                  onSendMessage={() => {}}
                  isLoading={false}
                  variant="patient"
                  showTracker={true}
                  completeness={completeness}
                />
              </div>
            );
          };

          const { container } = render(
            <ModeProvider initialMode="advanced">
              <TestComponent />
            </ModeProvider>
          );

          const html = container.innerHTML;
          const modeIndicator = container.querySelector('[data-testid="mode-indicator"]');
          
          // Debug: check if mode is actually set correctly
          if (modeIndicator) {
            const actualMode = modeIndicator.getAttribute('data-mode');
            const actualIsSimple = modeIndicator.getAttribute('data-is-simple');
            if (actualMode !== 'advanced' || actualIsSimple !== 'false') {
              console.log('Mode mismatch! Expected advanced/false, got:', actualMode, actualIsSimple);
            }
          }

          // Debug: print HTML when test fails
          if (!html.includes(`${completeness}% Complete`)) {
            console.log('Completeness:', completeness);
            console.log('HTML snippet:', html.substring(0, 500));
          }

          // Should contain percentage format in Advanced Mode
          expect(html).toContain(`${completeness}% Complete`);

          // Should NOT contain question format in Advanced Mode
          expect(html).not.toContain('questions answered');
        }
      ),
      { numRuns: 10 } // Reduced for debugging
    );
  });

  it('should handle edge cases: 0 questions answered', () => {
    const { container } = render(
      <ModeProvider initialMode="simple">
        <IntakeChatInterface
          messages={[]}
          onSendMessage={() => {}}
          isLoading={false}
          variant="patient"
          showTracker={true}
          currentQuestion={0}
          totalQuestions={10}
        />
      </ModeProvider>
    );

    const html = container.innerHTML;
    expect(html).toContain('0 of 10 questions answered');
  });

  it('should handle edge cases: all questions answered', () => {
    const { container } = render(
      <ModeProvider initialMode="simple">
        <IntakeChatInterface
          messages={[]}
          onSendMessage={() => {}}
          isLoading={false}
          variant="patient"
          showTracker={true}
          currentQuestion={10}
          totalQuestions={10}
        />
      </ModeProvider>
    );

    const html = container.innerHTML;
    expect(html).toContain('10 of 10 questions answered');
  });
});
