import { env } from "@/env";
import type { AgentResponse, Message, MedicalData, SBAR, TrackingState } from "@/types";

export type AIProvider = 'gemini' | 'openai';

export function getAIProvider(): AIProvider {
  const provider = env.AI_PROVIDER?.toLowerCase();
  if (provider === 'openai') return 'openai';
  return 'gemini'; // default
}

// Lazy-loaded service instances
let geminiServiceInstance: any = null;
let openaiServiceInstance: any = null;

async function getGeminiService() {
  if (!geminiServiceInstance) {
    const { GeminiService } = await import('./gemini');
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
}

async function getOpenAIService() {
  if (!openaiServiceInstance) {
    const { OpenAIService } = await import('./openai');
    openaiServiceInstance = new OpenAIService();
  }
  return openaiServiceInstance;
}

export async function sendAIMessage(
  history: Message[],
  currentMedicalData: MedicalData,
  mode: 'patient' | 'doctor' = 'patient',
  trackingState?: TrackingState
): Promise<{ response: AgentResponse; groundingMetadata?: unknown; retryCount?: number; wasRecovered?: boolean }> {
  const provider = getAIProvider();
  
  if (provider === 'openai') {
    const service = await getOpenAIService();
    return service.sendMessage(history, currentMedicalData, mode, trackingState);
  } else {
    const service = await getGeminiService();
    return service.sendMessage(history, currentMedicalData, mode, trackingState);
  }
}

export async function generateClinicalHandover(medicalData: MedicalData): Promise<SBAR> {
  const provider = getAIProvider();
  
  if (provider === 'openai') {
    const service = await getOpenAIService();
    return service.generateClinicalHandover(medicalData);
  } else {
    const service = await getGeminiService();
    return service.generateClinicalHandover(medicalData);
  }
}

// Re-export for backward compatibility
export { getAIProvider as getCurrentProvider };
