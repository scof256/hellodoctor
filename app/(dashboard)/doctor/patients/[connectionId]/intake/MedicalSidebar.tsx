'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertCircle, FileText, X, ChevronDown, ChevronUp, Maximize2, Minimize2, User, Activity, Thermometer, Weight, Heart } from 'lucide-react';
import { ClinicalReasoning } from './ClinicalReasoning';
import type { DoctorThought } from '@/types';
import type { VitalsData } from '@/app/types';

interface MedicalSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: 'intake-data' | 'handover';
  onTabChange: (tab: 'intake-data' | 'handover') => void;
  completeness: number;
  medicalData: {
    vitalsData?: VitalsData;
    chiefComplaint?: string | null;
    reviewOfSystems?: string[];
    medications?: string[];
    allergies?: string[];
    clinicalHandover?: {
      situation?: string;
      background?: string;
      assessment?: string;
      recommendation?: string;
    } | null;
    ucgRecommendations?: string | null;
  };
  clinicalReasoning?: DoctorThought | null;
  isGeneratingReasoning?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Helper function to check if temperature is concerning
 */
function isTemperatureConcerning(temperature: { value: number | null; unit: string }): 'normal' | 'warning' | 'critical' {
  if (temperature.value === null) return 'normal';
  
  const tempCelsius = temperature.unit === 'fahrenheit' 
    ? (temperature.value - 32) * 5 / 9 
    : temperature.value;
  
  // Critical: Emergency thresholds
  if (tempCelsius > 39.5 || tempCelsius < 35.0) return 'critical';
  
  // Warning: Approaching emergency thresholds
  if (tempCelsius > 38.5 || tempCelsius < 36.0) return 'warning';
  
  return 'normal';
}

/**
 * Helper function to check if blood pressure is concerning
 */
function isBloodPressureConcerning(bloodPressure: { systolic: number | null; diastolic: number | null }): 'normal' | 'warning' | 'critical' {
  const { systolic, diastolic } = bloodPressure;
  
  if (systolic === null && diastolic === null) return 'normal';
  
  // Critical: Emergency thresholds
  if (systolic !== null && (systolic > 180 || systolic < 90)) return 'critical';
  if (diastolic !== null && (diastolic > 120 || diastolic < 60)) return 'critical';
  
  // Warning: Approaching emergency thresholds
  if (systolic !== null && (systolic > 140 || systolic < 100)) return 'warning';
  if (diastolic !== null && (diastolic > 90 || diastolic < 70)) return 'warning';
  
  return 'normal';
}

/**
 * Helper function to format gender display
 */
function formatGender(gender: string | null): string {
  if (!gender) return 'Not specified';
  
  const genderMap: Record<string, string> = {
    'male': 'Male',
    'female': 'Female',
    'other': 'Other',
    'prefer_not_to_say': 'Prefer not to say'
  };
  
  return genderMap[gender] || gender;
}

/**
 * Helper function to format timestamp
 */
function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

/**
 * VitalItem Component
 * Displays a single vital sign with appropriate styling based on concern level
 */
interface VitalItemProps {
  label: string;
  value: string | number | null;
  unit?: string;
  timestamp: string | null;
  isConcerning?: 'normal' | 'warning' | 'critical';
  icon?: React.ReactNode;
}

function VitalItem({ label, value, unit, timestamp, isConcerning = 'normal', icon }: VitalItemProps) {
  const hasValue = value !== null && value !== undefined;
  
  // Determine styling based on concern level
  const concernStyles = {
    normal: 'bg-white border-slate-200',
    warning: 'bg-yellow-50 border-yellow-300',
    critical: 'bg-red-50 border-red-300'
  };
  
  const valueStyles = {
    normal: 'text-slate-900',
    warning: 'text-yellow-900',
    critical: 'text-red-900'
  };
  
  const labelStyles = {
    normal: 'text-slate-600',
    warning: 'text-yellow-700',
    critical: 'text-red-700'
  };
  
  return (
    <div className={`rounded-lg border p-3 ${concernStyles[isConcerning]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className={labelStyles[isConcerning]}>{icon}</span>}
          <span className={`text-sm font-medium ${labelStyles[isConcerning]}`}>
            {label}
          </span>
        </div>
        {isConcerning === 'critical' && (
          <AlertCircle className="w-4 h-4 text-red-500" />
        )}
        {isConcerning === 'warning' && (
          <AlertCircle className="w-4 h-4 text-yellow-500" />
        )}
      </div>
      
      {hasValue ? (
        <>
          <div className={`text-lg font-semibold mt-1 ${valueStyles[isConcerning]}`}>
            {value}{unit && ` ${unit}`}
          </div>
          {timestamp && (
            <div className="text-xs text-slate-500 mt-1">
              Collected: {formatTimestamp(timestamp)}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-slate-400 mt-1 italic">
          Not collected
        </div>
      )}
    </div>
  );
}

/**
 * VitalsDisplay Component
 * Displays patient demographics and vital signs with visual highlighting
 * 
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 7.4
 */
interface VitalsDisplayProps {
  vitalsData: VitalsData;
  expandedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
}

function VitalsDisplay({ vitalsData, expandedSections, toggleSection }: VitalsDisplayProps) {
  const tempConcern = isTemperatureConcerning(vitalsData.temperature);
  const bpConcern = isBloodPressureConcerning(vitalsData.bloodPressure);
  
  // Format blood pressure value
  const bpValue = vitalsData.bloodPressure.systolic !== null && vitalsData.bloodPressure.diastolic !== null
    ? `${vitalsData.bloodPressure.systolic}/${vitalsData.bloodPressure.diastolic}`
    : vitalsData.bloodPressure.systolic !== null
    ? `${vitalsData.bloodPressure.systolic}/?`
    : vitalsData.bloodPressure.diastolic !== null
    ? `?/${vitalsData.bloodPressure.diastolic}`
    : null;
  
  // Format temperature value with unit
  const tempValue = vitalsData.temperature.value !== null
    ? vitalsData.temperature.value
    : null;
  const tempUnit = vitalsData.temperature.unit === 'celsius' ? '°C' : '°F';
  
  return (
    <div className="space-y-4">
      {/* Patient Demographics - Collapsible */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('demographics')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            Patient Demographics
          </h3>
          {expandedSections.demographics ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {expandedSections.demographics && (
          <div className="px-4 pb-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Name:</span>
              <span className="text-sm font-medium text-slate-900">
                {vitalsData.patientName || <span className="text-slate-400 italic">Not provided</span>}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Age:</span>
              <span className="text-sm font-medium text-slate-900">
                {vitalsData.patientAge !== null ? `${vitalsData.patientAge} years` : <span className="text-slate-400 italic">Not provided</span>}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Gender:</span>
              <span className="text-sm font-medium text-slate-900">
                {formatGender(vitalsData.patientGender)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Vital Signs - Collapsible */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection('vitals')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600" />
            Vital Signs
          </h3>
          {expandedSections.vitals ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>
        {expandedSections.vitals && (
          <div className="px-4 pb-4 space-y-2">
            <VitalItem
              label="Temperature"
              value={tempValue}
              unit={tempUnit}
              timestamp={vitalsData.temperature.collectedAt}
              isConcerning={tempConcern}
              icon={<Thermometer className="w-4 h-4" />}
            />
            
            <VitalItem
              label="Weight"
              value={vitalsData.weight.value}
              unit={vitalsData.weight.unit}
              timestamp={vitalsData.weight.collectedAt}
              icon={<Weight className="w-4 h-4" />}
            />
            
            <VitalItem
              label="Blood Pressure"
              value={bpValue}
              unit="mmHg"
              timestamp={vitalsData.bloodPressure.collectedAt}
              isConcerning={bpConcern}
              icon={<Heart className="w-4 h-4" />}
            />
          </div>
        )}
      </div>
      
      {/* Current Status - Collapsible */}
      {vitalsData.currentStatus && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => toggleSection('currentStatus')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <h3 className="font-semibold text-slate-800">Current Status</h3>
            {expandedSections.currentStatus ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {expandedSections.currentStatus && (
            <div className="px-4 pb-4">
              <p className="text-sm text-slate-600">{vitalsData.currentStatus}</p>
            </div>
          )}
        </div>
      )}

      {/* Triage Decision Display */}
      {vitalsData.triageDecision && vitalsData.triageDecision !== 'pending' && (
        <TriageDecisionDisplay
          decision={vitalsData.triageDecision}
          reason={vitalsData.triageReason}
          factors={vitalsData.triageFactors || []}
        />
      )}
      
    </div>
  );
}

/**
 * TriageDecisionDisplay Component
 * Displays triage decision with type, rationale, and explanations
 * 
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 */
interface TriageDecisionDisplayProps {
  decision: 'emergency' | 'agent-assisted' | 'direct-to-diagnosis' | 'normal' | 'pending';
  reason: string | null;
  factors?: string[];
}

function TriageDecisionDisplay({ decision, reason, factors }: TriageDecisionDisplayProps) {
  // Don't display if pending
  if (decision === 'pending') {
    return null;
  }

  // Determine styling and content based on decision type
  const getDecisionConfig = () => {
    switch (decision) {
      case 'emergency':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          titleColor: 'text-red-800',
          textColor: 'text-red-900',
          icon: '🚨',
          title: 'Emergency',
          explanation: 'This case requires immediate medical attention. Emergency conditions have been detected that need urgent care.',
          showFactors: true
        };
      
      case 'agent-assisted':
        return {
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-300',
          titleColor: 'text-amber-800',
          textColor: 'text-amber-900',
          icon: '🤝',
          title: 'Agent-Assisted Intake',
          explanation: 'This case has been routed for comprehensive agent-assisted intake due to complexity factors that require detailed investigation.',
          showFactors: true
        };
      
      case 'direct-to-diagnosis':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-300',
          titleColor: 'text-green-800',
          textColor: 'text-green-900',
          icon: '✓',
          title: 'Direct to Diagnosis',
          explanation: 'This case has straightforward presentation and can proceed directly to diagnosis without additional agent assistance.',
          showFactors: true
        };
      
      case 'normal':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-300',
          titleColor: 'text-blue-800',
          textColor: 'text-blue-900',
          icon: '✓',
          title: 'Normal Assessment',
          explanation: 'Vitals and symptoms are within normal ranges.',
          showFactors: false
        };
      
      default:
        return {
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-300',
          titleColor: 'text-slate-800',
          textColor: 'text-slate-900',
          icon: 'ℹ️',
          title: 'Assessment',
          explanation: '',
          showFactors: false
        };
    }
  };

  const config = getDecisionConfig();

  return (
    <div className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xl" role="img" aria-label={config.title}>
          {config.icon}
        </span>
        <div className="flex-1">
          <h4 className={`text-sm font-semibold ${config.titleColor} mb-1`}>
            Triage Decision: {config.title}
          </h4>
          <p className={`text-xs ${config.textColor} leading-relaxed`}>
            {config.explanation}
          </p>
        </div>
      </div>

      {/* Decision Rationale */}
      {reason && (
        <div className={`mt-3 pt-3 border-t ${config.borderColor}`}>
          <p className={`text-xs font-medium ${config.titleColor} mb-1`}>
            Rationale:
          </p>
          <p className={`text-xs ${config.textColor}`}>
            {reason}
          </p>
        </div>
      )}

      {/* Contributing Factors */}
      {config.showFactors && factors && factors.length > 0 && (
        <div className={`mt-3 pt-3 border-t ${config.borderColor}`}>
          <p className={`text-xs font-medium ${config.titleColor} mb-2`}>
            Contributing Factors:
          </p>
          <ul className="space-y-1">
            {factors.map((factor, index) => (
              <li key={index} className={`text-xs ${config.textColor} flex items-start gap-2`}>
                <span className={`${config.textColor} mt-0.5 flex-shrink-0`}>•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * MedicalSidebar Component
 * 
 * Displays medical data and clinical handover information in a sidebar.
 * 
 * Features:
 * - Fixed width (400px) on desktop (Requirement 3.1)
 * - Slide-out drawer on mobile with toggle button (Requirement 3.2, 11.2)
 * - Tab navigation for "Intake Data" and "Dr. Handover" (Requirement 3.3)
 * - Smooth transitions for tab switching (Task 6.1)
 * - Responsive behavior across devices (Requirement 1.2, 1.3)
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 11.2
 */
export default function MedicalSidebar({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  completeness,
  medicalData,
  clinicalReasoning,
  isGeneratingReasoning = false,
  isExpanded = false,
  onToggleExpand,
}: MedicalSidebarProps) {
  // State for collapsible sections (Task 6.2)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    demographics: true,
    vitals: true,
    currentStatus: true,
    chiefComplaint: true,
    reviewOfSystems: true,
    medications: true,
    allergies: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };



  return (
    <div
      className={`
        fixed md:relative inset-y-0 right-0 z-30
        w-full sm:w-96
        ${isExpanded ? 'md:w-full' : 'md:w-[400px]'}
        bg-white border-l border-slate-200
        transform transition-all duration-300 ease-in-out
        md:transform-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        flex flex-col overflow-hidden
      `}
    >
      {/* Sidebar Header with Tabs (Requirement 3.3) */}
      <div className="border-b border-slate-200">
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between p-4 md:hidden">
          <h2 className="font-semibold text-slate-800">Medical Data</h2>
          <button
            onClick={onToggle}
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Requirement 3.3) - Smooth transitions */}
        <div className="flex border-t md:border-t-0">
          <button
            onClick={() => onTabChange('intake-data')}
            className={`
              flex-1 px-4 py-3.5 min-h-[44px] text-sm font-medium 
              transition-all duration-200 ease-in-out
              border-b-2
              ${activeTab === 'intake-data'
                ? 'border-purple-600 text-purple-600 bg-purple-50'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }
            `}
          >
            Intake Data
          </button>
          <button
            onClick={() => onTabChange('handover')}
            className={`
              flex-1 px-4 py-3.5 min-h-[44px] text-sm font-medium 
              transition-all duration-200 ease-in-out
              border-b-2
              ${activeTab === 'handover'
                ? 'border-purple-600 text-purple-600 bg-purple-50'
                : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
              }
            `}
          >
            Dr. Handover
          </button>

          {/* Desktop Expand Toggle */}
          <button
            onClick={onToggleExpand}
            className="hidden md:flex items-center justify-center p-3 text-slate-400 hover:text-purple-600 hover:bg-slate-50 border-l border-slate-200 transition-colors"
            title={isExpanded ? "Collapse sidebar" : "Expand to full width"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sidebar Content with smooth transitions (Requirement 3.4, 3.5) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Intake Data Tab Content */}
        <div
          className={`
            transition-opacity duration-200 ease-in-out
            ${activeTab === 'intake-data' ? 'opacity-100' : 'opacity-0 hidden'}
          `}
        >
          {/* Progress Indicator (Requirement 3.7) */}
          <div className="bg-gradient-to-r from-medical-50 to-purple-50 rounded-xl p-4 border border-medical-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Intake Progress</span>
              <span className="text-lg font-bold text-purple-600">{completeness}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-medical-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>

          {/* Vitals Display (Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 7.4) */}
          {medicalData?.vitalsData && (
            <VitalsDisplay 
              vitalsData={medicalData.vitalsData}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
            />
          )}

          {/* Chief Complaint (Requirement 3.4) - Collapsible (Task 6.2) */}
          {medicalData?.chiefComplaint && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('chiefComplaint')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Chief Complaint
                </h3>
                {expandedSections.chiefComplaint ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {expandedSections.chiefComplaint && (
                <div className="px-4 pb-4">
                  <p className="text-slate-600 text-sm">{medicalData.chiefComplaint}</p>
                </div>
              )}
            </div>
          )}

          {/* Review of Systems (Symptoms) (Requirement 3.4) - Collapsible (Task 6.2) */}
          {medicalData?.reviewOfSystems && medicalData.reviewOfSystems.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('reviewOfSystems')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <h3 className="font-semibold text-slate-800">Review of Systems</h3>
                {expandedSections.reviewOfSystems ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {expandedSections.reviewOfSystems && (
                <div className="px-4 pb-4">
                  <ul className="space-y-1">
                    {medicalData.reviewOfSystems.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-medical-500 mt-1.5 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Medications (Requirement 3.4) - Collapsible (Task 6.2) */}
          {medicalData?.medications && medicalData.medications.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('medications')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <h3 className="font-semibold text-slate-800">Medications</h3>
                {expandedSections.medications ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {expandedSections.medications && (
                <div className="px-4 pb-4">
                  <ul className="space-y-1">
                    {medicalData.medications.map((med, idx) => (
                      <li key={idx} className="text-sm text-slate-600">{med}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Allergies (Requirement 3.4) - Collapsible (Task 6.2) */}
          {medicalData?.allergies && medicalData.allergies.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => toggleSection('allergies')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Allergies
                </h3>
                {expandedSections.allergies ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {expandedSections.allergies && (
                <div className="px-4 pb-4">
                  <ul className="space-y-1">
                    {medicalData.allergies.map((allergy, idx) => (
                      <li key={idx} className="text-sm text-slate-600">{allergy}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Empty State Message (Task 6.2) */}
          {!medicalData?.chiefComplaint &&
            (!medicalData?.reviewOfSystems || medicalData.reviewOfSystems.length === 0) &&
            (!medicalData?.medications || medicalData.medications.length === 0) &&
            (!medicalData?.allergies || medicalData.allergies.length === 0) && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">
                  Medical data will appear here as the intake progresses.
                </p>
              </div>
            )}
        </div>

        {/* Dr. Handover Tab Content */}
        <div
          className={`
            transition-opacity duration-200 ease-in-out
            ${activeTab === 'handover' ? 'opacity-100' : 'opacity-0 hidden'}
          `}
        >
          {/* Clinical Reasoning Section (Requirement 3.5, 4.1) - Task 8.1 */}
          <div className="mb-4">
            <ClinicalReasoning
              reasoning={clinicalReasoning ?? null}
              isGenerating={isGeneratingReasoning}
              vitalsData={medicalData?.vitalsData}
            />
          </div>

          {/* Clinical Handover (SBAR) (Requirement 3.5, 6.1) */}
          {medicalData?.clinicalHandover ? (
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200 p-4">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Clinical Handover (SBAR)
              </h3>
              <div className="space-y-3 text-sm">
                {medicalData.clinicalHandover.situation && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 rounded p-3 transition-all duration-200">
                    <p className="font-medium text-blue-700 mb-1">Situation</p>
                    <p className="text-blue-900">{medicalData.clinicalHandover.situation}</p>
                  </div>
                )}
                {medicalData.clinicalHandover.background && (
                  <div className="bg-green-50 border-l-4 border-green-500 rounded p-3 transition-all duration-200">
                    <p className="font-medium text-green-700 mb-1">Background</p>
                    <p className="text-green-900">{medicalData.clinicalHandover.background}</p>
                  </div>
                )}
                {medicalData.clinicalHandover.assessment && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 rounded p-3 transition-all duration-200">
                    <p className="font-medium text-amber-700 mb-1">Assessment</p>
                    <p className="text-amber-900">{medicalData.clinicalHandover.assessment}</p>
                  </div>
                )}
                {medicalData.clinicalHandover.recommendation && (
                  <div className="bg-red-50 border-l-4 border-red-500 rounded p-3 transition-all duration-200">
                    <p className="font-medium text-red-700 mb-1">Recommendation</p>
                    <p className="text-red-900">{medicalData.clinicalHandover.recommendation}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Clinical handover will be generated as the intake progresses.
              </p>
            </div>
          )}

          {/* UCG Recommendations (Requirement 3.8) */}
          {medicalData?.ucgRecommendations && (
            <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
              <h3 className="font-semibold text-purple-800 mb-2">Uganda Clinical Guidelines</h3>
              <div className="prose prose-sm max-w-none text-purple-900 prose-p:text-purple-900 prose-headings:text-purple-900 prose-strong:text-purple-900 prose-ul:text-purple-900 prose-li:text-purple-900 marker:text-purple-900">
                <ReactMarkdown>{medicalData.ucgRecommendations}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
