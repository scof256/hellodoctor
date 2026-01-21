'use client';

import { AlertTriangle, Phone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EmergencyAlertProps {
  reason: string;
  recommendations: string[];
  emergencyNumbers?: {
    label: string;
    number: string;
  }[];
}

export function EmergencyAlert({ 
  reason, 
  recommendations,
  emergencyNumbers = [
    { label: 'Emergency Services', number: '911' },
    { label: 'Local Emergency', number: '112' }
  ]
}: EmergencyAlertProps) {
  const handleCallEmergency = (number: string) => {
    if (typeof window !== 'undefined' && 'navigator' in window) {
      // Check if on mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = `tel:${number}`;
      }
    }
  };

  return (
    <Card className="border-destructive bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <CardTitle className="text-destructive">Immediate Medical Attention Required</CardTitle>
        </div>
        <CardDescription className="text-destructive/80">
          Based on the information you've provided, we recommend seeking immediate medical care.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Why this is urgent</AlertTitle>
          <AlertDescription>{reason}</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm">What to do now:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Emergency Contacts:</h4>
          <div className="flex flex-col gap-2">
            {emergencyNumbers.map((contact, index) => (
              <Button
                key={index}
                variant="destructive"
                className="w-full justify-start"
                onClick={() => handleCallEmergency(contact.number)}
              >
                <Phone className="h-4 w-4 mr-2" />
                {contact.label}: {contact.number}
              </Button>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-md">
          <p className="font-semibold mb-1">Important:</p>
          <p>
            If you are experiencing a life-threatening emergency, call emergency services immediately 
            or go to the nearest emergency room. Do not wait for an online consultation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
