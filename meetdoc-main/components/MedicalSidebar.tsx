
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { MedicalData, DoctorThought } from '../types';
import { Brain, FileText, Pill, AlertTriangle, History, Activity, Microscope, Sparkles, CheckCircle2, Stethoscope, ClipboardCheck, BookOpen, ChevronDown, ChevronUp, FilePlus, ExternalLink, Radar, User, AlertCircle, Check, FileStack } from 'lucide-react';

interface MedicalSidebarProps {
  data: MedicalData;
  thought: DoctorThought;
  onTopicTrigger: (field: keyof MedicalData) => void;
}

const MedicalSidebar: React.FC<MedicalSidebarProps> = ({ data, thought, onTopicTrigger }) => {
  const [activeTab, setActiveTab] = useState<'intake' | 'handover'>('intake');
  const [showUCG, setShowUCG] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(true);
  
  // Calculate Completeness
  const completeness = useMemo(() => {
    const fields: (keyof MedicalData)[] = [
      'chiefComplaint', 'hpi', 'medications', 'allergies', 
      'pastMedicalHistory', 'familyHistory', 'socialHistory'
    ];
    let filled = 0;
    fields.forEach(field => {
      const val = data[field];
      if (Array.isArray(val)) {
        if (val.length > 0) filled++;
      } else {
        if (val) filled++;
      }
    });
    return Math.round((filled / fields.length) * 100);
  }, [data]);

  return (
    <div className="h-full flex flex-col bg-white border-l border-slate-200">
      
      {/* 1. Header & Tabs */}
      <div className="p-4 border-b border-slate-100 space-y-4">
        {/* Completeness Bar */}
        <div className="space-y-2">
           <div className="flex items-center justify-between text-slate-700">
              <span className="text-xs font-bold uppercase tracking-wider">Intake Progress</span>
              <span className="text-sm font-bold text-medical-700">{completeness}%</span>
           </div>
           <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-medical-500 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${completeness}%` }}
              />
           </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('intake')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'intake' ? 'bg-white text-medical-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Activity className="w-4 h-4" /> Intake Data
          </button>
          <button 
            onClick={() => setActiveTab('handover')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'handover' ? 'bg-white text-medical-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Stethoscope className="w-4 h-4" /> Dr. Handover
          </button>
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        
        {activeTab === 'intake' ? (
          <>
            {/* The Doctor's Brain */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-medical-800 pb-2 border-b border-medical-100">
                <Brain className="w-5 h-5" />
                <h2 className="font-bold text-lg">AI Clinical Reasoning</h2>
              </div>
              
              <div className="bg-white rounded-xl p-4 border border-slate-200 text-sm space-y-3 shadow-sm">
                  {/* Strategy & Next Move */}
                  {thought.strategy && (
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Strategy</span>
                        <p className="text-medical-700 font-medium text-xs">{thought.strategy}</p>
                    </div>
                  )}

                  {/* Differential Diagnosis */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Differential Diagnosis</span>
                    <div className="space-y-2">
                      {thought.differentialDiagnosis.length === 0 ? (
                          <span className="text-slate-400 italic">Gathering initial symptoms...</span>
                      ) : (
                          thought.differentialDiagnosis.map((ddx, i) => (
                              <div key={i} className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-slate-700">{ddx.condition}</span>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        ddx.probability.toLowerCase().includes('high') ? 'bg-red-100 text-red-700' : 
                                        ddx.probability.toLowerCase().includes('med') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                      {ddx.probability}
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500 leading-tight">{ddx.reasoning}</p>
                              </div>
                          ))
                      )}
                    </div>
                  </div>

                  {/* Missing Information (The "Probe" List) */}
                  {thought.missingInformation && thought.missingInformation.length > 0 && (
                     <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1 mb-1">
                           <Radar className="w-3 h-3 text-orange-500" />
                           <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Hunting For</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                           {thought.missingInformation.slice(0, 3).map((info, i) => (
                              <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded text-[10px] font-medium">
                                 {info}
                              </span>
                           ))}
                        </div>
                     </div>
                  )}
              </div>
            </div>

            {/* Structured Data Fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-medical-800 pb-2 border-b border-medical-100">
                <FileText className="w-5 h-5" />
                <h2 className="font-bold text-lg">Structured Data</h2>
              </div>
              
              <RecordSection 
                  icon={<Activity className="w-4 h-4" />} 
                  title="Chief Complaint" 
                  content={data.chiefComplaint ? [data.chiefComplaint] : []} 
                  placeholder="Tap to ask"
                  onTrigger={() => onTopicTrigger('chiefComplaint')}
                  isMissing={!data.chiefComplaint}
              />
              <RecordSection 
                  icon={<Microscope className="w-4 h-4" />} 
                  title="HPI" 
                  content={data.hpi ? [data.hpi] : []} 
                  placeholder="History of present illness..."
                  className="text-xs text-slate-600 leading-relaxed"
                  onTrigger={() => onTopicTrigger('hpi')}
                  isMissing={!data.hpi}
              />
              <RecordSection 
                  icon={<FileStack className="w-4 h-4" />} 
                  title="Medical Records" 
                  content={data.medicalRecords} 
                  placeholder="Files & Scans..."
                  emptyText="No files uploaded"
                  onTrigger={() => {}} // Can't easily trigger asking for records without logic change, keep empty for now
                  isMissing={false} // Optional
              />
              <RecordSection 
                  icon={<Pill className="w-4 h-4" />} 
                  title="Medications" 
                  content={data.medications} 
                  placeholder="Tap to ask about meds"
                  emptyText="None reported"
                  onTrigger={() => onTopicTrigger('medications')}
                  isMissing={data.medications.length === 0}
              />
              <RecordSection 
                  icon={<AlertTriangle className="w-4 h-4" />} 
                  title="Allergies" 
                  content={data.allergies} 
                  placeholder="Tap to ask about allergies"
                  emptyText="NKDA"
                  warning
                  onTrigger={() => onTopicTrigger('allergies')}
                  isMissing={data.allergies.length === 0}
              />
            </div>
          </>
        ) : (
          <>
            {/* Professional Analysis Tab - Enhanced */}
            <div className="space-y-6">
               
               {/* Header Block */}
               <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <ClipboardCheck className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-2 opacity-80">
                        <Stethoscope className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Medical Analysis</span>
                     </div>
                     <h2 className="text-2xl font-bold mb-1">Clinical Handover</h2>
                     <p className="text-blue-100 text-sm">
                       Generated by Dr. Gemini (Senior Consultant AI)
                     </p>
                  </div>
               </div>

               {/* Detailed SBAR Analysis - Color Cards */}
               <div className="space-y-4">
                  <div 
                    className="flex justify-between items-center cursor-pointer mb-2"
                    onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                  >
                     <h3 className="font-bold text-slate-700 text-lg flex items-center gap-2">
                       <FileText className="w-5 h-5" /> SBAR Report
                     </h3>
                     {showFullAnalysis ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                  
                  {showFullAnalysis && (
                    data.clinicalHandover ? (
                      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         {/* SITUATION - Blue */}
                         <SBARCard 
                            title="Situation" 
                            icon={<User className="w-4 h-4" />}
                            content={data.clinicalHandover.situation}
                            colorTheme="blue"
                         />
                         
                         {/* BACKGROUND - Slate/Gray */}
                         <SBARCard 
                            title="Background" 
                            icon={<History className="w-4 h-4" />}
                            content={data.clinicalHandover.background}
                            colorTheme="slate"
                         />

                         {/* ASSESSMENT - Amber/Orange */}
                         <SBARCard 
                            title="Assessment" 
                            icon={<AlertCircle className="w-4 h-4" />}
                            content={data.clinicalHandover.assessment}
                            colorTheme="amber"
                         />

                         {/* RECOMMENDATION - Emerald/Green */}
                         <SBARCard 
                            title="Recommendation" 
                            icon={<Check className="w-4 h-4" />}
                            content={data.clinicalHandover.recommendation}
                            colorTheme="emerald"
                         />
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400">
                         <FilePlus className="w-10 h-10 mb-3 opacity-20" />
                         <p className="text-center italic text-sm">
                           Awaiting sufficient clinical data to generate SBAR...
                         </p>
                      </div>
                    )
                  )}
               </div>

               {/* UCG Guidelines Section - Highlighted */}
               <div className="bg-purple-50 border border-purple-100 rounded-xl shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setShowUCG(!showUCG)}
                    disabled={!data.ucgRecommendations}
                    className={`w-full flex items-center justify-between p-4 transition-all ${
                      showUCG ? 'border-b border-purple-100 bg-purple-100/50' : 'hover:bg-purple-100/30'
                    } ${!data.ucgRecommendations ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-200 rounded-lg text-purple-700">
                           <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                           <h3 className="font-bold text-purple-900">Uganda Clinical Guidelines (UCG)</h3>
                           <p className="text-xs text-purple-700">Recommended Management Protocol</p>
                        </div>
                     </div>
                     {showUCG ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
                  </button>

                  {showUCG && data.ucgRecommendations && (
                     <div className="p-5 bg-purple-50">
                        <div className="prose prose-sm prose-purple max-w-none 
                            prose-headings:text-purple-900 prose-headings:font-bold prose-headings:text-sm prose-headings:uppercase prose-headings:mb-1 prose-headings:mt-3
                            prose-p:text-purple-800 prose-p:my-1
                            prose-ul:my-1 prose-li:my-0
                            prose-strong:text-purple-950 prose-strong:font-extrabold">
                           <ReactMarkdown>{data.ucgRecommendations}</ReactMarkdown>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-purple-200 flex items-center justify-end gap-2 text-xs text-purple-600 font-medium">
                           <ExternalLink className="w-3 h-3" />
                           <span>Reference: UCG 2023 National Guidelines</span>
                        </div>
                     </div>
                  )}
               </div>

               {data.bookingStatus === 'ready' && (
                  <div className="bg-green-600 text-white rounded-xl p-4 shadow-lg text-center transform transition-all hover:scale-[1.02] cursor-default">
                     <p className="font-bold text-lg flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-6 h-6" /> 
                        Intake Complete
                     </p>
                     <p className="text-green-100 text-sm mt-1">Ready for appointment booking</p>
                  </div>
               )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Reusable SBAR Card Component
interface SBARCardProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  colorTheme: 'blue' | 'slate' | 'amber' | 'emerald';
}

const SBARCard: React.FC<SBARCardProps> = ({ title, icon, content, colorTheme }) => {
  
  const styles = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      headerText: 'text-blue-800',
      headerBg: 'bg-blue-100',
      bodyText: 'text-blue-900',
      prose: 'prose-headings:text-blue-800 prose-strong:text-blue-900'
    },
    slate: {
      border: 'border-slate-200',
      bg: 'bg-slate-50',
      headerText: 'text-slate-700',
      headerBg: 'bg-slate-200',
      bodyText: 'text-slate-800',
      prose: 'prose-headings:text-slate-700 prose-strong:text-slate-900'
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      headerText: 'text-amber-800',
      headerBg: 'bg-amber-100',
      bodyText: 'text-amber-900',
      prose: 'prose-headings:text-amber-800 prose-strong:text-amber-900'
    },
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50',
      headerText: 'text-emerald-800',
      headerBg: 'bg-emerald-100',
      bodyText: 'text-emerald-900',
      prose: 'prose-headings:text-emerald-800 prose-strong:text-emerald-900'
    }
  };

  const currentStyle = styles[colorTheme];

  return (
    <div className={`border ${currentStyle.border} rounded-xl overflow-hidden shadow-sm`}>
       <div className={`${currentStyle.headerBg} p-3 flex items-center gap-2 border-b ${currentStyle.border}`}>
          {icon}
          <h4 className={`text-xs font-bold uppercase tracking-widest ${currentStyle.headerText}`}>
            {title}
          </h4>
       </div>
       <div className={`${currentStyle.bg} p-4 text-sm leading-relaxed ${currentStyle.bodyText}`}>
         <div className={`prose prose-sm max-w-none ${currentStyle.prose} prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-xs prose-headings:uppercase`}>
            <ReactMarkdown>{content}</ReactMarkdown>
         </div>
       </div>
    </div>
  );
}

interface RecordSectionProps {
    icon: React.ReactNode;
    title: string;
    content: string[];
    placeholder: string;
    emptyText?: string;
    warning?: boolean;
    className?: string;
    onTrigger: () => void;
    isMissing: boolean;
}

const RecordSection: React.FC<RecordSectionProps> = ({ 
  icon, title, content, placeholder, emptyText, warning, className, onTrigger, isMissing 
}) => (
    <div className="space-y-1">
        <div className="flex items-center gap-2 text-slate-500">
            {icon}
            <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        </div>
        
        {isMissing ? (
          <button 
            onClick={onTrigger}
            className="w-full text-left bg-slate-50 hover:bg-medical-50 border border-dashed border-slate-300 hover:border-medical-300 rounded-lg p-3 group transition-colors flex items-center justify-between"
          >
            <span className="text-slate-400 text-sm italic group-hover:text-medical-600">{placeholder}</span>
            <Sparkles className="w-4 h-4 text-slate-300 group-hover:text-medical-500" />
          </button>
        ) : (
          <div className={`bg-white border ${warning ? 'border-red-100 bg-red-50' : 'border-slate-200'} rounded-lg p-3 min-h-[3rem] relative`}>
            {content.length > 0 ? (
                <ul className={`list-disc list-inside space-y-1 ${className || 'text-sm text-slate-700'}`}>
                    {content.map((item, i) => (
                        <li key={i} className={warning ? 'text-red-700 font-medium' : ''}>{item}</li>
                    ))}
                </ul>
            ) : (
                <span className="text-slate-500 text-sm">{emptyText}</span>
            )}
          </div>
        )}
    </div>
);

export default MedicalSidebar;
