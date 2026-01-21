'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';
import type { DoctorThought } from '@/types';

interface ClinicalReasoningProps {
  reasoning: DoctorThought | null;
  isGenerating?: boolean;
}

/**
 * ClinicalReasoning Component
 * 
 * Displays AI-generated clinical reasoning including:
 * - Symptom analysis narrative
 * - Differential diagnosis ranked by likelihood
 * - Red flags and missing information
 * - Clinical pearls and strategy
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5
 */
export const ClinicalReasoning: React.FC<ClinicalReasoningProps> = ({
  reasoning,
  isGenerating = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Loading state
  if (isGenerating) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-purple-50 p-3 flex items-center justify-between border-b border-purple-200">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-700" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-800">
              Clinical Reasoning
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
          <p className="text-sm text-slate-600">Generating clinical analysis...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!reasoning) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-purple-50 p-3 flex items-center justify-between border-b border-purple-200">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-700" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-800">
              Clinical Reasoning
            </h3>
          </div>
        </div>
        <div className="bg-white p-6">
          <p className="text-sm text-slate-500 text-center">
            No clinical reasoning available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header with collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-purple-50 p-3 flex items-center justify-between border-b border-purple-200 hover:bg-purple-100 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="clinical-reasoning-content"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-700" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-800">
            Clinical Reasoning
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-purple-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-700" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div id="clinical-reasoning-content" className="bg-white">
          {/* Strategy Section */}
          {reasoning.strategy && (
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
                Clinical Strategy
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {reasoning.strategy}
              </p>
            </div>
          )}

          {/* Differential Diagnosis Section */}
          {reasoning.differentialDiagnosis && reasoning.differentialDiagnosis.length > 0 && (
            <div className="p-4 border-b border-slate-100">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Differential Diagnosis
              </h4>
              <div className="space-y-3">
                {reasoning.differentialDiagnosis.map((diagnosis: { condition: string; probability: string; reasoning: string }, index: number) => (
                  <DiagnosisItem
                    key={index}
                    condition={diagnosis.condition}
                    probability={diagnosis.probability}
                    reasoning={diagnosis.reasoning}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Missing Information Section (Red Flags) */}
          {reasoning.missingInformation && reasoning.missingInformation.length > 0 && (
            <div className="p-4 border-b border-slate-100 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h4 className="text-xs font-semibold text-red-800 uppercase tracking-wide">
                  Missing Information
                </h4>
              </div>
              <ul className="space-y-1.5">
                {reasoning.missingInformation.map((item: string, index: number) => (
                  <li key={index} className="text-sm text-red-900 flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Move Section (Clinical Pearls) */}
          {reasoning.nextMove && (
            <div className="p-4 bg-emerald-50">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                  Recommended Next Steps
                </h4>
              </div>
              <p className="text-sm text-emerald-900 leading-relaxed">
                {reasoning.nextMove}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * DiagnosisItem Component
 * 
 * Displays a single differential diagnosis with likelihood indicator
 */
interface DiagnosisItemProps {
  condition: string;
  probability: string;
  reasoning: string;
}

const DiagnosisItem: React.FC<DiagnosisItemProps> = ({ condition, probability, reasoning }) => {
  // Determine likelihood level and styling
  const getLikelihoodStyle = (prob: string) => {
    const probLower = prob.toLowerCase();
    if (probLower.includes('high') || probLower.includes('likely') || probLower.includes('probable')) {
      return {
        badge: 'bg-red-100 text-red-800 border-red-200',
        bar: 'bg-red-500',
        width: 'w-3/4',
      };
    } else if (probLower.includes('medium') || probLower.includes('moderate') || probLower.includes('possible')) {
      return {
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        bar: 'bg-amber-500',
        width: 'w-1/2',
      };
    } else {
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        bar: 'bg-slate-400',
        width: 'w-1/4',
      };
    }
  };

  const style = getLikelihoodStyle(probability);

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h5 className="text-sm font-semibold text-slate-900">{condition}</h5>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${style.badge} whitespace-nowrap`}>
          {probability}
        </span>
      </div>
      
      {/* Likelihood bar */}
      <div className="w-full h-1.5 bg-slate-200 rounded-full mb-2 overflow-hidden">
        <div className={`h-full ${style.bar} ${style.width} transition-all duration-300`} />
      </div>
      
      <p className="text-xs text-slate-600 leading-relaxed">
        {reasoning}
      </p>
    </div>
  );
};
