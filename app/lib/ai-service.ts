import { AgentResponse, Message, MedicalData } from "../types";

export type AIProvider = 'gemini' | 'openai';

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'openai') return 'openai';
  return 'gemini'; // default
}

// Lazy-loaded service instances to avoid loading both SDKs
let serviceInstance: any = null;
let currentProvider: AIProvider | null = null;

async function getService(): Promise<any> {
  const provider = getAIProvider();
  
  // Return cached instance if provider hasn't changed
  if (serviceInstance && currentProvider === provider) {
    return serviceInstance;
  }
  
  currentProvider = provider;
  
  if (provider === 'openai') {
    const { OpenAIService } = await import('./openai-service');
    serviceInstance = new OpenAIService();
  } else {
    const { GeminiService } = await import('./gemini-service');
    serviceInstance = new GeminiService();
  }
  
  return serviceInstance;
}

export async function sendAIMessage(
  history: Message[],
  currentMedicalData: MedicalData,
  mode: 'patient' | 'doctor' = 'patient'
): Promise<{ response: AgentResponse; groundingMetadata?: any }> {
  const service = await getService();
  return service.sendMessage(history, currentMedicalData, mode);
}

export { getAIProvider as getCurrentProvider };
