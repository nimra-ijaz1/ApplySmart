import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/index.ts', () => {
  const mockUnis = [
    { id: 1, name: 'Technical University of Munich', country: 'Germany' },
    { id: 2, name: 'ETH Zurich', country: 'Switzerland' },
  ];
  const mockProgs = [
    { id: 10, universityId: 1, name: 'MSc Data Engineering and Analytics', degreeLevel: "Master's" },
  ];

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          // Identify table by column names present in Drizzle table definition
          const keys = table && typeof table === 'object' ? Object.keys(table) : [];
          if (keys.includes('universityId')) {
            return Promise.resolve(mockProgs);
          }
          return Promise.resolve(mockUnis);
        }),
      })),
    },
  };
});

import { parseCsvContent, validateCsvImport } from '../src/server/services/csvImportService.ts';

describe('RFC-4180 CSV Parser', () => {
  it('parses quoted commas, escaped quotes, CRLF, and UTF-8 BOM', () => {
    const csv =
      '\uFEFFname,country,city,description\r\n' +
      '"University of California, Berkeley",United States,Berkeley,"Ranked top public university with ""EECS"" labs."\r\n';
    const { headers, records } = parseCsvContent(csv);

    expect(headers).toEqual(['name', 'country', 'city', 'description']);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('University of California, Berkeley');
    expect(records[0].description).toBe('Ranked top public university with "EECS" labs.');
  });
});

describe('University CSV Validation', () => {
  it('flags missing required headers', async () => {
    const csv = 'name,country\nTest University,Germany\n';
    const report = await validateCsvImport('universities', csv);

    expect(report.missingRequiredHeaders).toContain('city');
    expect(report.missingRequiredHeaders).toContain('official_website');
  });

  it('detects invalid URLs, intra-CSV duplicates, and PostgreSQL duplicates', async () => {
    const csv = [
      'name,country,city,official_website,institution_type,description,source_url,last_verified_date',
      'University of Bonn,Germany,Bonn,https://www.uni-bonn.de,Public,"Public research university in Bonn, Germany.",https://www.uni-bonn.de/en,2026-10-15',
      'University of Bonn,Germany,Bonn,https://www.uni-bonn.de,Public,"Duplicate in same CSV.",https://www.uni-bonn.de/en,2026-10-15',
      'Bad URL College,UK,London,not-a-valid-url,Private,"Missing valid URL scheme.",https://example.edu,2026-10-15',
      'ETH Zurich,Switzerland,Zurich,https://ethz.ch,Public,"Already exists in PostgreSQL catalog.",https://ethz.ch/en,2026-10-15',
    ].join('\n');

    const report = await validateCsvImport('universities', csv);
    expect(report.summary.totalRows).toBe(4);
    expect(report.rows[0].status).toBe('valid');
    expect(report.rows[1].status).toBe('error');
    expect(report.rows[1].errors.some((e) => e.includes('Duplicate university'))).toBe(true);
    expect(report.rows[2].status).toBe('error');
    expect(report.rows[2].errors.some((e) => e.includes('official_website'))).toBe(true);
    expect(report.rows[3].isDuplicateInDb).toBe(true);
    expect(report.rows[3].status).toBe('warning');
  });
});

describe('Programme CSV Validation', () => {
  it('validates PostgreSQL foreign keys, CGPA scales, IELTS bounds, and date ranges', async () => {
    const csv = [
      'university_name,name,degree_level,subject_area,duration,tuition_fee,currency,intake,official_programme_url,min_cgpa,cgpa_scale,ielts_overall,application_opening_date,application_deadline',
      'Technical University of Munich,MSc Quantum Computing,Master\'s,Computer Science,2 years,0,EUR,Fall 2026,https://www.tum.de/quantum,3.20,4.00,6.5,2026-01-01,2026-05-31',
      'Nonexistent Institute,MSc AI,Master\'s,Computer Science,2 years,10000,USD,Fall 2026,https://example.edu/ai,4.50,4.00,10.0,2026-06-01,2026-05-01',
      'Technical University of Munich,MSc Data Engineering and Analytics,Master\'s,Computer Science,2 years,0,EUR,Fall 2026,https://www.tum.de/dea,3.00,4.00,6.5,2026-01-01,2026-05-31',
    ].join('\n');

    const report = await validateCsvImport('programmes', csv);
    expect(report.summary.totalRows).toBe(3);

    // Row 1: resolves FK to TUM #1 and passes rules
    expect(report.rows[0].resolvedUniversityId).toBe(1);
    expect(report.rows[0].errors).toHaveLength(0);

    // Row 2: unresolved FK + CGPA > scale + IELTS > 9 + openingDate > deadline
    expect(report.rows[1].status).toBe('error');
    expect(report.rows[1].errors.some((e) => e.includes('Foreign key error'))).toBe(true);
    expect(report.rows[1].errors.some((e) => e.includes('cannot exceed cgpa_scale'))).toBe(true);
    expect(report.rows[1].errors.some((e) => e.includes('between 0 and 9'))).toBe(true);
    expect(report.rows[1].errors.some((e) => e.includes('cannot be later than application_deadline'))).toBe(true);

    // Row 3: matches existing programme in PostgreSQL
    expect(report.rows[2].isDuplicateInDb).toBe(true);
  });
});
