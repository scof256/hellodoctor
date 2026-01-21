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
    if (currentStep === 'name' && (!vitalsData.patientName || vitalsData.patientName.trim().length === 0)) {
      setError('Please enter your name');
      return;
    }

    if (currentStep === 'age' && (vitalsData.patientAge === null || vitalsData.patientAge < 0 || vitalsData.patientAge > 120)) {
      setError('Please enter a valid age (0-120)');
      return;
    }

    if (currentStep === 'gender' && !vitalsData.patientGender) {
      setError('Please select your gender');
      return;
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
    // Only allow skipping vitals, not demographics
    if (['temperature', 'weight', 'bloodPressure'].includes(currentStep)) {
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

      if (result.triageDecision === 'emergency') {
        onEmergency(result.triageReason, result.recommendations);
      } else {
        const completeVitalsData: VitalsData = {
          patientName: vitalsData.patientName!,
          patientAge: vitalsData.patientAge!,
          patientGender: vitalsData.patientGender!,
          vitalsCollected: true,
          temperature: vitalsData.temperature!,
          weight: vitalsData.weight!,
          bloodPressure: vitalsData.bloodPressure!,
          currentStatus: vitalsData.currentStatus,
          triageDecision: result.triageDecision,
          triageReason: result.triageReason,
          vitalsStageCompleted: true
        };
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
              <Label htmlFor="name">What's your name?</Label>
              <Input
                id="name"
                type="text"
                value={vitalsData.patientName || ''}
                onChange={(e) => setVitalsData({ ...vitalsData, patientName: e.target.value })}
                placeholder="Enter your full name"
                className="mt-2"
              />
            </div>
          </div>
        );

      case 'age':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="age">How old are you?</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="120"
                value={vitalsData.patientAge || ''}
                onChange={(e) => setVitalsData({ ...vitalsData, patientAge: parseInt(e.target.value) || null })}
                placeholder="Enter your age"
                className="mt-2"
              />
            </div>
          </div>
        );

      case 'gender':
        return (
          <div className="space-y-4">
            <div>
              <Label>What is your gender?</Label>
              <RadioGroup
                value={vitalsData.patientGender || ''}
                onValueChange={(value) => setVitalsData({ ...vitalsData, patientGender: value as VitalsData['patientGender'] })}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other">Other</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prefer_not_to_say" id="prefer_not_to_say" />
                  <Label htmlFor="prefer_not_to_say">Prefer not to say</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );

      case 'temperature':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="temperature">Do you have your temperature reading?</Label>
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
                  placeholder="e.g., 37.0"
                  className="flex-1"
                />
                <Select
                  value={vitalsData.temperature?.unit || 'celsius'}
                  onValueChange={(value) => setVitalsData({
                    ...vitalsData,
                    temperature: {
                      ...vitalsData.temperature!,
                      unit: value as 'celsius' | 'fahrenheit'
                    }
                  })}
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
            </div>
          </div>
        );

      case 'weight':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="weight">Do you have your current weight?</Label>
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
                  placeholder="e.g., 70"
                  className="flex-1"
                />
                <Select
                  value={vitalsData.weight?.unit || 'kg'}
                  onValueChange={(value) => setVitalsData({
                    ...vitalsData,
                    weight: {
                      ...vitalsData.weight!,
                      unit: value as 'kg' | 'lbs'
                    }
                  })}
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
              <Label>Do you have your blood pressure reading?</Label>
              <div className="flex gap-2 mt-2 items-center">
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
                  className="flex-1"
                />
                <span className="text-lg">/</span>
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
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">mmHg</span>
              </div>
            </div>
          </div>
        );

      case 'status':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">How are you feeling right now?</Label>
              <Textarea
                id="status"
                value={statusInput}
                onChange={(e) => {
                  setStatusInput(e.target.value);
                  setVitalsData({ ...vitalsData, currentStatus: e.target.value });
                }}
                placeholder="Describe how you're feeling..."
                className="mt-2 min-h-[100px]"
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

  const canSkip = ['temperature', 'weight', 'bloodPressure'].includes(currentStep);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{getStepTitle()}</CardTitle>
        <CardDescription>
          Step {currentStepIndex + 1} of {TOTAL_STEPS}
        </CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {renderStep()}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          {canSkip && (
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              I don't have it
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : currentStepIndex === TOTAL_STEPS - 1 ? 'Complete' : 'Next'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
