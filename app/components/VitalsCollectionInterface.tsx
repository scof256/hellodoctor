'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { VitalsData } from '@/app/types';

interface VitalsCollectionInterfaceProps {
  sessionId: string;
  initialData?: Partial<VitalsData>;
  onComplete: (vitalsData: VitalsData) => void;
  onEmergency: (reason: string, recommendations: string[]) => void;
}

type CollectionStep = 
  | 'name' 
  | 'age' 
  | 'gender' 
  | 'temperature' 
  | 'weight' 
  | 'bloodPressure' 
  | 'status';

const TOTAL_STEPS = 7;

// Validation ranges
const VALIDATION_RANGES = {
  age: { min: 0, max: 120 },
  temperature: {
    celsius: { min: 30, max: 45 },
    fahrenheit: { min: 86, max: 113 }
  },
  weight: {
    kg: { min: 1, max: 300 },
    lbs: { min: 2, max: 660 }
  },
  bloodPressure: {
    systolic: { min: 60, max: 250 },
    diastolic: { min: 40, max: 150 }
  }
};

export function VitalsCollectionInterface({
  sessionId,
  initialData,
  onComplete,
  onEmergency
}: VitalsCollectionInterfaceProps) {
  const [currentStep, setCurrentStep] = useState<CollectionStep>('name');
  const [vitalsData, setVitalsData] = useState<Partial<VitalsData>>({
    patientName: initialData?.patientName || null,
    patientAge: initialData?.patientAge || null,
    patientGender: initialData?.patientGender || null,
    temperature: initialData?.temperature || { value: null, unit: 'celsius', collectedAt: null },
    weight: initialData?.weight || { value: null, unit: 'kg', collectedAt: null },
    bloodPressure: initialData?.bloodPressure || { systolic: null, diastolic: null, collectedAt: null },
    currentStatus: initialData?.currentStatus || null,
    vitalsCollected: false,
    triageDecision: 'pending',
    triageReason: null,
    vitalsStageCompleted: false
  });

  const [tempInput, setTempInput] = useState('');
  const [weightInput, setWeightInput] = useState('');
  const [systolicInput, setSystolicInput] = useState('');
  const [diastolicInput, setDiastolicInput] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stepOrder: CollectionStep[] = ['name', 'age', 'gender', 'temperature', 'weight', 'bloodPressure', 'status'];
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / TOTAL_STEPS) * 100;

  const handleNext = async () => {
    setError(null);

    // Validate current step
    if (currentStep === 'name') {
      if (!vitalsData.patientName || vitalsData.patientName.trim().length === 0) {
        setError('Please enter your name');
        return;
      }
      if (vitalsData.patientName.trim().length < 2) {
        setError('Name must be at least 2 characters long');
        return;
      }
    }

    if (currentStep === 'age') {
      if (vitalsData.patientAge === null || vitalsData.patientAge === undefined) {
        setError('Please enter your age');
        return;
      }
      if (vitalsData.patientAge < VALIDATION_RANGES.age.min || vitalsData.patientAge > VALIDATION_RANGES.age.max) {
        setError(`Age must be between ${VALIDATION_RANGES.age.min} and ${VALIDATION_RANGES.age.max}`);
        return;
      }
    }

    if (currentStep === 'gender' && !vitalsData.patientGender) {
      setError('Please select your gender');
      return;
    }

    // Validate temperature if provided
    if (currentStep === 'temperature' && tempInput) {
      const temp = parseFloat(tempInput);
      const unit = (vitalsData.temperature?.unit || 'celsius') as 'celsius' | 'fahrenheit';
      const range = VALIDATION_RANGES.temperature[unit];
      
      if (isNaN(temp)) {
        setError('Please enter a valid temperature');
        return;
      }
      if (temp < range.min || temp > range.max) {
        setError(`Temperature must be between ${range.min}°${unit === 'celsius' ? 'C' : 'F'} and ${range.max}°${unit === 'celsius' ? 'C' : 'F'}`);
        return;
      }
      
      // Set timestamp when value is provided
      setVitalsData({
        ...vitalsData,
        temperature: {
          ...vitalsData.temperature!,
          value: temp,
          collectedAt: new Date().toISOString()
        }
      });
    }

    // Validate weight if provided
    if (currentStep === 'weight' && weightInput) {
      const weight = parseFloat(weightInput);
      const unit = (vitalsData.weight?.unit || 'kg') as 'kg' | 'lbs';
      const range = VALIDATION_RANGES.weight[unit];
      
      if (isNaN(weight)) {
        setError('Please enter a valid weight');
        return;
      }
      if (weight < range.min || weight > range.max) {
        setError(`Weight must be between ${range.min}${unit} and ${range.max}${unit}`);
        return;
      }
      
      // Set timestamp when value is provided
      setVitalsData({
        ...vitalsData,
        weight: {
          ...vitalsData.weight!,
          value: weight,
          collectedAt: new Date().toISOString()
        }
      });
    }

    // Validate blood pressure if provided
    if (currentStep === 'bloodPressure' && (systolicInput || diastolicInput)) {
      const systolic = systolicInput ? parseInt(systolicInput) : null;
      const diastolic = diastolicInput ? parseInt(diastolicInput) : null;
      
      // If one is provided, both must be provided
      if ((systolic !== null && diastolic === null) || (systolic === null && diastolic !== null)) {
        setError('Please provide both systolic and diastolic blood pressure readings');
        return;
      }
      
      if (systolic !== null && diastolic !== null) {
        if (isNaN(systolic) || isNaN(diastolic)) {
          setError('Please enter valid blood pressure readings');
          return;
        }
        
        const systolicRange = VALIDATION_RANGES.bloodPressure.systolic;
        const diastolicRange = VALIDATION_RANGES.bloodPressure.diastolic;
        
        if (systolic < systolicRange.min || systolic > systolicRange.max) {
          setError(`Systolic pressure must be between ${systolicRange.min} and ${systolicRange.max} mmHg`);
          return;
        }
        if (diastolic < diastolicRange.min || diastolic > diastolicRange.max) {
          setError(`Diastolic pressure must be between ${diastolicRange.min} and ${diastolicRange.max} mmHg`);
          return;
        }
        if (systolic <= diastolic) {
          setError('Systolic pressure must be higher than diastolic pressure');
          return;
        }
        
        // Set timestamp when values are provided
        setVitalsData({
          ...vitalsData,
          bloodPressure: {
            systolic,
            diastolic,
            collectedAt: new Date().toISOString()
          }
        });
      }
    }

    // Move to next step or complete
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextIndex]!);
    } else {
      // All steps complete, save data
      await saveVitalsData();
    }
  };

  const handleSkip = () => {
    setError(null);
    
    // Only allow skipping vitals, not demographics
    if (['temperature', 'weight', 'bloodPressure', 'status'].includes(currentStep)) {
      // Clear the input fields for skipped vitals
      if (currentStep === 'temperature') {
        setTempInput('');
        setVitalsData({
          ...vitalsData,
          temperature: {
            value: null,
            unit: vitalsData.temperature?.unit || 'celsius',
            collectedAt: null
          }
        });
      } else if (currentStep === 'weight') {
        setWeightInput('');
        setVitalsData({
          ...vitalsData,
          weight: {
            value: null,
            unit: vitalsData.weight?.unit || 'kg',
            collectedAt: null
          }
        });
      } else if (currentStep === 'bloodPressure') {
        setSystolicInput('');
        setDiastolicInput('');
        setVitalsData({
          ...vitalsData,
          bloodPressure: {
            systolic: null,
            diastolic: null,
            collectedAt: null
          }
        });
      } else if (currentStep === 'status') {
        setStatusInput('');
        setVitalsData({
          ...vitalsData,
          currentStatus: null
        });
      }
      
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < stepOrder.length) {
        setCurrentStep(stepOrder[nextIndex]!);
      } else {
        saveVitalsData();
      }
    }
  };

  const saveVitalsData = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          vitalsData: {
            ...vitalsData,
            vitalsCollected: true,
            vitalsStageCompleted: true
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to save vitals');
      }

      const result = await response.json();

      // Handle emergency detection
      if (result.triageDecision === 'emergency') {
        onEmergency(result.triageReason, result.recommendations);
      } else {
        // Complete vitals data with triage decision
        const completeVitalsData: VitalsData = {
          patientName: vitalsData.patientName!,
          patientAge: vitalsData.patientAge!,
          patientGender: vitalsData.patientGender!,
          vitalsCollected: true,
          temperature: vitalsData.temperature!,
          weight: vitalsData.weight!,
          bloodPressure: vitalsData.bloodPressure!,
          currentStatus: vitalsData.currentStatus,
          triageDecision: result.triageDecision === 'emergency' ? 'emergency' : 'normal',
          triageReason: result.triageReason,
          vitalsStageCompleted: true
        };
        
        // Trigger agent routing transition by calling onComplete
        // The parent component will handle the agent transition
        onComplete(completeVitalsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vitals');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'name':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-base font-medium">
                What's your name? <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Please enter your full name as it appears on your ID
              </p>
              <Input
                id="name"
                type="text"
                value={vitalsData.patientName || ''}
                onChange={(e) => setVitalsData({ ...vitalsData, patientName: e.target.value })}
                placeholder="e.g., John Smith"
                className="mt-2"
                autoFocus
              />
            </div>
          </div>
        );

      case 'age':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="age" className="text-base font-medium">
                How old are you? <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Enter your age in years (0-120)
              </p>
              <Input
                id="age"
                type="number"
                min="0"
                max="120"
                value={vitalsData.patientAge ?? ''}
                onChange={(e) => setVitalsData({ ...vitalsData, patientAge: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g., 35"
                className="mt-2"
                autoFocus
              />
            </div>
          </div>
        );

      case 'gender':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">
                What is your gender? <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                This helps us provide appropriate medical care
              </p>
              <RadioGroup
                value={vitalsData.patientGender || ''}
                onValueChange={(value) => setVitalsData({ ...vitalsData, patientGender: value as VitalsData['patientGender'] })}
                className="mt-4 space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-md border hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="cursor-pointer flex-1">Male</Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-md border hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="cursor-pointer flex-1">Female</Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-md border hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="cursor-pointer flex-1">Other</Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-md border hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="prefer_not_to_say" id="prefer_not_to_say" />
                  <Label htmlFor="prefer_not_to_say" className="cursor-pointer flex-1">Prefer not to say</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 'temperature':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="temperature" className="text-base font-medium">
                Do you have your temperature reading?
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Optional - Skip if you don't have a thermometer
              </p>
              <div className="flex gap-2 mt-2">
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  value={tempInput}
                  onChange={(e) => {
                    setTempInput(e.target.value);
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      setVitalsData({
                        ...vitalsData,
                        temperature: {
                          ...vitalsData.temperature!,
                          value
                        }
                      });
                    }
                  }}
                  placeholder={vitalsData.temperature?.unit === 'celsius' ? 'e.g., 37.0' : 'e.g., 98.6'}
                  className="flex-1"
                  autoFocus
                />
                <Select
                  value={vitalsData.temperature?.unit || 'celsius'}
                  onValueChange={(value) => {
                    const unit = value as 'celsius' | 'fahrenheit';
                    setVitalsData({
                      ...vitalsData,
                      temperature: {
                        ...vitalsData.temperature!,
                        unit
                      }
                    });
                    // Clear input when changing units
                    setTempInput('');
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celsius">°C</SelectItem>
                    <SelectItem value="fahrenheit">°F</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Normal range: {vitalsData.temperature?.unit === 'celsius' ? '36.1-37.2°C' : '97.0-99.0°F'}
              </p>
            </div>
          </div>
        );

      case 'weight':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="weight" className="text-base font-medium">
                Do you have your current weight?
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Optional - Skip if you don't know your weight
              </p>
              <div className="flex gap-2 mt-2">
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => {
                    setWeightInput(e.target.value);
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      setVitalsData({
                        ...vitalsData,
                        weight: {
                          ...vitalsData.weight!,
                          value
                        }
                      });
                    }
                  }}
                  placeholder={vitalsData.weight?.unit === 'kg' ? 'e.g., 70' : 'e.g., 154'}
                  className="flex-1"
                  autoFocus
                />
                <Select
                  value={vitalsData.weight?.unit || 'kg'}
                  onValueChange={(value) => {
                    const unit = value as 'kg' | 'lbs';
                    setVitalsData({
                      ...vitalsData,
                      weight: {
                        ...vitalsData.weight!,
                        unit
                      }
                    });
                    // Clear input when changing units
                    setWeightInput('');
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lbs">lbs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'bloodPressure':
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">
                Do you have your blood pressure reading?
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Optional - Skip if you don't have a blood pressure monitor
              </p>
              <div className="flex gap-2 mt-2 items-center">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={systolicInput}
                    onChange={(e) => {
                      setSystolicInput(e.target.value);
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setVitalsData({
                          ...vitalsData,
                          bloodPressure: {
                            ...vitalsData.bloodPressure!,
                            systolic: value
                          }
                        });
                      }
                    }}
                    placeholder="Systolic (e.g., 120)"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-1">Top number</p>
                </div>
                <span className="text-2xl font-bold text-muted-foreground">/</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={diastolicInput}
                    onChange={(e) => {
                      setDiastolicInput(e.target.value);
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setVitalsData({
                          ...vitalsData,
                          bloodPressure: {
                            ...vitalsData.bloodPressure!,
                            diastolic: value
                          }
                        });
                      }
                    }}
                    placeholder="Diastolic (e.g., 80)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Bottom number</p>
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">mmHg</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Normal range: 90-120 / 60-80 mmHg
              </p>
            </div>
          </div>
        );

      case 'status':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="status" className="text-base font-medium">
                How are you feeling right now?
              </Label>
              <p className="text-sm text-muted-foreground mt-1 mb-2">
                Optional - Describe your current symptoms or how you're feeling
              </p>
              <Textarea
                id="status"
                value={statusInput}
                onChange={(e) => {
                  setStatusInput(e.target.value);
                  setVitalsData({ ...vitalsData, currentStatus: e.target.value || null });
                }}
                placeholder="e.g., I have a headache and feel tired..."
                className="mt-2 min-h-[120px]"
                autoFocus
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'name': return 'Collecting your name';
      case 'age': return 'Collecting your age';
      case 'gender': return 'Collecting your gender';
      case 'temperature': return 'Collecting temperature';
      case 'weight': return 'Collecting weight';
      case 'bloodPressure': return 'Collecting blood pressure';
      case 'status': return 'How are you feeling?';
      default: return '';
    }
  };

  const canSkip = ['temperature', 'weight', 'bloodPressure', 'status'].includes(currentStep);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{getStepTitle()}</CardTitle>
        <CardDescription>
          Step {currentStepIndex + 1} of {TOTAL_STEPS}
          {canSkip && <span className="ml-2 text-muted-foreground">(Optional)</span>}
        </CardDescription>
        <div className="mt-3">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {Math.round(progress)}% complete
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderStep()}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t">
          {canSkip && (
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
              I don't have it
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : currentStepIndex === TOTAL_STEPS - 1 ? (
              'Complete'
            ) : (
              'Next'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
