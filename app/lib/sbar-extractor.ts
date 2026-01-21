/**
 * SBAR Content Extraction Utility
 * 
 * Extracts and formats clinical analysis content into SBAR structure
 * (Situation, Background, Assessment, Recommendation)
 */

export type AnalysisType = 'summary' | 'soap' | 'action_items' | 'risk_assessment';

export interface SBARContent {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  type: AnalysisType;
  generatedAt: number;
}

/**
 * Fallback content for missing SBAR sections
 */
const FALLBACK_CONTENT = {
  situation: 'Clinical situation being assessed...',
  background: 'Patient background information pending...',
  assessment: 'Clinical assessment in progress...',
  recommendation: 'Treatment recommendations to follow...',
};

/**
 * Cache for memoized extraction results
 */
const extractionCache = new Map<string, SBARContent>();
const MAX_CACHE_SIZE = 50;

/**
 * Generate cache key for memoization
 */
function getCacheKey(rawContent: string, analysisType: AnalysisType): string {
  // Use first 100 and last 100 chars plus type for cache key
  // This balances uniqueness with performance
  const contentHash = rawContent.length > 200 
    ? rawContent.slice(0, 100) + rawContent.slice(-100) + rawContent.length
    : rawContent;
  return `${analysisType}:${contentHash}`;
}

/**
 * Extract SBAR content from AI-generated analysis text
 * Memoized to prevent redundant extraction operations
 */
export function extractSBARContent(
  rawContent: string,
  analysisType: AnalysisType
): SBARContent {
  // Check cache first
  const cacheKey = getCacheKey(rawContent, analysisType);
  const cached = extractionCache.get(cacheKey);
  
  if (cached) {
    // Return cached result with updated timestamp
    return {
      ...cached,
      generatedAt: Date.now(),
    };
  }
  
  const strategy = EXTRACTION_STRATEGIES[analysisType];
  
  let extracted: Partial<SBARContent>;
  
  switch (strategy.extractionStrategy) {
    case 'sections':
      extracted = extractBySections(rawContent);
      break;
    case 'mapping':
      extracted = extractByMapping(rawContent);
      break;
    case 'focused':
      extracted = extractFocused(rawContent, analysisType);
      break;
    default:
      extracted = {};
  }
  
  // Ensure all sections have content
  const result = {
    situation: extracted.situation || FALLBACK_CONTENT.situation,
    background: extracted.background || FALLBACK_CONTENT.background,
    assessment: extracted.assessment || FALLBACK_CONTENT.assessment,
    recommendation: extracted.recommendation || FALLBACK_CONTENT.recommendation,
    type: analysisType,
    generatedAt: Date.now(),
  };
  
  // Store in cache (with size limit)
  if (extractionCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key)
    const firstKey = extractionCache.keys().next().value;
    if (firstKey) {
      extractionCache.delete(firstKey);
    }
  }
  extractionCache.set(cacheKey, result);
  
  return result;
}

/**
 * Extraction strategies for different analysis types
 */
const EXTRACTION_STRATEGIES: Record<AnalysisType, {
  extractionStrategy: 'sections' | 'mapping' | 'focused';
}> = {
  summary: {
    extractionStrategy: 'sections',
  },
  soap: {
    extractionStrategy: 'mapping',
  },
  action_items: {
    extractionStrategy: 'focused',
  },
  risk_assessment: {
    extractionStrategy: 'focused',
  },
};

/**
 * Extract SBAR sections directly from markdown with SBAR headers
 */
function extractBySections(content: string): Partial<SBARContent> {
  const sections: Partial<SBARContent> = {};
  
  // Pattern to match SBAR section headers (case-insensitive, with or without ##)
  const situationMatch = content.match(/##?\s*Situation[:\s]+(.*?)(?=##?\s*Background|##?\s*Assessment|##?\s*Recommendation|$)/is);
  const backgroundMatch = content.match(/##?\s*Background[:\s]+(.*?)(?=##?\s*Assessment|##?\s*Recommendation|$)/is);
  const assessmentMatch = content.match(/##?\s*Assessment[:\s]+(.*?)(?=##?\s*Recommendation|$)/is);
  const recommendationMatch = content.match(/##?\s*Recommendation[:\s]+(.*?)$/is);
  
  if (situationMatch) {
    sections.situation = cleanContent(situationMatch[1]);
  }
  if (backgroundMatch) {
    sections.background = cleanContent(backgroundMatch[1]);
  }
  if (assessmentMatch) {
    sections.assessment = cleanContent(assessmentMatch[1]);
  }
  if (recommendationMatch) {
    sections.recommendation = cleanContent(recommendationMatch[1]);
  }
  
  return sections;
}

/**
 * Map SOAP sections to SBAR structure
 * Subjective → Situation
 * Objective → Background
 * Assessment → Assessment
 * Plan → Recommendation
 */
function extractByMapping(content: string): Partial<SBARContent> {
  const sections: Partial<SBARContent> = {};
  
  // Extract SOAP sections
  const subjectiveMatch = content.match(/##?\s*(?:Subjective|S)[:\s]+(.*?)(?=##?\s*(?:Objective|O)|##?\s*(?:Assessment|A)|##?\s*(?:Plan|P)|$)/is);
  const objectiveMatch = content.match(/##?\s*(?:Objective|O)[:\s]+(.*?)(?=##?\s*(?:Assessment|A)|##?\s*(?:Plan|P)|$)/is);
  const assessmentMatch = content.match(/##?\s*(?:Assessment|A)[:\s]+(.*?)(?=##?\s*(?:Plan|P)|$)/is);
  const planMatch = content.match(/##?\s*(?:Plan|P)[:\s]+(.*?)$/is);
  
  // Map to SBAR
  if (subjectiveMatch) {
    sections.situation = cleanContent(subjectiveMatch[1]);
  }
  if (objectiveMatch) {
    sections.background = cleanContent(objectiveMatch[1]);
  }
  if (assessmentMatch) {
    sections.assessment = cleanContent(assessmentMatch[1]);
  }
  if (planMatch) {
    sections.recommendation = cleanContent(planMatch[1]);
  }
  
  return sections;
}

/**
 * Extract focused content for action_items and risk_assessment
 */
function extractFocused(content: string, type: AnalysisType): Partial<SBARContent> {
  const sections: Partial<SBARContent> = {};
  
  if (type === 'action_items') {
    // Action items go in recommendation section
    sections.situation = 'Action items from consultation';
    sections.background = 'Based on current appointment discussion';
    sections.assessment = 'Items requiring follow-up';
    sections.recommendation = cleanContent(content);
  } else if (type === 'risk_assessment') {
    // Risk assessment goes in assessment section
    sections.situation = 'Risk assessment review';
    sections.background = 'Patient risk factors identified';
    sections.assessment = cleanContent(content);
    sections.recommendation = 'Recommended risk mitigation steps';
  }
  
  return sections;
}

/**
 * Clean and format extracted content
 */
function cleanContent(content: string): string {
  return content
    .trim()
    .replace(/^\s*[-*]\s*/gm, '• ') // Convert markdown lists to bullets
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .replace(/^#+\s+/gm, '') // Remove any remaining markdown headers
    .trim();
}
