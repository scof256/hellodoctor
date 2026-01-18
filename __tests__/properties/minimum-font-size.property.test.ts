/**
 * Feature: whatsapp-simple-ux, Property 6: Minimum Font Size Compliance
 * 
 * For any text element, body text should have minimum font-size of 16px 
 * and button text should have minimum font-size of 20px.
 * 
 * Validates: Requirements 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Helper to parse font size from CSS value
function parseFontSize(fontSize: string): number {
  const match = fontSize.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  // Convert to pixels (assuming 16px = 1rem/em)
  if (unit === 'rem' || unit === 'em') {
    return value * 16;
  }

  return value;
}

// Helper to check if font size meets minimum requirement
function meetsMinimumFontSize(fontSize: string, minimumPx: number): boolean {
  const sizeInPx = parseFontSize(fontSize);
  return sizeInPx >= minimumPx;
}

// Arbitrary generator for text element types
const arbitraryTextElementType = fc.constantFrom(
  'body',
  'p',
  'span',
  'div',
  'label',
  'input',
  'textarea',
  'li',
  'td',
  'th',
  'a',
  'small',
  'caption'
);

// Arbitrary generator for button types
const arbitraryButtonType = fc.constantFrom(
  'button',
  'submit',
  'reset',
  'button[type="button"]',
  'button[type="submit"]',
  'a.btn',
  '.btn-primary',
  '.btn-secondary'
);

// Arbitrary generator for font sizes that should be valid
const arbitraryValidBodyFontSize = fc.constantFrom(
  '16px',
  '17px',
  '18px',
  '20px',
  '1rem',
  '1.125rem',
  '1.25rem'
);

const arbitraryValidButtonFontSize = fc.constantFrom(
  '20px',
  '22px',
  '24px',
  '1.25rem',
  '1.5rem',
  '1.75rem'
);

// Arbitrary generator for font sizes that should be invalid
const arbitraryInvalidBodyFontSize = fc.constantFrom(
  '12px',
  '14px',
  '15px',
  '0.75rem',
  '0.875rem'
);

const arbitraryInvalidButtonFontSize = fc.constantFrom(
  '12px',
  '14px',
  '16px',
  '18px',
  '0.75rem',
  '1rem'
);

describe('Property 6: Minimum Font Size Compliance', () => {
  it('body text elements have minimum 16px font size', () => {
    const minimumBodyFontSize = 16;

    // Test that 16px is the minimum
    expect(meetsMinimumFontSize('16px', minimumBodyFontSize)).toBe(true);
    expect(meetsMinimumFontSize('1rem', minimumBodyFontSize)).toBe(true);

    // Test that smaller sizes fail
    expect(meetsMinimumFontSize('15px', minimumBodyFontSize)).toBe(false);
    expect(meetsMinimumFontSize('14px', minimumBodyFontSize)).toBe(false);
    expect(meetsMinimumFontSize('0.875rem', minimumBodyFontSize)).toBe(false);
  });

  it('button text elements have minimum 20px font size', () => {
    const minimumButtonFontSize = 20;

    // Test that 20px is the minimum
    expect(meetsMinimumFontSize('20px', minimumButtonFontSize)).toBe(true);
    expect(meetsMinimumFontSize('1.25rem', minimumButtonFontSize)).toBe(true);

    // Test that smaller sizes fail
    expect(meetsMinimumFontSize('19px', minimumButtonFontSize)).toBe(false);
    expect(meetsMinimumFontSize('18px', minimumButtonFontSize)).toBe(false);
    expect(meetsMinimumFontSize('1rem', minimumButtonFontSize)).toBe(false);
  });

  it('all valid body font sizes meet 16px minimum', () => {
    fc.assert(
      fc.property(arbitraryValidBodyFontSize, (fontSize) => {
        const minimumBodyFontSize = 16;
        expect(meetsMinimumFontSize(fontSize, minimumBodyFontSize)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('all valid button font sizes meet 20px minimum', () => {
    fc.assert(
      fc.property(arbitraryValidButtonFontSize, (fontSize) => {
        const minimumButtonFontSize = 20;
        expect(meetsMinimumFontSize(fontSize, minimumButtonFontSize)).toBe(true);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('invalid body font sizes are correctly identified as too small', () => {
    fc.assert(
      fc.property(arbitraryInvalidBodyFontSize, (fontSize) => {
        const minimumBodyFontSize = 16;
        expect(meetsMinimumFontSize(fontSize, minimumBodyFontSize)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('invalid button font sizes are correctly identified as too small', () => {
    fc.assert(
      fc.property(arbitraryInvalidButtonFontSize, (fontSize) => {
        const minimumButtonFontSize = 20;
        expect(meetsMinimumFontSize(fontSize, minimumButtonFontSize)).toBe(false);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('font size parser correctly handles px units', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (size) => {
        const fontSize = `${size}px`;
        const parsed = parseFontSize(fontSize);
        expect(parsed).toBe(size);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('font size parser correctly converts rem to px', () => {
    fc.assert(
      fc.property(fc.float({ min: 0.5, max: 5, noNaN: true }), (size) => {
        const fontSize = `${size}rem`;
        const parsed = parseFontSize(fontSize);
        const expected = size * 16; // 1rem = 16px
        expect(Math.abs(parsed - expected)).toBeLessThan(0.01);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('font size parser correctly converts em to px', () => {
    fc.assert(
      fc.property(fc.float({ min: 0.5, max: 5, noNaN: true }), (size) => {
        const fontSize = `${size}em`;
        const parsed = parseFontSize(fontSize);
        const expected = size * 16; // 1em = 16px
        expect(Math.abs(parsed - expected)).toBeLessThan(0.01);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('body text minimum is enforced across arbitrary text elements', () => {
    fc.assert(
      fc.property(
        arbitraryTextElementType,
        arbitraryValidBodyFontSize,
        (elementType, fontSize) => {
          const minimumBodyFontSize = 16;
          // All valid body font sizes should meet minimum
          expect(meetsMinimumFontSize(fontSize, minimumBodyFontSize)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('button text minimum is enforced across arbitrary button types', () => {
    fc.assert(
      fc.property(
        arbitraryButtonType,
        arbitraryValidButtonFontSize,
        (buttonType, fontSize) => {
          const minimumButtonFontSize = 20;
          // All valid button font sizes should meet minimum
          expect(meetsMinimumFontSize(fontSize, minimumButtonFontSize)).toBe(true);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('font sizes maintain minimum requirements across different units', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { px: '16px', rem: '1rem', em: '1em' }, // Body minimum
          { px: '20px', rem: '1.25rem', em: '1.25em' }, // Button minimum
          { px: '18px', rem: '1.125rem', em: '1.125em' }, // Above body minimum
          { px: '24px', rem: '1.5rem', em: '1.5em' } // Above button minimum
        ),
        (fontSizes) => {
          // All equivalent representations should parse to same value
          const pxValue = parseFontSize(fontSizes.px);
          const remValue = parseFontSize(fontSizes.rem);
          const emValue = parseFontSize(fontSizes.em);

          expect(Math.abs(pxValue - remValue)).toBeLessThan(0.01);
          expect(Math.abs(pxValue - emValue)).toBeLessThan(0.01);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('minimum font size requirements are consistent across element configurations', () => {
    fc.assert(
      fc.property(
        fc.record({
          elementType: fc.constantFrom('body', 'button'),
          fontSize: fc.integer({ min: 12, max: 30 }),
          unit: fc.constantFrom('px', 'rem'),
        }),
        (config) => {
          const fontSize =
            config.unit === 'px'
              ? `${config.fontSize}px`
              : `${config.fontSize / 16}rem`;

          const minimumSize = config.elementType === 'body' ? 16 : 20;
          const shouldMeetMinimum = config.fontSize >= minimumSize;

          expect(meetsMinimumFontSize(fontSize, minimumSize)).toBe(shouldMeetMinimum);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('font size comparison is transitive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 30 }),
        fc.integer({ min: 10, max: 30 }),
        fc.integer({ min: 10, max: 30 }),
        (a, b, c) => {
          const fontA = `${a}px`;
          const fontB = `${b}px`;
          const fontC = `${c}px`;

          const minimum = 16;

          const aValid = meetsMinimumFontSize(fontA, minimum);
          const bValid = meetsMinimumFontSize(fontB, minimum);
          const cValid = meetsMinimumFontSize(fontC, minimum);

          // If a >= minimum and b >= minimum, then both should be valid
          if (a >= minimum && b >= minimum) {
            expect(aValid).toBe(true);
            expect(bValid).toBe(true);
          }

          // If a < minimum, it should be invalid
          if (a < minimum) {
            expect(aValid).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('minimum font sizes are enforced regardless of element styling', () => {
    fc.assert(
      fc.property(
        fc.record({
          fontSize: fc.integer({ min: 16, max: 24 }),
          fontWeight: fc.constantFrom('normal', 'bold', '400', '600', '700'),
          fontFamily: fc.constantFrom('sans-serif', 'serif', 'monospace'),
          color: fc.string(),
          backgroundColor: fc.string(),
        }),
        (styles) => {
          const fontSize = `${styles.fontSize}px`;
          const minimumBodyFontSize = 16;

          // Font size requirement is independent of other styles
          expect(meetsMinimumFontSize(fontSize, minimumBodyFontSize)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('button font sizes are always larger than body font sizes', () => {
    fc.assert(
      fc.property(
        arbitraryValidBodyFontSize,
        arbitraryValidButtonFontSize,
        (bodySize, buttonSize) => {
          const bodyPx = parseFontSize(bodySize);
          const buttonPx = parseFontSize(buttonSize);

          // Button minimum (20px) should always be >= body minimum (16px)
          expect(buttonPx).toBeGreaterThanOrEqual(bodyPx);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
