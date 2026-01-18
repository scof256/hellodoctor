'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  illustration: string; // Image URL or emoji
  highlightElement?: string; // CSS selector
}

export interface TutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
  showOnFirstVisit?: boolean;
  isOpen?: boolean;
}

export function Tutorial({
  steps,
  onComplete,
  onSkip,
  isOpen = true,
}: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]?.clientX ?? null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]?.clientX ?? null);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
    if (isRightSwipe && currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  if (!isOpen || !currentStepData) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 p-2 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Skip tutorial"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <div className="px-8 py-12 text-center">
          {/* Illustration */}
          <div className="mb-8 flex items-center justify-center">
            {currentStepData.illustration.startsWith('http') ? (
              <img
                src={currentStepData.illustration}
                alt={currentStepData.title}
                className="w-[300px] h-[300px] object-contain"
              />
            ) : (
              <div className="text-[120px] leading-none">
                {currentStepData.illustration}
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {currentStepData.title}
          </h2>

          {/* Description */}
          <p className="text-base text-gray-600 leading-relaxed max-w-sm mx-auto">
            {currentStepData.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'bg-[#25D366] w-6'
                  : index < currentStep
                  ? 'bg-[#25D366]/50'
                  : 'bg-gray-300'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8">
          <button
            onClick={handleNext}
            className="w-full bg-[#25D366] text-white text-xl font-semibold py-4 rounded-xl hover:bg-[#20BA5A] transition-colors shadow-lg"
          >
            {isLastStep ? "Got it! 🎉" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
