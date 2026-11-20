import { GoogleGenAI, Type } from '@google/genai';
import type { EligibilityEvaluationResult } from './eligibilityEngine.ts';

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isAiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim() !== '');
}

export async function explainEligibilityWithAI(params: {
  universityName: string;
  programmeName: string;
  degreeLevel: string;
  evaluation: EligibilityEvaluationResult;
  sourceUrl: string;
}): Promise<{ explanation: string | null; aiConfigured: boolean; error?: string }> {
  const ai = getClient();
  if (!ai) {
    return {
      explanation: null,
      aiConfigured: false,
      error: 'GEMINI_API_KEY is not configured in environment variables. Showing deterministic eligibility results only.',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Explain this deterministic university eligibility assessment in clear, encouraging, accurate English for an international applicant.

University: ${params.universityName}
Programme: ${params.programmeName} (${params.degreeLevel})
Overall Result: ${params.evaluation.summaryLabel}
Source URL: ${params.sourceUrl}

Deterministic Criteria Breakdown:
${JSON.stringify(params.evaluation.criteria, null, 2)}

Instructions:
- Only cite facts from the deterministic breakdown above. Never invent additional admission criteria.
- Clearly distinguish between items that passed, items that failed, items needing manual verification (like scale conversions), and missing profile fields.
- Remind the student that meeting minimum listed requirements does not guarantee admission and cite the official source URL (${params.sourceUrl}).
- Keep it concise (3-4 short paragraphs or bullet points).`,
      config: {
        systemInstruction:
          'You are ApplySmart Eligibility Explainer. You translate deterministic admission rule evaluations into clear student guidance without fabricating requirements or guaranteeing admission.',
      },
    });

    return {
      explanation: response.text ?? 'Unable to generate explanation.',
      aiConfigured: true,
    };
  } catch (err: unknown) {
    console.error('Gemini API error in explainEligibilityWithAI:', err);
    return {
      explanation: null,
      aiConfigured: true,
      error: 'AI explanation temporarily unavailable. Deterministic eligibility breakdown remains accurate.',
    };
  }
}

export async function analyzeDocumentWithAI(params: {
  fileName: string;
  extractedText: string;
}): Promise<{
  aiConfigured: boolean;
  analysis: Record<string, unknown> | null;
  error?: string;
}> {
  const ai = getClient();
  if (!ai) {
    return {
      aiConfigured: false,
      analysis: null,
      error: 'GEMINI_API_KEY is not configured. Document uploaded securely, but AI requirement extraction is unavailable until an API key is configured.',
    };
  }

  if (!params.extractedText || params.extractedText.trim().length < 20) {
    return {
      aiConfigured: true,
      analysis: null,
      error: 'Could not extract readable text from this file to analyze requirements.',
    };
  }

  try {
    const truncated = params.extractedText.slice(0, 24000);
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Analyze the following uploaded university admission document (${params.fileName}) and extract structured admission information strictly from the text provided. If a field is not explicitly stated in the text, return null or an empty array—never invent values.

Document Text:
${truncated}`,
      config: {
        systemInstruction:
          'You extract structured university admission requirements strictly from provided document text. Never guess or hallucinate missing deadlines, GPA cutoffs, or IELTS scores.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            universityName: { type: Type.STRING, description: 'University name if stated, else empty string' },
            programmeName: { type: Type.STRING, description: 'Programme name if stated, else empty string' },
            minimumGpa: { type: Type.STRING, description: 'Explicit minimum GPA/CGPA or percentage stated' },
            languageRequirements: { type: Type.STRING, description: 'IELTS/TOEFL/DET requirements stated' },
            applicationDeadlines: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Any application opening or deadline dates found',
            },
            requiredDocuments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of required application documents',
            },
            importantConditions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Important conditions, prerequisites, or caveats',
            },
            summary: { type: Type.STRING, description: 'Brief 2-sentence factual summary of the document' },
          },
        },
      },
    });

    const raw = (response.text ?? '{}').trim();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      aiConfigured: true,
      analysis: {
        ...parsed,
        needsUserConfirmation: true,
        disclaimer: 'Extracted by AI from uploaded file. Please confirm before relying on these details.',
      },
    };
  } catch (err: unknown) {
    console.error('Gemini API error in analyzeDocumentWithAI:', err);
    return {
      aiConfigured: true,
      analysis: null,
      error: 'Failed to analyze document text with AI.',
    };
  }
}

export async function chatWithAssistantAI(params: {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  studentProfileSummary: string | null;
  verifiedDatabaseContext: string;
}): Promise<{
  aiConfigured: boolean;
  reply: string | null;
  error?: string;
}> {
  const ai = getClient();
  if (!ai) {
    return {
      aiConfigured: false,
      reply: null,
      error: 'GEMINI_API_KEY is not configured in environment variables. Please configure it in Settings > Secrets to enable the AI Study Abroad Assistant.',
    };
  }

  try {
    const historyBlock = params.history
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = `Verified ApplySmart Database Records (use these as primary factual sources and cite their sourceUrl):
${params.verifiedDatabaseContext}

${params.studentProfileSummary ? `Logged-in Student Profile Context (shared with student permission):\n${params.studentProfileSummary}` : 'Student Profile Context: Not shared for this conversation.'}

Recent Conversation:
${historyBlock}

Student Question:
${params.message}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction: `You are ApplySmart's AI Study Abroad Assistant helping international students (primarily Pakistani applicants and global students) plan university applications.
STRICT SAFETY & RELIABILITY RULES:
1. NEVER invent admission requirements, tuition fees, scholarships, or deadlines. Only state university-specific facts present in the Verified ApplySmart Database Records provided above.
2. Always include the official sourceUrl when citing specific university, programme, or scholarship facts.
3. If information is missing or marked outdated/pending verification, explicitly warn the student.
4. Clearly distinguish between verified official data from the database and general AI study-abroad advice (e.g., SOP structure tips, checklist suggestions).
5. NEVER guarantee admissions or scholarships, and do not present AI guidance as an official admission decision.`,
      },
    });

    return {
      aiConfigured: true,
      reply: response.text ?? 'I could not generate a response. Please try again.',
    };
  } catch (err: unknown) {
    console.error('Gemini API error in chatWithAssistantAI:', err);
    return {
      aiConfigured: true,
      reply: null,
      error: 'AI Assistant request failed. Please try again shortly.',
    };
  }
}

export async function compareProgrammesWithAI(params: {
  programmesSummary: string;
  studentProfileSummary: string | null;
}): Promise<{ aiConfigured: boolean; comparison: string | null; error?: string }> {
  const ai = getClient();
  if (!ai) {
    return {
      aiConfigured: false,
      comparison: null,
      error: 'GEMINI_API_KEY is not configured. Structured comparison table remains available.',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Compare these verified university programmes side-by-side based strictly on the provided fields. Highlight key differences in tuition, CGPA/IELTS requirements, deadlines, and scholarship options.

Programmes:
${params.programmesSummary}

${params.studentProfileSummary ? `Student Context:\n${params.studentProfileSummary}` : ''}`,
      config: {
        systemInstruction:
          'You compare verified university programmes factually. Never invent fees, deadlines, or admission chances. Always cite official programme URLs.',
      },
    });

    return {
      aiConfigured: true,
      comparison: response.text ?? null,
    };
  } catch (err: unknown) {
    console.error('Gemini API error in compareProgrammesWithAI:', err);
    return {
      aiConfigured: true,
      comparison: null,
      error: 'AI comparison summary unavailable right now.',
    };
  }
}
