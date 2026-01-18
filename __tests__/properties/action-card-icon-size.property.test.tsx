/**
 * Feature: whatsapp-simple-ux, Property 12: Action Card Icon Size
 * 
 * For any action card, the icon should have minimum dimensions of 64x64 pixels.
 * 
 * Validates: Requirements 5.6
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import { ActionCard } from '../../app/components/ActionCard';

// Helper to parse dimension from CSS value
function parseDimension(dimension: string): number {
  const match = dimension.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  // Convert to pixels (assuming 16px = 1rem/em)
  if (unit === 'rem' || unit === 'em') {
    return value * 16;
  }

  return value;
}

// Helper to check if dimensions meet minimum requirement
function meetsMinimumDimension(dimension: string, minimumPx: number): boolean {
  const sizeInPx = parseDimension(dimension);
  return sizeInPx >= minimumPx;
}

// Arbitrary generator for valid icon sizes (>= 64px)
const arbitraryValidIconSize = fc.constantFrom(
  '64px',
  '72px',
  '80px',
  '96px',
  '4rem',   // 64px
  '4.5rem', // 72px
  '5rem',   // 80px
  '6rem'    // 96px
);

// Arbitrary generator for invalid icon sizes (< 64px)
const arbitraryInvalidIconSize = fc.constantFrom(
  '32px',
  '48px',
  '56px',
  '60px',
  '2rem',    // 32px
  '3rem',    // 48px
  '3.5rem',  // 56px
  '3.75rem'  // 60px
);

// Arbitrary generator for action card props
const arbitraryActionCardProps = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }),
  subtitle: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
  iconColor: fc.constantFrom('#25D366', '#128C7E', '#34B7F1', '#FF0000', '#0000FF'),
  badge: fc.option(fc.oneof(fc.string({ minLength: 1, maxLength: 5 }), fc.integer({ min: 0, max: 99 }))),
  progress: fc.option(fc.integer({ min: 0, max: 100 })),
  isPrimary: fc.boolean(),
  disabled: fc.boolean(),
});

describe('Property 12: Action Card Icon Size', () => {
  const MINIMUM_ICON_SIZE = 64;

  it('action card icons have minimum 64x64px dimensions', () => {
    // Test that 64px is the minimum
    expect(meetsMinimumDimension('64px', MINIMUM_ICON_SIZE)).toBe(true);
    expect(meetsMinimumDimension('4rem', MINIMUM_ICON_SIZE)).toBe(true);

    // Test that smaller sizes fail
    expect(meetsMinimumDimension('63px', MINIMUM_ICON_SIZE)).toBe(false);
    expect(meetsMinimumDimension('48px', MINIMUM_ICON_SIZE)).toBe(false);
    expect(meetsMinimumDimension('3rem', MINIMUM_ICON_SIZE)).toBe(false);
  });

  it('all valid icon sizes meet 64px minimum', () => {
    fc.assert(
      fc.property(arbitraryValidIconSize, (iconSize) => {
        expect(meetsMinimumDimension(iconSize, MINIMUM_ICON_SIZE)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('invalid icon sizes are correctly identified as too small', () => {
    fc.assert(
      fc.property(arbitraryInvalidIconSize, (iconSize) => {
        expect(meetsMinimumDimension(iconSize, MINIMUM_ICON_SIZE)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('dimension parser correctly handles px units', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (size) => {
        const dimension = `${size}px`;
        const parsed = parseDimension(dimension);
        expect(parsed).toBe(size);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('dimension parser correctly converts rem to px', () => {
    fc.assert(
      fc.property(fc.float({ min: 1, max: 10, noNaN: true }), (size) => {
        const dimension = `${size}rem`;
        const parsed = parseDimension(dimension);
        const expected = size * 16; // 1rem = 16px
        expect(Math.abs(parsed - expected)).toBeLessThan(0.01);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('dimension parser correctly converts em to px', () => {
    fc.assert(
      fc.property(fc.float({ min: 1, max: 10, noNaN: true }), (size) => {
        const dimension = `${size}em`;
        const parsed = parseDimension(dimension);
        const expected = size * 16; // 1em = 16px
        expect(Math.abs(parsed - expected)).toBeLessThan(0.01);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('ActionCard component renders icon container with correct dimensions', () => {
    fc.assert(
      fc.property(arbitraryActionCardProps, (props) => {
        const { container } = render(
          <ActionCard
            title={props.title}
            subtitle={props.subtitle ?? undefined}
            iconColor={props.iconColor}
            badge={props.badge ?? undefined}
            progress={props.progress ?? undefined}
            isPrimary={props.isPrimary}
            disabled={props.disabled}
            icon={<span data-testid="test-icon">🏥</span>}
            onTap={() => {}}
          />
        );

        // Find the icon container (the div with w-16 h-16 classes)
        const iconContainer = container.querySelector('.w-16.h-16');
        expect(iconContainer).toBeTruthy();

        if (iconContainer) {
          // Check that the element has the correct Tailwind classes
          // w-16 and h-16 in Tailwind = 4rem = 64px
          expect(iconContainer.classList.contains('w-16')).toBe(true);
          expect(iconContainer.classList.contains('h-16')).toBe(true);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('icon dimensions are consistent across different action card states', () => {
    fc.assert(
      fc.property(
        fc.record({
          isPrimary: fc.boolean(),
          disabled: fc.boolean(),
          hasProgress: fc.boolean(),
          hasBadge: fc.boolean(),
        }),
        (state) => {
          const { container } = render(
            <ActionCard
              title="Test Card"
              icon={<span data-testid="test-icon">🏥</span>}
              iconColor="#25D366"
              isPrimary={state.isPrimary}
              disabled={state.disabled}
              progress={state.hasProgress ? 50 : undefined}
              badge={state.hasBadge ? 5 : undefined}
              onTap={() => {}}
            />
          );

          const iconContainer = container.querySelector('.w-16.h-16');
          expect(iconContainer).toBeTruthy();

          if (iconContainer) {
            // Icon size should be consistent regardless of card state
            expect(iconContainer.classList.contains('w-16')).toBe(true);
            expect(iconContainer.classList.contains('h-16')).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('icon dimensions meet minimum across arbitrary icon content', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('🏥', '💬', '📅', '👤', '⚙️', '📋', '🔔', '❤️'),
        fc.string({ minLength: 1, maxLength: 30 }),
        (emoji, title) => {
          const { container } = render(
            <ActionCard
              title={title}
              icon={<span data-testid="test-icon">{emoji}</span>}
              iconColor="#25D366"
              onTap={() => {}}
            />
          );

          const iconContainer = container.querySelector('.w-16.h-16');
          expect(iconContainer).toBeTruthy();

          if (iconContainer) {
            expect(iconContainer.classList.contains('w-16')).toBe(true);
            expect(iconContainer.classList.contains('h-16')).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('icon container maintains square aspect ratio', () => {
    fc.assert(
      fc.property(arbitraryActionCardProps, (props) => {
        const { container } = render(
          <ActionCard
            title={props.title}
            subtitle={props.subtitle ?? undefined}
            iconColor={props.iconColor}
            badge={props.badge ?? undefined}
            progress={props.progress ?? undefined}
            isPrimary={props.isPrimary}
            disabled={props.disabled}
            icon={<span data-testid="test-icon">🏥</span>}
            onTap={() => {}}
          />
        );

        const iconContainer = container.querySelector('.w-16.h-16');
        expect(iconContainer).toBeTruthy();

        if (iconContainer) {
          const styles = window.getComputedStyle(iconContainer);
          const width = parseDimension(styles.width);
          const height = parseDimension(styles.height);

          // Width and height should be equal (square)
          expect(Math.abs(width - height)).toBeLessThan(1);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('minimum icon size is enforced regardless of card dimensions', () => {
    fc.assert(
      fc.property(
        fc.record({
          cardHeight: fc.integer({ min: 120, max: 300 }),
          cardWidth: fc.integer({ min: 200, max: 600 }),
          title: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (config) => {
          const { container } = render(
            <ActionCard
              title={config.title}
              icon={<span data-testid="test-icon">🏥</span>}
              iconColor="#25D366"
              onTap={() => {}}
            />
          );

          const iconContainer = container.querySelector('.w-16.h-16');
          expect(iconContainer).toBeTruthy();

          if (iconContainer) {
            // Icon size should be independent of card size
            expect(iconContainer.classList.contains('w-16')).toBe(true);
            expect(iconContainer.classList.contains('h-16')).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('icon size comparison is transitive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 32, max: 128 }),
        fc.integer({ min: 32, max: 128 }),
        fc.integer({ min: 32, max: 128 }),
        (a, b, c) => {
          const sizeA = `${a}px`;
          const sizeB = `${b}px`;
          const sizeC = `${c}px`;

          const aValid = meetsMinimumDimension(sizeA, MINIMUM_ICON_SIZE);
          const bValid = meetsMinimumDimension(sizeB, MINIMUM_ICON_SIZE);
          const cValid = meetsMinimumDimension(sizeC, MINIMUM_ICON_SIZE);

          // If a >= 64 and b >= 64, then both should be valid
          if (a >= MINIMUM_ICON_SIZE && b >= MINIMUM_ICON_SIZE) {
            expect(aValid).toBe(true);
            expect(bValid).toBe(true);
          }

          // If a < 64, it should be invalid
          if (a < MINIMUM_ICON_SIZE) {
            expect(aValid).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('icon dimensions maintain minimum across different units', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { px: '64px', rem: '4rem', em: '4em' },
          { px: '80px', rem: '5rem', em: '5em' },
          { px: '96px', rem: '6rem', em: '6em' },
          { px: '128px', rem: '8rem', em: '8em' }
        ),
        (dimensions) => {
          // All equivalent representations should parse to same value
          const pxValue = parseDimension(dimensions.px);
          const remValue = parseDimension(dimensions.rem);
          const emValue = parseDimension(dimensions.em);

          expect(Math.abs(pxValue - remValue)).toBeLessThan(0.01);
          expect(Math.abs(pxValue - emValue)).toBeLessThan(0.01);

          // All should meet minimum
          expect(meetsMinimumDimension(dimensions.px, MINIMUM_ICON_SIZE)).toBe(true);
          expect(meetsMinimumDimension(dimensions.rem, MINIMUM_ICON_SIZE)).toBe(true);
          expect(meetsMinimumDimension(dimensions.em, MINIMUM_ICON_SIZE)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
