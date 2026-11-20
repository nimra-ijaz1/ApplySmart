import { describe, expect, it } from 'vitest';
import {
  evaluateRequiredDocuments,
  inferDocumentCategory,
} from '../src/server/services/documentCheckerService.ts';

describe('Document Readiness Checker', () => {
  const refDate = new Date('2026-10-15T00:00:00Z');

  it('infers vault categories accurately for common admission documents', () => {
    expect(inferDocumentCategory('Academic Transcripts (HEC attested)')).toBe('Academic transcripts');
    expect(inferDocumentCategory('2 Recommendation Letters')).toBe('Recommendation letters');
    expect(inferDocumentCategory('Motivation Letter')).toBe('Motivation letter');
    expect(inferDocumentCategory('Valid Passport')).toBe('Passport');
    expect(inferDocumentCategory('VPD Certificate from uni-assist')).toBe('Other documents');
  });

  it('identifies ready, expired, and missing documents accurately', () => {
    const required = [
      'Academic Transcripts',
      'Valid Passport',
      'IELTS Certificate',
      'VPD Certificate',
      '2 Recommendation Letters',
    ];

    const vault = [
      {
        id: 1,
        category: 'Academic transcripts',
        title: 'BS CS Official Transcript',
        fileName: 'bs_cs_transcript.pdf',
        expirationDate: null,
      },
      {
        id: 2,
        category: 'Passport',
        title: 'Pakistani Passport',
        fileName: 'passport.pdf',
        expirationDate: '2025-05-01', // expired before 2026-10-15
      },
      {
        id: 3,
        category: 'IELTS certificate',
        title: 'IELTS Academic TRF',
        fileName: 'ielts_7_5.pdf',
        expirationDate: '2027-08-01',
      },
      {
        id: 4,
        category: 'Other documents',
        title: 'uni-assist VPD TUM',
        fileName: 'vpd_tum.pdf',
        expirationDate: null,
      },
    ];

    const result = evaluateRequiredDocuments(required, vault, refDate);

    expect(result.totalRequired).toBe(5);
    expect(result.readyCount).toBe(3);
    expect(result.expiredCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.readinessPercentage).toBe(60);
    expect(result.overallStatus).toBe('action_required');

    expect(result.items.find((i) => i.requiredDocument === 'Academic Transcripts')?.status).toBe('ready');
    expect(result.items.find((i) => i.requiredDocument === 'Valid Passport')?.status).toBe('expired');
    expect(result.items.find((i) => i.requiredDocument === 'IELTS Certificate')?.status).toBe('ready');
    expect(result.items.find((i) => i.requiredDocument === 'VPD Certificate')?.status).toBe('ready');
    expect(result.items.find((i) => i.requiredDocument === '2 Recommendation Letters')?.status).toBe('missing');
  });

  it('returns all_ready and 100% when all documents are covered and valid', () => {
    const result = evaluateRequiredDocuments(
      ['CV / Resume', 'Statement of Purpose'],
      [
        { id: 10, category: 'CV / Resume', title: 'Academic CV', fileName: 'cv.pdf' },
        { id: 11, category: 'Statement of Purpose', title: 'SOP ETH', fileName: 'sop.pdf' },
      ],
      refDate
    );

    expect(result.overallStatus).toBe('all_ready');
    expect(result.readinessPercentage).toBe(100);
    expect(result.missingCount).toBe(0);
  });
});
