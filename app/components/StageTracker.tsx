'use client';

import { ArrowLeft, CheckCircle2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

const STAGES = [
  { id: 'triage', label: 'Basics' },
  { id: 'investigation', label: 'Symptoms' },
  { id: 'records', label: 'Records' },
  { id: 'profile', label: 'History' },
  { id: 'summary', label: 'Review' },
];

interface StageTrackerProps {
  currentStage: string;
  completeness: number;
  onResetClick: () => void;
  backPath?: string;
  variant?: 'patient' | 'doctor';
}

/**
 * Sticky stage tracker component showing intake progress
 * Requirements: 1.3 - Stage tracker fixed at top of chat area
 */
export function StageTracker({ 
  currentStage,
  completeness, 
  onResetClick, 
  backPath = '/patient',
  variant = 'patient'
}: StageTrackerProps) {
  const router = useRouter();

  // Get current stage index based on currentStage prop
  const getCurrentStageIndex = () => {
    const index = STAGES.findIndex(stage => stage.id === currentStage);
    return index >= 0 ? index : 0;
  };
  
  const currentStageIndex = getCurrentStageIndex();
  const isDoctor = variant === 'doctor';

  return (
    <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 shadow-sm z-20">
      <div className="max-w-4xl mx-auto">
        {/* Mobile: Simple progress bar */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => router.push(backPath)}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-medical-600">{completeness}%</span>
              {!isDoctor && (
                <button
                  onClick={onResetClick}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
                  title="Reset conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div 
              className="bg-medical-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1 text-center">
            {STAGES[currentStageIndex]?.label}
          </p>
        </div>

        {/* Desktop: Stage indicators */}
        <div className="hidden md:flex items-center justify-between">
          <button
            onClick={() => router.push(backPath)}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex-1 flex items-center justify-center gap-1">
            {STAGES.map((stage, index) => {
              const isActive = index === currentStageIndex;
              const isCompleted = index < currentStageIndex;
              
              return (
                <div key={stage.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${isCompleted ? 'bg-medical-500 text-white' : 
                        isActive ? 'bg-medical-100 text-medical-700 ring-2 ring-medical-500' : 
                        'bg-slate-100 text-slate-400'}
                    `}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                    </div>
                    <span className={`text-[10px] mt-0.5 ${isActive ? 'text-medical-700 font-semibold' : 'text-slate-400'}`}>
                      {stage.label}
                    </span>
                  </div>
                  {index < STAGES.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-medical-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm font-bold text-medical-600">{completeness}%</span>
            {!isDoctor && (
              <button
                onClick={onResetClick}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"
                title="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { STAGES };
