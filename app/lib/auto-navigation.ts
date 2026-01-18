/**
 * Auto-Navigation Utilities
 * 
 * Provides utilities for automatically navigating to the next logical step
 * after completing an action.
 * 
 * Requirements: 3.2
 */

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Navigation flow definitions for different user actions
 */
export const NAVIGATION_FLOWS = {
  // Patient flows
  patient: {
    // After connecting to a doctor
    afterConnection: (connectionId: string) => `/patient/intake/${connectionId}`,
    
    // After completing intake
    afterIntakeComplete: (connectionId: string) => `/patient`,
    
    // After booking appointment
    afterBooking: (appointmentId: string) => `/patient/appointments`,
    
    // After sending message
    afterMessage: (connectionId: string) => `/patient/messages?connection=${connectionId}`,
    
    // After creating new session
    afterSessionCreate: (connectionId: string, sessionId: string) => 
      `/patient/intake/${connectionId}?sessionId=${sessionId}`,
  },
  
  // Doctor flows
  doctor: {
    // After viewing patient intake
    afterIntakeView: (connectionId: string) => `/doctor/patients/${connectionId}`,
    
    // After booking appointment for patient
    afterBooking: (appointmentId: string) => `/doctor/appointments`,
    
    // After sending message
    afterMessage: (connectionId: string) => `/doctor/messages?connection=${connectionId}`,
  },
} as const;

/**
 * Auto-navigate after completing an action
 * 
 * @param router - Next.js router instance
 * @param action - The action that was completed
 * @param params - Parameters for the navigation (e.g., connectionId, appointmentId)
 * @param delay - Optional delay in milliseconds before navigating (default: 0)
 */
export function autoNavigate(
  router: AppRouterInstance,
  action: keyof typeof NAVIGATION_FLOWS.patient | keyof typeof NAVIGATION_FLOWS.doctor,
  params: Record<string, string>,
  options?: {
    delay?: number;
    userRole?: 'patient' | 'doctor';
    replace?: boolean;
  }
): void {
  const { delay = 0, userRole = 'patient', replace = false } = options ?? {};
  
  const flows = userRole === 'patient' ? NAVIGATION_FLOWS.patient : NAVIGATION_FLOWS.doctor;
  const getPath = flows[action as keyof typeof flows];
  
  if (!getPath) {
    console.warn(`No navigation flow defined for action: ${action}`);
    return;
  }
  
  // Get the path based on the action
  let path: string;
  try {
    // Call the function with the appropriate parameters
    if (action === 'afterConnection' || action === 'afterIntakeComplete' || 
        action === 'afterMessage' || action === 'afterIntakeView') {
      path = (getPath as (id: string) => string)(params.connectionId ?? '');
    } else if (action === 'afterBooking') {
      path = (getPath as (id: string) => string)(params.appointmentId ?? '');
    } else if (action === 'afterSessionCreate') {
      path = (getPath as (cId: string, sId: string) => string)(
        params.connectionId ?? '',
        params.sessionId ?? ''
      );
    } else {
      console.warn(`Unknown action: ${action}`);
      return;
    }
  } catch (error) {
    console.error(`Error getting path for action ${action}:`, error);
    return;
  }
  
  // Navigate after delay
  if (delay > 0) {
    setTimeout(() => {
      if (replace) {
        router.replace(path);
      } else {
        router.push(path);
      }
    }, delay);
  } else {
    if (replace) {
      router.replace(path);
    } else {
      router.push(path);
    }
  }
}

/**
 * Hook-friendly version of autoNavigate that can be used in React components
 * 
 * @example
 * ```tsx
 * const navigate = useAutoNavigate();
 * 
 * const handleComplete = () => {
 *   // ... complete action
 *   navigate('afterConnection', { connectionId: '123' });
 * };
 * ```
 */
export function createAutoNavigate(router: AppRouterInstance, userRole: 'patient' | 'doctor' = 'patient') {
  return (
    action: keyof typeof NAVIGATION_FLOWS.patient | keyof typeof NAVIGATION_FLOWS.doctor,
    params: Record<string, string>,
    options?: { delay?: number; replace?: boolean }
  ) => {
    autoNavigate(router, action, params, { ...options, userRole });
  };
}

/**
 * Get the next step in a multi-step flow
 * 
 * @param currentStep - The current step number (0-indexed)
 * @param totalSteps - Total number of steps in the flow
 * @returns The next step number, or null if at the end
 */
export function getNextStep(currentStep: number, totalSteps: number): number | null {
  if (currentStep >= totalSteps - 1) {
    return null; // Already at the last step
  }
  return currentStep + 1;
}

/**
 * Check if a step can be accessed based on completion of previous steps
 * 
 * @param targetStep - The step the user wants to access
 * @param completedSteps - Array of completed step numbers
 * @returns true if the step can be accessed, false otherwise
 */
export function canAccessStep(targetStep: number, completedSteps: number[]): boolean {
  // Can always access step 0
  if (targetStep === 0) {
    return true;
  }
  
  // Can access a step if the previous step is completed
  return completedSteps.includes(targetStep - 1);
}

/**
 * Get the first incomplete step in a flow
 * 
 * @param totalSteps - Total number of steps
 * @param completedSteps - Array of completed step numbers
 * @returns The first incomplete step number
 */
export function getFirstIncompleteStep(totalSteps: number, completedSteps: number[]): number {
  for (let i = 0; i < totalSteps; i++) {
    if (!completedSteps.includes(i)) {
      return i;
    }
  }
  return totalSteps - 1; // All steps complete, return last step
}
