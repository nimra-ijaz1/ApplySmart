export type DocumentCheckItemStatus = 'ready' | 'expired' | 'missing';

export interface VaultDocumentSummary {
  id: number;
  category: string;
  title: string;
  fileName: string;
  expirationDate?: string | null;
  uploadedAt?: string | Date;
}

export interface DocumentCheckItem {
  requiredDocument: string;
  suggestedCategory: string;
  status: DocumentCheckItemStatus;
  matchedDocuments: Array<{
    id: number;
    title: string;
    category: string;
    fileName: string;
    expirationDate: string | null;
    isExpired: boolean;
  }>;
  reason: string;
}

export interface DocumentReadinessResult {
  overallStatus: 'all_ready' | 'action_required';
  totalRequired: number;
  readyCount: number;
  expiredCount: number;
  missingCount: number;
  readinessPercentage: number;
  items: DocumentCheckItem[];
}

const CATEGORY_SYNONYMS: Array<{
  category: string;
  keywords: string[];
}> = [
  {
    category: 'Passport',
    keywords: ['passport', 'national id', 'travel document'],
  },
  {
    category: 'CV / Resume',
    keywords: ['cv', 'resume', 'curriculum vitae'],
  },
  {
    category: 'Academic transcripts',
    keywords: ['transcript', 'marksheet', 'mark sheet', 'grade sheet', 'hec'],
  },
  {
    category: 'Degree certificate',
    keywords: ['degree certificate', 'bachelor degree', 'master degree', 'diploma', 'provisional certificate'],
  },
  {
    category: 'IELTS certificate',
    keywords: ['ielts', 'language certificate', 'english proficiency'],
  },
  {
    category: 'TOEFL certificate',
    keywords: ['toefl'],
  },
  {
    category: 'Recommendation letters',
    keywords: ['recommendation', 'reference letter', 'lor', 'referee'],
  },
  {
    category: 'Statement of Purpose',
    keywords: ['statement of purpose', 'sop', 'personal statement'],
  },
  {
    category: 'Motivation letter',
    keywords: ['motivation letter', 'letter of motivation', 'cover letter'],
  },
  {
    category: 'Research proposal',
    keywords: ['research proposal', 'study plan', 'thesis proposal'],
  },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function inferDocumentCategory(requiredDoc: string): string {
  const norm = normalizeText(requiredDoc);
  for (const entry of CATEGORY_SYNONYMS) {
    if (entry.keywords.some((kw) => norm.includes(kw))) {
      return entry.category;
    }
  }
  return 'Other documents';
}

function isDocumentExpired(expirationDate: string | null | undefined, refDate: Date): boolean {
  if (!expirationDate) return false;
  const parsed = new Date(`${expirationDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayStr = refDate.toISOString().slice(0, 10);
  return expirationDate < todayStr;
}

function matchesRequiredDocument(requiredDoc: string, doc: VaultDocumentSummary): boolean {
  const normReq = normalizeText(requiredDoc);
  const normCat = normalizeText(doc.category);
  const normTitle = normalizeText(doc.title);
  const normFile = normalizeText(doc.fileName);

  // Direct substring match against title, category, or filename
  if (
    normTitle.includes(normReq) ||
    normReq.includes(normTitle) ||
    normFile.includes(normReq) ||
    (normCat !== 'other documents' && (normCat.includes(normReq) || normReq.includes(normCat)))
  ) {
    return true;
  }

  // Synonym group match: if requiredDoc falls into a canonical category, match any vault doc in that category
  // or whose title/filename includes a synonym keyword
  for (const entry of CATEGORY_SYNONYMS) {
    const reqMatchesGroup = entry.keywords.some((kw) => normReq.includes(kw));
    if (!reqMatchesGroup) continue;

    if (normalizeText(entry.category) === normCat) {
      return true;
    }
    if (entry.keywords.some((kw) => normTitle.includes(kw) || normFile.includes(kw))) {
      return true;
    }
  }

  // Token overlap fallback for specialized docs like "VPD Certificate", "APS", "GRE Score"
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'certificate',
    'letter',
    'letters',
    'document',
    'documents',
    'copy',
    'official',
    'valid',
    'attested',
    'proof',
    'form',
  ]);
  const reqTokens = normReq
    .split(' ')
    .filter((t) => t.length >= 3 && !stopWords.has(t));
  if (reqTokens.length > 0) {
    const haystack = `${normTitle} ${normFile}`;
    const matchedTokens = reqTokens.filter((t) => haystack.includes(t));
    if (matchedTokens.length >= Math.min(2, reqTokens.length) || (reqTokens.length === 1 && matchedTokens.length === 1)) {
      return true;
    }
  }

  return false;
}

export function evaluateRequiredDocuments(
  requiredDocuments: string[],
  vaultDocuments: VaultDocumentSummary[],
  referenceDate: Date = new Date()
): DocumentReadinessResult {
  const uniqueRequired = Array.from(
    new Set(requiredDocuments.map((d) => d.trim()).filter(Boolean))
  );

  const items: DocumentCheckItem[] = uniqueRequired.map((reqDoc) => {
    const suggestedCategory = inferDocumentCategory(reqDoc);
    const matched = vaultDocuments.filter((doc) => matchesRequiredDocument(reqDoc, doc));

    if (matched.length === 0) {
      return {
        requiredDocument: reqDoc,
        suggestedCategory,
        status: 'missing',
        matchedDocuments: [],
        reason: `No uploaded file in your Document Vault matches "${reqDoc}". Upload it under "${suggestedCategory}".`,
      };
    }

    const enrichedMatches = matched.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      fileName: doc.fileName,
      expirationDate: doc.expirationDate ?? null,
      isExpired: isDocumentExpired(doc.expirationDate, referenceDate),
    }));

    const hasValidDoc = enrichedMatches.some((m) => !m.isExpired);

    if (!hasValidDoc) {
      return {
        requiredDocument: reqDoc,
        suggestedCategory,
        status: 'expired',
        matchedDocuments: enrichedMatches,
        reason: `Matching document "${enrichedMatches[0].title}" expired on ${enrichedMatches[0].expirationDate}. Upload a renewed copy.`,
      };
    }

    const activeDoc = enrichedMatches.find((m) => !m.isExpired)!;
    return {
      requiredDocument: reqDoc,
      suggestedCategory,
      status: 'ready',
      matchedDocuments: enrichedMatches,
      reason: `Covered by "${activeDoc.title}" (${activeDoc.category}).`,
    };
  });

  const totalRequired = items.length;
  const readyCount = items.filter((i) => i.status === 'ready').length;
  const expiredCount = items.filter((i) => i.status === 'expired').length;
  const missingCount = items.filter((i) => i.status === 'missing').length;
  const readinessPercentage =
    totalRequired === 0 ? 100 : Math.round((readyCount / totalRequired) * 100);

  return {
    overallStatus: missingCount === 0 && expiredCount === 0 ? 'all_ready' : 'action_required',
    totalRequired,
    readyCount,
    expiredCount,
    missingCount,
    readinessPercentage,
    items,
  };
}
