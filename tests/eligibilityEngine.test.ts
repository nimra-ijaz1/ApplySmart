import { describe, expect, it } from 'vitest';
import { evaluateEligibility } from '../src/server/services/eligibilityEngine.ts';
import type {
  ProgrammeRequirementInput,
  StudentEligibilityInput,
} from '../src/server/services/eligibilityEngine.ts';

const baseRequirement: ProgrammeRequirementInput = {
  minCgpa: '3.50',
  cgpaScale: '4.00',
  requiredDegreeBackground: "Bachelor's in Computer Science or Software Engineering",
  acceptedDegreeFields: ['Computer Science', 'Software Engineering'],
  prerequisiteSubjects: ['Algorithms', 'Operating Systems'],
  requiresCompletedDegree: true,
  ieltsOverall: '6.5',
  ieltsListening: '6.0',
  ieltsReading: '6.0',
  ieltsWriting: '6.0',
  ieltsSpeaking: '6.0',
  toeflMin: 90,
  sourceUrl: 'https://example.edu/programme',
  lastVerifiedDate: '2026-10-15',
};

const baseStudent: StudentEligibilityInput = {
  currentOrCompletedDegree: "Bachelor's",
  degreeCompleted: true,
  degreeField: 'Software Engineering',
  cgpa: '3.66',
  cgpaScale: '4.00',
  completedCourses: ['Data Structures & Algorithms', 'Operating Systems', 'Database Systems'],
  ieltsOverall: '7.0',
  ieltsListening: '7.5',
  ieltsReading: '7.0',
  ieltsWriting: '6.5',
  ieltsSpeaking: '7.0',
  languageTestValidityDate: '2028-05-01',
};

describe('Deterministic Eligibility Engine', () => {
  it('marks fully qualified applicant as meets_requirements', () => {
    const res = evaluateEligibility(baseStudent, baseRequirement, new Date('2026-11-20'));
    expect(res.overallStatus).toBe('meets_requirements');
    expect(res.criteria.every((c) => c.status === 'pass')).toBe(true);
  });

  it('marks missing CGPA as insufficient_information and never marks eligible', () => {
    const res = evaluateEligibility(
      { ...baseStudent, cgpa: null, academicPercentage: null },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('insufficient_information');
    const gradeCrit = res.criteria.find((c) => c.key === 'academic_grade');
    expect(gradeCrit?.status).toBe('missing_info');
  });

  it('marks different CGPA scales (e.g., 10.0 vs 4.0) as needs_manual_verification without auto-converting', () => {
    const res = evaluateEligibility(
      { ...baseStudent, cgpa: '8.40', cgpaScale: '10.00' },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('needs_manual_verification');
    const gradeCrit = res.criteria.find((c) => c.key === 'academic_grade');
    expect(gradeCrit?.status).toBe('manual_verification');
  });

  it('never converts percentage to CGPA automatically', () => {
    const res = evaluateEligibility(
      { ...baseStudent, cgpa: null, academicPercentage: '82.5' },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('needs_manual_verification');
    const gradeCrit = res.criteria.find((c) => c.key === 'academic_grade');
    expect(gradeCrit?.status).toBe('manual_verification');
  });

  it('fails when IELTS overall score is below requirement', () => {
    const res = evaluateEligibility(
      { ...baseStudent, ieltsOverall: '6.0' },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('does_not_meet');
    const overallCrit = res.criteria.find((c) => c.key === 'ielts_overall');
    expect(overallCrit?.status).toBe('fail');
  });

  it('fails when IELTS overall passes (7.0 >= 6.5) but an individual module (Writing 5.5 < 6.0) fails', () => {
    const res = evaluateEligibility(
      { ...baseStudent, ieltsOverall: '7.0', ieltsWriting: '5.5' },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('does_not_meet');
    const writingCrit = res.criteria.find((c) => c.key === 'ielts_writing');
    expect(writingCrit?.status).toBe('fail');
  });

  it('fails when language test is expired', () => {
    const res = evaluateEligibility(
      { ...baseStudent, languageTestValidityDate: '2025-12-31' },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('does_not_meet');
    const validityCrit = res.criteria.find((c) => c.key === 'language_validity');
    expect(validityCrit?.status).toBe('fail');
  });

  it('marks missing prerequisite coursework as insufficient_information', () => {
    const res = evaluateEligibility(
      { ...baseStudent, completedCourses: [] },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('insufficient_information');
    const prereqCrit = res.criteria.find((c) => c.key === 'prerequisites');
    expect(prereqCrit?.status).toBe('missing_info');
  });

  it('flags non-matching degree background as needs_manual_verification', () => {
    const res = evaluateEligibility(
      { ...baseStudent, degreeField: 'Mechanical Engineering' },
      baseRequirement,
      new Date('2026-11-20')
    );
    expect(res.overallStatus).toBe('needs_manual_verification');
    const fieldCrit = res.criteria.find((c) => c.key === 'degree_field');
    expect(fieldCrit?.status).toBe('manual_verification');
  });
});
