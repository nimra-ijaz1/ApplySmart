import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  dataSources,
  programmeRequirements,
  programmes,
  universities,
} from '../../db/schema.ts';

export type CsvEntityType = 'universities' | 'programmes';

export interface CsvRowValidationResult {
  rowNumber: number;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  isDuplicateInDb: boolean;
  resolvedUniversityId?: number;
  resolvedUniversityName?: string;
  raw: Record<string, string>;
  normalized: Record<string, unknown> | null;
}

export interface CsvValidationReport {
  entityType: CsvEntityType;
  headers: string[];
  missingRequiredHeaders: string[];
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    duplicateRows: number;
  };
  rows: CsvRowValidationResult[];
}

const VALID_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(val: string): boolean {
  if (!VALID_DATE_REGEX.test(val)) return false;
  const d = new Date(`${val}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
}

function isValidHttpUrl(val: string): boolean {
  try {
    const parsed = new URL(val);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseBooleanCell(raw: string | undefined, defaultValue: boolean): { value: boolean; valid: boolean } {
  if (!raw || raw.trim() === '') return { value: defaultValue, valid: true };
  const norm = raw.trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(norm)) return { value: true, valid: true };
  if (['false', 'no', '0', 'n'].includes(norm)) return { value: false, valid: true };
  return { value: defaultValue, valid: false };
}

function splitListCell(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  const separator = raw.includes(';') ? ';' : raw.includes('|') ? '|' : ',';
  return raw
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * RFC-4180 compliant CSV parser supporting quoted commas, escaped quotes (""),
 * multiline cells inside quotes, CRLF/LF line endings, and UTF-8 BOM.
 */
export function parseCsvContent(csvText: string): { headers: string[]; records: Array<Record<string, string>> } {
  const clean = csvText.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== '')) {
        matrix.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== '')) {
        matrix.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== '')) {
      matrix.push(currentRow);
    }
  }

  if (matrix.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = matrix[0].map(normalizeHeader);
  const records: Array<Record<string, string>> = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      record[key] = row[c] ?? '';
    }
    records.push(record);
  }

  return { headers, records };
}

const universityRowSchema = z.object({
  name: z.string().min(2, 'University name must be at least 2 characters').max(200),
  country: z.string().min(2, 'Country is required').max(100),
  city: z.string().min(2, 'City is required').max(100),
  officialWebsite: z.string().refine(isValidHttpUrl, 'official_website must be a valid http(s) URL'),
  logoUrl: z
    .string()
    .nullable()
    .refine((v) => v === null || isValidHttpUrl(v), 'logo_url must be a valid http(s) URL'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(3000),
  institutionType: z.enum(['Public', 'Private']),
  globalRanking: z.number().int().positive().max(5000).nullable(),
  contactEmail: z.string().email('contact_email must be a valid email').nullable(),
  contactPhone: z.string().max(40).nullable(),
  sourceUrl: z.string().refine(isValidHttpUrl, 'source_url must be a valid http(s) URL'),
  lastVerifiedDate: z.string().refine(isValidIsoDate, 'last_verified_date must use YYYY-MM-DD format'),
  verificationStatus: z.enum(['verified', 'pending_verification', 'outdated']),
});

const DEGREE_LEVEL_ALIASES: Record<string, "Bachelor's" | "Master's" | 'PhD'> = {
  bachelor: "Bachelor's",
  bachelors: "Bachelor's",
  "bachelor's": "Bachelor's",
  bsc: "Bachelor's",
  ba: "Bachelor's",
  undergraduate: "Bachelor's",
  master: "Master's",
  masters: "Master's",
  "master's": "Master's",
  msc: "Master's",
  ms: "Master's",
  ma: "Master's",
  postgraduate: "Master's",
  phd: 'PhD',
  doctorate: 'PhD',
  doctoral: 'PhD',
};

function normalizeDegreeLevel(raw: string): "Bachelor's" | "Master's" | 'PhD' | null {
  const key = raw.trim().toLowerCase();
  return DEGREE_LEVEL_ALIASES[key] ?? null;
}

function parseOptionalNumber(raw: string | undefined, label: string, errors: string[]): number | null {
  if (!raw || raw.trim() === '') return null;
  const num = Number(raw.trim());
  if (Number.isNaN(num)) {
    errors.push(`${label} must be a valid number (got "${raw}")`);
    return null;
  }
  return num;
}

export async function validateCsvImport(
  entityType: CsvEntityType,
  csvText: string
): Promise<CsvValidationReport> {
  const { headers, records } = parseCsvContent(csvText);
  const today = new Date().toISOString().slice(0, 10);

  if (entityType === 'universities') {
    const required = ['name', 'country', 'city'];
    const hasWebsiteHeader = headers.includes('official_website') || headers.includes('website');
    const missingRequiredHeaders = required.filter((h) => !headers.includes(h));
    if (!hasWebsiteHeader) missingRequiredHeaders.push('official_website');

    const existingUnis = await db
      .select({ id: universities.id, name: universities.name, country: universities.country })
      .from(universities);
    const existingUniMap = new Map<string, number>();
    for (const u of existingUnis) {
      existingUniMap.set(`${u.name.trim().toLowerCase()}::${u.country.trim().toLowerCase()}`, u.id);
    }

    const seenInCsv = new Set<string>();
    const rows: CsvRowValidationResult[] = records.map((raw, idx) => {
      const rowNumber = idx + 2; // 1-indexed including header row
      const errors: string[] = [];
      const warnings: string[] = [];

      const name = raw.name || '';
      const country = raw.country || '';
      const city = raw.city || '';
      const officialWebsite = raw.official_website || raw.website || '';
      const sourceUrl = raw.source_url || officialWebsite;
      if (!raw.source_url && officialWebsite) {
        warnings.push('source_url omitted; defaulted to official_website.');
      }

      const rawType = (raw.institution_type || 'Public').trim();
      const institutionType =
        rawType.toLowerCase() === 'private'
          ? 'Private'
          : rawType.toLowerCase() === 'public' || rawType === ''
            ? 'Public'
            : null;
      if (!institutionType) {
        errors.push(`institution_type must be "Public" or "Private" (got "${rawType}")`);
      }

      const globalRanking = parseOptionalNumber(raw.global_ranking, 'global_ranking', errors);
      if (globalRanking !== null && (!Number.isInteger(globalRanking) || globalRanking <= 0)) {
        errors.push('global_ranking must be a positive integer');
      }

      const rawVerif = (raw.verification_status || 'pending_verification').trim().toLowerCase();
      const verificationStatus = ['verified', 'pending_verification', 'outdated'].includes(rawVerif)
        ? (rawVerif as 'verified' | 'pending_verification' | 'outdated')
        : null;
      if (!verificationStatus) {
        errors.push(
          `verification_status must be verified, pending_verification, or outdated (got "${raw.verification_status}")`
        );
      }

      const description =
        raw.description && raw.description.trim().length > 0
          ? raw.description.trim()
          : `${name || 'Institution'} located in ${city || 'campus'}, ${country || 'international'}.`;
      if (!raw.description || raw.description.trim().length < 10) {
        warnings.push('description missing or shorter than 10 characters; generated fallback description.');
      }

      const lastVerifiedDate = raw.last_verified_date || today;
      if (!raw.last_verified_date) {
        warnings.push(`last_verified_date omitted; defaulted to ${today}.`);
      }

      const candidate = {
        name: name.trim(),
        country: country.trim(),
        city: city.trim(),
        officialWebsite: officialWebsite.trim(),
        logoUrl: raw.logo_url ? raw.logo_url.trim() : null,
        description,
        institutionType: institutionType ?? 'Public',
        globalRanking,
        contactEmail: raw.contact_email ? raw.contact_email.trim() : null,
        contactPhone: raw.contact_phone ? raw.contact_phone.trim() : null,
        sourceUrl: sourceUrl.trim(),
        lastVerifiedDate,
        verificationStatus: verificationStatus ?? 'pending_verification',
      };

      const zodRes = universityRowSchema.safeParse(candidate);
      if (!zodRes.success) {
        for (const issue of zodRes.error.issues) {
          errors.push(issue.message);
        }
      }

      const dedupeKey = `${candidate.name.toLowerCase()}::${candidate.country.toLowerCase()}`;
      if (candidate.name && candidate.country) {
        if (seenInCsv.has(dedupeKey)) {
          errors.push(`Duplicate university "${candidate.name}" (${candidate.country}) within this CSV file.`);
        }
        seenInCsv.add(dedupeKey);
      }

      const existingId = existingUniMap.get(dedupeKey);
      const isDuplicateInDb = existingId !== undefined;
      if (isDuplicateInDb) {
        warnings.push(`Already exists in PostgreSQL (University #${existingId}).`);
      }

      const uniqueErrors = Array.from(new Set(errors));
      const uniqueWarnings = Array.from(new Set(warnings));
      const status: CsvRowValidationResult['status'] =
        uniqueErrors.length > 0 ? 'error' : uniqueWarnings.length > 0 ? 'warning' : 'valid';

      return {
        rowNumber,
        status,
        errors: uniqueErrors,
        warnings: uniqueWarnings,
        isDuplicateInDb,
        resolvedUniversityId: existingId,
        resolvedUniversityName: isDuplicateInDb ? candidate.name : undefined,
        raw,
        normalized: uniqueErrors.length === 0 ? candidate : null,
      };
    });

    return {
      entityType,
      headers,
      missingRequiredHeaders,
      summary: {
        totalRows: rows.length,
        validRows: rows.filter((r) => r.status === 'valid').length,
        warningRows: rows.filter((r) => r.status === 'warning').length,
        errorRows: rows.filter((r) => r.status === 'error').length,
        duplicateRows: rows.filter((r) => r.isDuplicateInDb).length,
      },
      rows,
    };
  }

  // --- PROGRAMMES VALIDATION ---
  const requiredProgHeaders = [
    'name',
    'degree_level',
    'subject_area',
    'duration',
    'tuition_fee',
    'currency',
    'intake',
    'official_programme_url',
  ];
  const missingRequiredHeaders = requiredProgHeaders.filter((h) => !headers.includes(h));
  if (!headers.includes('university_name') && !headers.includes('university_id')) {
    missingRequiredHeaders.unshift('university_name (or university_id)');
  }

  const [existingUnis, existingProgs] = await Promise.all([
    db.select({ id: universities.id, name: universities.name, country: universities.country }).from(universities),
    db
      .select({
        id: programmes.id,
        universityId: programmes.universityId,
        name: programmes.name,
        degreeLevel: programmes.degreeLevel,
      })
      .from(programmes),
  ]);

  const uniById = new Map<number, { id: number; name: string }>();
  const uniByName = new Map<string, { id: number; name: string }>();
  for (const u of existingUnis) {
    uniById.set(u.id, u);
    uniByName.set(u.name.trim().toLowerCase(), u);
  }

  const existingProgKeys = new Set<string>();
  for (const p of existingProgs) {
    existingProgKeys.add(`${p.universityId}::${p.name.trim().toLowerCase()}::${p.degreeLevel.toLowerCase()}`);
  }

  const seenProgCsv = new Set<string>();
  const rows: CsvRowValidationResult[] = records.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Resolve foreign key university_id / university_name
    let matchedUni: { id: number; name: string } | undefined;
    if (raw.university_id && raw.university_id.trim() !== '') {
      const parsedId = Number(raw.university_id.trim());
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        errors.push(`university_id must be a positive integer (got "${raw.university_id}")`);
      } else {
        matchedUni = uniById.get(parsedId);
        if (!matchedUni) {
          errors.push(`Foreign key error: university_id ${parsedId} does not exist in PostgreSQL.`);
        }
      }
    } else if (raw.university_name && raw.university_name.trim() !== '') {
      matchedUni = uniByName.get(raw.university_name.trim().toLowerCase());
      if (!matchedUni) {
        errors.push(
          `Foreign key error: University "${raw.university_name}" not found in PostgreSQL. Import the university first.`
        );
      }
    } else {
      errors.push('Either university_name or university_id is required.');
    }

    // 2. Core programme fields
    const name = (raw.name || '').trim();
    if (name.length < 2) errors.push('Programme name must be at least 2 characters.');

    const degreeLevel = normalizeDegreeLevel(raw.degree_level || '');
    if (!degreeLevel) {
      errors.push(`degree_level must be Bachelor's, Master's, or PhD (got "${raw.degree_level || ''}")`);
    }

    const subjectArea = (raw.subject_area || '').trim();
    if (subjectArea.length < 2) errors.push('subject_area is required.');

    const duration = (raw.duration || '').trim();
    if (duration.length < 2) errors.push('duration is required (e.g., "2 years").');

    const currency = (raw.currency || 'USD').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push(`currency must be a 3-letter ISO code (got "${raw.currency || ''}")`);
    }

    const tuitionFee = parseOptionalNumber(raw.tuition_fee, 'tuition_fee', errors);
    if (tuitionFee === null || !Number.isInteger(tuitionFee) || tuitionFee < 0) {
      errors.push('tuition_fee must be a non-negative integer.');
    }

    let tuitionFeeUsdApprox = parseOptionalNumber(raw.tuition_fee_usd_approx, 'tuition_fee_usd_approx', errors);
    if (tuitionFeeUsdApprox === null && tuitionFee !== null) {
      tuitionFeeUsdApprox = tuitionFee;
      if (currency !== 'USD' && tuitionFee > 0) {
        warnings.push(`tuition_fee_usd_approx omitted for ${currency}; defaulted to ${tuitionFee}.`);
      }
    } else if (tuitionFeeUsdApprox !== null && (!Number.isInteger(tuitionFeeUsdApprox) || tuitionFeeUsdApprox < 0)) {
      errors.push('tuition_fee_usd_approx must be a non-negative integer.');
    }

    const applicationFee = raw.application_fee ? parseOptionalNumber(raw.application_fee, 'application_fee', errors) : 0;
    if (applicationFee !== null && (!Number.isInteger(applicationFee) || applicationFee < 0)) {
      errors.push('application_fee must be a non-negative integer.');
    }

    const intake = (raw.intake || '').trim();
    if (intake.length < 2) errors.push('intake is required (e.g., "Fall 2026").');

    const officialProgrammeUrl = (raw.official_programme_url || '').trim();
    if (!officialProgrammeUrl || !isValidHttpUrl(officialProgrammeUrl)) {
      errors.push('official_programme_url must be a valid http(s) URL.');
    }

    const sourceUrl = (raw.source_url || officialProgrammeUrl).trim();
    if (!raw.source_url && officialProgrammeUrl) {
      warnings.push('source_url omitted; defaulted to official_programme_url.');
    } else if (sourceUrl && !isValidHttpUrl(sourceUrl)) {
      errors.push('source_url must be a valid http(s) URL.');
    }

    const openingDate = raw.application_opening_date ? raw.application_opening_date.trim() : null;
    if (openingDate && !isValidIsoDate(openingDate)) {
      errors.push(`application_opening_date must use YYYY-MM-DD format (got "${openingDate}")`);
    }

    const deadline = raw.application_deadline ? raw.application_deadline.trim() : null;
    if (deadline && !isValidIsoDate(deadline)) {
      errors.push(`application_deadline must use YYYY-MM-DD format (got "${deadline}")`);
    }

    if (openingDate && deadline && isValidIsoDate(openingDate) && isValidIsoDate(deadline) && openingDate > deadline) {
      errors.push(`application_opening_date (${openingDate}) cannot be later than application_deadline (${deadline}).`);
    }

    const lastVerifiedDate = (raw.last_verified_date || today).trim();
    if (!isValidIsoDate(lastVerifiedDate)) {
      errors.push(`last_verified_date must use YYYY-MM-DD format (got "${lastVerifiedDate}")`);
    } else if (!raw.last_verified_date) {
      warnings.push(`last_verified_date omitted; defaulted to ${today}.`);
    }

    const schAvail = parseBooleanCell(raw.scholarship_availability, false);
    if (!schAvail.valid) {
      errors.push(`scholarship_availability must be true/false or yes/no (got "${raw.scholarship_availability}")`);
    }

    const reqCompleted = parseBooleanCell(raw.requires_completed_degree, true);
    if (!reqCompleted.valid) {
      errors.push(`requires_completed_degree must be true/false (got "${raw.requires_completed_degree}")`);
    }

    // 3. Admission requirements validation
    const minCgpa = parseOptionalNumber(raw.min_cgpa, 'min_cgpa', errors);
    const cgpaScale = parseOptionalNumber(raw.cgpa_scale, 'cgpa_scale', errors) ?? 4.0;
    const minPercentage = parseOptionalNumber(raw.min_percentage, 'min_percentage', errors);

    if (cgpaScale <= 0 || cgpaScale > 100) {
      errors.push('cgpa_scale must be between 1 and 100.');
    }
    if (minCgpa !== null) {
      if (minCgpa < 0 || minCgpa > cgpaScale) {
        errors.push(`min_cgpa (${minCgpa}) cannot exceed cgpa_scale (${cgpaScale}).`);
      }
    }
    if (minPercentage !== null && (minPercentage < 0 || minPercentage > 100)) {
      errors.push('min_percentage must be between 0 and 100.');
    }

    const ieltsFields: Array<[string, number | null]> = [
      ['ielts_overall', parseOptionalNumber(raw.ielts_overall, 'ielts_overall', errors)],
      ['ielts_listening', parseOptionalNumber(raw.ielts_listening, 'ielts_listening', errors)],
      ['ielts_reading', parseOptionalNumber(raw.ielts_reading, 'ielts_reading', errors)],
      ['ielts_writing', parseOptionalNumber(raw.ielts_writing, 'ielts_writing', errors)],
      ['ielts_speaking', parseOptionalNumber(raw.ielts_speaking, 'ielts_speaking', errors)],
    ];
    for (const [fieldName, val] of ieltsFields) {
      if (val !== null) {
        if (val < 0 || val > 9) {
          errors.push(`${fieldName} must be between 0 and 9 (got ${val}).`);
        } else if (Math.round(val * 2) !== val * 2) {
          warnings.push(`${fieldName} (${val}) is not on a standard 0.5 IELTS increment.`);
        }
      }
    }

    const toeflMin = parseOptionalNumber(raw.toefl_min, 'toefl_min', errors);
    if (toeflMin !== null && (!Number.isInteger(toeflMin) || toeflMin < 0 || toeflMin > 120)) {
      errors.push('toefl_min must be an integer between 0 and 120.');
    }

    const duolingoMin = parseOptionalNumber(raw.duolingo_min, 'duolingo_min', errors);
    if (duolingoMin !== null && (!Number.isInteger(duolingoMin) || duolingoMin < 10 || duolingoMin > 160)) {
      errors.push('duolingo_min must be an integer between 10 and 160.');
    }

    const description =
      raw.description && raw.description.trim().length >= 10
        ? raw.description.trim()
        : `${name || 'Degree programme'} (${degreeLevel ?? 'Degree'}) in ${subjectArea || 'specialty'} offered by ${matchedUni?.name ?? raw.university_name ?? 'institution'}.`;
    if (!raw.description || raw.description.trim().length < 10) {
      warnings.push('description missing or shorter than 10 characters; generated summary.');
    }

    const requiredDegreeBackground =
      (raw.required_degree_background || '').trim() ||
      (degreeLevel === "Bachelor's"
        ? 'Completed higher secondary qualification (FSc / A-Levels / IB)'
        : degreeLevel === 'PhD'
          ? "Completed Master's degree in a closely related field"
          : "4-year Bachelor's degree in a related discipline");
    if (!raw.required_degree_background) {
      warnings.push('required_degree_background omitted; applied standard degree level prerequisite.');
    }

    const rawVerif = (raw.verification_status || 'pending_verification').trim().toLowerCase();
    const verificationStatus = ['verified', 'pending_verification', 'outdated'].includes(rawVerif)
      ? (rawVerif as 'verified' | 'pending_verification' | 'outdated')
      : 'pending_verification';
    if (raw.verification_status && !['verified', 'pending_verification', 'outdated'].includes(rawVerif)) {
      errors.push(`verification_status must be verified, pending_verification, or outdated.`);
    }

    // 4. Duplicate check within CSV and against PostgreSQL
    let isDuplicateInDb = false;
    if (matchedUni && name && degreeLevel) {
      const dedupeKey = `${matchedUni.id}::${name.toLowerCase()}::${degreeLevel.toLowerCase()}`;
      if (seenProgCsv.has(dedupeKey)) {
        errors.push(`Duplicate programme "${name}" (${degreeLevel}) for ${matchedUni.name} in this CSV.`);
      }
      seenProgCsv.add(dedupeKey);

      if (existingProgKeys.has(dedupeKey)) {
        isDuplicateInDb = true;
        warnings.push(`Programme "${name}" already exists for ${matchedUni.name} in PostgreSQL.`);
      }
    }

    const uniqueErrors = Array.from(new Set(errors));
    const uniqueWarnings = Array.from(new Set(warnings));
    const status: CsvRowValidationResult['status'] =
      uniqueErrors.length > 0 ? 'error' : uniqueWarnings.length > 0 ? 'warning' : 'valid';

    const normalized =
      uniqueErrors.length === 0 && matchedUni && degreeLevel && tuitionFee !== null && tuitionFeeUsdApprox !== null
        ? {
            programme: {
              universityId: matchedUni.id,
              name,
              degreeLevel,
              subjectArea,
              description,
              duration,
              studyLanguage: (raw.study_language || 'English').trim(),
              tuitionFee,
              currency,
              tuitionFeeUsdApprox,
              applicationFee: applicationFee ?? 0,
              applicationOpeningDate: openingDate,
              applicationDeadline: deadline,
              intake,
              scholarshipAvailability: schAvail.value,
              officialProgrammeUrl,
              sourceUrl,
              lastVerifiedDate,
              verificationStatus,
              isDemoRecord: false,
            },
            requirements: {
              minCgpa: minCgpa !== null ? minCgpa.toFixed(2) : null,
              cgpaScale: cgpaScale.toFixed(2),
              minPercentage: minPercentage !== null ? minPercentage.toFixed(2) : null,
              requiredDegreeBackground,
              acceptedDegreeFields: splitListCell(raw.accepted_degree_fields),
              prerequisiteSubjects: splitListCell(raw.prerequisite_subjects),
              requiresCompletedDegree: reqCompleted.value,
              ieltsOverall: ieltsFields[0][1] !== null ? ieltsFields[0][1]!.toFixed(1) : null,
              ieltsListening: ieltsFields[1][1] !== null ? ieltsFields[1][1]!.toFixed(1) : null,
              ieltsReading: ieltsFields[2][1] !== null ? ieltsFields[2][1]!.toFixed(1) : null,
              ieltsWriting: ieltsFields[3][1] !== null ? ieltsFields[3][1]!.toFixed(1) : null,
              ieltsSpeaking: ieltsFields[4][1] !== null ? ieltsFields[4][1]!.toFixed(1) : null,
              toeflMin: toeflMin ?? null,
              duolingoMin: duolingoMin ?? null,
              otherLanguageRequirements: raw.other_language_requirements?.trim() || null,
              requiredDocuments: splitListCell(raw.required_documents),
              gpaConversionNote: raw.gpa_conversion_note?.trim() || null,
              additionalConditions: raw.additional_conditions?.trim() || null,
              sourceUrl,
              lastVerifiedDate,
            },
          }
        : null;

    return {
      rowNumber,
      status,
      errors: uniqueErrors,
      warnings: uniqueWarnings,
      isDuplicateInDb,
      resolvedUniversityId: matchedUni?.id,
      resolvedUniversityName: matchedUni?.name,
      raw,
      normalized,
    };
  });

  return {
    entityType,
    headers,
    missingRequiredHeaders,
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((r) => r.status === 'valid').length,
      warningRows: rows.filter((r) => r.status === 'warning').length,
      errorRows: rows.filter((r) => r.status === 'error').length,
      duplicateRows: rows.filter((r) => r.isDuplicateInDb).length,
    },
    rows,
  };
}

export async function commitValidatedCsvImport(params: {
  entityType: CsvEntityType;
  csvText: string;
  skipDuplicates: boolean;
  skipInvalidRows: boolean;
  actorUserId: number;
}): Promise<{
  importedCount: number;
  skippedDuplicatesCount: number;
  skippedErrorRowsCount: number;
  createdIds: number[];
}> {
  const report = await validateCsvImport(params.entityType, params.csvText);

  if (report.missingRequiredHeaders.length > 0) {
    throw new Error(`Missing required CSV header(s): ${report.missingRequiredHeaders.join(', ')}`);
  }
  if (report.summary.totalRows === 0) {
    throw new Error('CSV contains no data rows to import.');
  }
  if (!params.skipInvalidRows && report.summary.errorRows > 0) {
    throw new Error(
      `Validation failed for ${report.summary.errorRows} row(s). Fix errors or enable "Import valid rows only".`
    );
  }
  if (!params.skipDuplicates && report.summary.duplicateRows > 0) {
    throw new Error(
      `${report.summary.duplicateRows} row(s) already exist in PostgreSQL. Enable "Skip existing duplicates" to proceed.`
    );
  }

  let importedCount = 0;
  let skippedDuplicatesCount = 0;
  let skippedErrorRowsCount = 0;
  const createdIds: number[] = [];

  await db.transaction(async (tx) => {
    for (const row of report.rows) {
      if (row.status === 'error' || !row.normalized) {
        skippedErrorRowsCount += 1;
        continue;
      }
      if (row.isDuplicateInDb) {
        skippedDuplicatesCount += 1;
        continue;
      }

      if (params.entityType === 'universities') {
        const data = row.normalized as {
          name: string;
          country: string;
          city: string;
          officialWebsite: string;
          logoUrl: string | null;
          description: string;
          institutionType: string;
          globalRanking: number | null;
          contactEmail: string | null;
          contactPhone: string | null;
          sourceUrl: string;
          lastVerifiedDate: string;
          verificationStatus: string;
        };

        const [created] = await tx
          .insert(universities)
          .values({
            ...data,
            isDemoRecord: false,
          })
          .returning();

        await tx.insert(dataSources).values({
          entityType: 'university',
          entityId: created.id,
          sourceUrl: created.sourceUrl,
          verificationStatus: created.verificationStatus,
          verifiedByUserId: created.verificationStatus === 'verified' ? params.actorUserId : null,
          lastVerifiedDate: created.lastVerifiedDate,
          notes: 'Imported via Admin CSV Bulk Utility.',
        });

        createdIds.push(created.id);
        importedCount += 1;
      } else {
        const payload = row.normalized as {
          programme: typeof programmes.$inferInsert;
          requirements: Omit<typeof programmeRequirements.$inferInsert, 'programmeId'>;
        };

        const [createdProg] = await tx.insert(programmes).values(payload.programme).returning();

        await tx.insert(programmeRequirements).values({
          ...payload.requirements,
          programmeId: createdProg.id,
        });

        await tx.insert(dataSources).values({
          entityType: 'programme',
          entityId: createdProg.id,
          sourceUrl: createdProg.sourceUrl,
          verificationStatus: createdProg.verificationStatus,
          verifiedByUserId: createdProg.verificationStatus === 'verified' ? params.actorUserId : null,
          lastVerifiedDate: createdProg.lastVerifiedDate,
          notes: 'Imported via Admin CSV Bulk Utility.',
        });

        createdIds.push(createdProg.id);
        importedCount += 1;
      }
    }
  });

  return {
    importedCount,
    skippedDuplicatesCount,
    skippedErrorRowsCount,
    createdIds,
  };
}
