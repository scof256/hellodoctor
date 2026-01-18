'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { canAccessStep } from '@/app/lib/auto-navigation';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

export interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (stepIndex: number) => void;
  variant?: 'dots' | 'numbered' | 'bar';
  showLabels?: boolean;
}

/**
 * ProgressStepper component that displays multi-step progress
 * and prevents access to incomplete steps.
 * 
 * Requirements: 3.5, 3.6
 * Property: 8 - Sequential Flow Step Prevention
 * Property: 9 - Progress Indicator Accuracy
 */
export function ProgressStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  variant = 'dots',
  showLabels = true,
}: ProgressStepperProps) {
  const handleStepClick = (stepIndex: number) => {
    // Prevent access to steps that haven't been unlocked yet
    if (!canAccessStep(stepIndex, completedSteps)) {
      return;
    }
    
    onStepClick?.(stepIndex);
  };

  if (variant === 'bar') {
    return <ProgressBar steps={steps} currentStep={currentStep} completedSteps={completedSteps} />;
  }

  if (variant === 'numbered') {
    return (
      <NumberedSteps
        steps={steps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
        showLabels={showLabels}
      />
    );
  }

  return (
    <DotSteps
      steps={steps}
      currentStep={currentStep}
      completedSteps={completedSteps}
      onStepClick={handleStepClick}
      showLabels={showLabels}
    />
  );
}

// Dot variant
function DotSteps({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  showLabels,
}: Omit<ProgressStepperProps, 'variant'>) {
  return (
    <div className="flex flex-col items-center gap-4">
      {showLabels && (
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">
            Step {currentStep + 1} of {steps.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {steps[currentStep]?.label}
          </p>
        </div>
      )}
      
      <div className="flex items-center gap-2">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;
          const isAccessible = canAccessStep(index, completedSteps);
          const isClickable = isAccessible && onStepClick;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isAccessible}
                className={`
                  w-3 h-3 rounded-full transition-all duration-200
                  ${isCompleted ? 'bg-green-500 scale-100' : ''}
                  ${isCurrent ? 'bg-green-500 scale-125 ring-4 ring-green-100' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-slate-300 scale-100' : ''}
                  ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  ${!isAccessible ? 'opacity-50' : ''}
                `}
                aria-label={`${step.label}${isCompleted ? ' (completed)' : ''}${isCurrent ? ' (current)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={!isAccessible}
              />
              {index < steps.length - 1 && (
                <div className="w-8 h-0.5 bg-slate-200" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Numbered variant
function NumberedSteps({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  showLabels,
}: Omit<ProgressStepperProps, 'variant'>) {
  return (
    <div className="w-full">
      {showLabels && (
        <div className="text-center mb-3">
          <p className="text-sm font-medium text-slate-700">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = index === currentStep;
          const isAccessible = canAccessStep(index, completedSteps);
          const isClickable = isAccessible && onStepClick;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isAccessible}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                    transition-all duration-200
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-green-500 text-white ring-4 ring-green-100' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-slate-200 text-slate-500' : ''}
                    ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}
                    ${!isAccessible ? 'opacity-50' : ''}
                  `}
                  aria-label={`${step.label}${isCompleted ? ' (completed)' : ''}${isCurrent ? ' (current)' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-disabled={!isAccessible}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : index + 1}
                </button>
                {showLabels && (
                  <div className="mt-2 text-center">
                    <p className={`text-xs font-medium ${isCurrent ? 'text-green-600' : 'text-slate-600'}`}>
                      {step.label}
                    </p>
                    {step.description && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {step.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {index < steps.length - 1 && (
                <div className={`
                  flex-1 h-0.5 mx-2 transition-colors duration-200
                  ${isCompleted ? 'bg-green-500' : 'bg-slate-200'}
                `} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// Bar variant
function ProgressBar({
  steps,
  currentStep,
  completedSteps,
}: Pick<ProgressStepperProps, 'steps' | 'currentStep' | 'completedSteps'>) {
  // Calculate progress based on completed steps
  // Progress = (number of completed steps / total steps) * 100
  // If current step is not yet completed, we're still working on it
  const progress = (completedSteps.length / steps.length) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-medium text-slate-700">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-slate-500">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2 text-center">
        {steps[currentStep]?.label}
      </p>
    </div>
  );
}

/**
 * Hook to manage step progression with sequential flow prevention
 */
export function useStepProgression(totalSteps: number) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);

  const goToStep = React.useCallback((stepIndex: number) => {
    if (canAccessStep(stepIndex, completedSteps)) {
      setCurrentStep(stepIndex);
    }
  }, [completedSteps]);

  const completeCurrentStep = React.useCallback(() => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    
    // Auto-advance to next step if not at the end
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, completedSteps, totalSteps]);

  const goToNextStep = React.useCallback(() => {
    if (currentStep < totalSteps - 1 && canAccessStep(currentStep + 1, completedSteps)) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, totalSteps, completedSteps]);

  const goToPreviousStep = React.useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const reset = React.useCallback(() => {
    setCurrentStep(0);
    setCompletedSteps([]);
  }, []);

  return {
    currentStep,
    completedSteps,
    goToStep,
    completeCurrentStep,
    goToNextStep,
    goToPreviousStep,
    reset,
    canGoToNext: currentStep < totalSteps - 1 && canAccessStep(currentStep + 1, completedSteps),
    canGoToPrevious: currentStep > 0,
    isComplete: completedSteps.length === totalSteps,
  };
}
