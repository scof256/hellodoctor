/**
 * Button Interaction Feedback Utilities
 * 
 * Provides consistent button press animations and feedback across the application.
 * Ensures all button interactions provide visual feedback within 100ms.
 * 
 * Requirements: 15.6 - Button interaction feedback
 */

/**
 * Standard button press animation classes
 * Combines scale animation with optional ripple effect
 */
export const buttonFeedbackClasses = {
  // Scale animation on press (fastest feedback)
  scale: 'active:scale-[0.96] transition-transform duration-75',
  
  // Scale with shadow change
  scaleWithShadow: 'active:scale-[0.96] active:shadow-sm transition-all duration-75',
  
  // Ripple effect container
  ripple: 'relative overflow-hidden',
  
  // Combined scale + ripple
  full: 'relative overflow-hidden active:scale-[0.96] transition-transform duration-75',
} as const;

/**
 * Creates a ripple effect at the click position
 * @param event - The mouse or touch event
 * @param element - The button element
 */
export function createRipple(
  event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  element: HTMLElement
): void {
  const rect = element.getBoundingClientRect();
  
  // Get click position
  let x: number;
  let y: number;
  
  if ('touches' in event) {
    // Touch event
    x = event.touches[0]!.clientX - rect.left;
    y = event.touches[0]!.clientY - rect.top;
  } else {
    // Mouse event
    x = event.clientX - rect.left;
    y = event.clientY - rect.top;
  }
  
  // Create ripple element
  const ripple = document.createElement('span');
  ripple.className = 'button-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  
  // Add to button
  element.appendChild(ripple);
  
  // Remove after animation completes
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

/**
 * Hook for adding ripple effect to buttons
 * @returns Handler function to attach to button events
 */
export function useRipple() {
  return (event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    const element = event.currentTarget;
    createRipple(event, element);
  };
}

/**
 * Provides haptic feedback on supported devices
 */
export function triggerHapticFeedback(): void {
  // Check if vibration API is available
  if ('vibrate' in navigator) {
    // Short vibration (10ms) for button press
    navigator.vibrate(10);
  }
}

/**
 * Combined feedback handler for buttons
 * Triggers both visual and haptic feedback
 */
export function handleButtonPress(
  event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
  options: {
    ripple?: boolean;
    haptic?: boolean;
  } = {}
): void {
  const { ripple = true, haptic = false } = options;
  
  if (ripple) {
    createRipple(event, event.currentTarget);
  }
  
  if (haptic) {
    triggerHapticFeedback();
  }
}
