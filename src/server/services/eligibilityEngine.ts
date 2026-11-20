import { isValidIsoDate } from '../utils/validation.ts';

export type EligibilityOverallStatus =
  | 'meets_requirements'
  | 'does_not_meet'
  | 'needs_manual_verification'
  | 'insufficient_information';

export type CriterionStatus = 'pass' | 'fail' | 'manual_verification' | 'missing_info';

export interface EligibilityCriterionResult {
  key: string;
  label: string;
  studentValue: string;
  requiredValue: string;
  status: CriterionStatus;
  reason: string;
  sourceUrl: string;
  lastVerifiedDate: string;
}

export interface StudentEligibilityInput {
  currentOrCompletedDegree?: string | null;
  degreeCompleted?: boolean | null;
  degreeField?: string | null;
  cgpa?: number | string | null;
  cgpaScale?: number | string | null;
  academicPercentage?: number | string | null;
  completedCourses?: string[] | null;
  ieltsOverall?: number | string | null;
  ieltsListening?: number | string | null;
  ieltsReading?: number | string | null;
  ieltsWriting?: number | string | null;
  ieltsSpeaking?: number | string | null;
  toeflScore?: number | null;
  duolingoScore?: number | null;
  otherLanguageTestName?: string | null;
  otherLanguageTestScore?: string | null;
  languageTestDate?: string | null;
  languageTestValidityDate?: string | null;
}

export interface ProgrammeRequirementInput {
  minCgpa?: number | string | null;
  cgpaScale?: number | string | null;
  minPercentage?: number | string | null;
  requiredDegreeBackground: string;
  acceptedDegreeFields?: string[] | null;
  prerequisiteSubjects?: string[] | null;
  requiresCompletedDegree: boolean;
  ieltsOverall?: number | string | null;
  ieltsListening?: number | string | null;
  ieltsReading?: number | string | null;
  ieltsWriting?: number | string | null;
  ieltsSpeaking?: number | string | null;
  toeflMin?: number | null;
  duolingoMin?: number | null;
  otherLanguageRequirements?: string | null;
  gpaConversionNote?: string | null;
  additionalConditions?: string | null;
  sourceUrl: string;
  lastVerifiedDate: string;
}

export interface EligibilityEvaluationResult {
  overallStatus: EligibilityOverallStatus;
  summaryLabel: string;
  criteria: EligibilityCriterionResult[];
  disclaimer: string;
}

function toNum(val: number | string | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function evaluateEligibility(
  student: StudentEligibilityInput,
  requirement: ProgrammeRequirementInput,
  referenceDate: Date = new Date()
): EligibilityEvaluationResult {
  const criteria: EligibilityCriterionResult[] = [];
  const sourceUrl = requirement.sourceUrl;
  const lastVerifiedDate = requirement.lastVerifiedDate;

  // 1. Academic Grade / CGPA / Percentage Check
  const reqCgpa = toNum(requirement.minCgpa);
  const reqScale = toNum(requirement.cgpaScale) ?? 4.0;
  const reqPct = toNum(requirement.minPercentage);
  const stuCgpa = toNum(student.cgpa);
  const stuScale = toNum(student.cgpaScale);
  const stuPct = toNum(student.academicPercentage);

  if (reqCgpa !== null || reqPct !== null) {
    const reqLabelParts: string[] = [];
    if (reqCgpa !== null) reqLabelParts.push(`${reqCgpa.toFixed(2)} / ${reqScale.toFixed(2)} CGPA`);
    if (reqPct !== null) reqLabelParts.push(`${reqPct.toFixed(1)}%`);
    const requiredDisplay = reqLabelParts.join(' or ');

    if (stuCgpa === null && stuPct === null) {
      criteria.push({
        key: 'academic_grade',
        label: 'Academic Grade (CGPA / Percentage)',
        studentValue: 'Not provided',
        requiredValue: requiredDisplay,
        status: 'missing_info',
        reason: 'Your CGPA or academic percentage is missing from your profile.',
        sourceUrl,
        lastVerifiedDate,
      });
    } else if (reqCgpa !== null && stuCgpa !== null) {
      if (stuScale === null) {
        criteria.push({
          key: 'academic_grade',
          label: 'Academic Grade (CGPA)',
          studentValue: `${stuCgpa.toFixed(2)} (scale unspecified)`,
          requiredValue: `${reqCgpa.toFixed(2)} / ${reqScale.toFixed(2)}`,
          status: 'missing_info',
          reason: 'CGPA scale is missing; scales cannot be assumed without verification.',
          sourceUrl,
          lastVerifiedDate,
        });
      } else if (Math.abs(stuScale - reqScale) > 0.01) {
        criteria.push({
          key: 'academic_grade',
          label: 'Academic Grade (CGPA Scale Mismatch)',
          studentValue: `${stuCgpa.toFixed(2)} / ${stuScale.toFixed(2)}`,
          requiredValue: `${reqCgpa.toFixed(2)} / ${reqScale.toFixed(2)}`,
          status: 'manual_verification',
          reason:
            requirement.gpaConversionNote ||
            `Your CGPA is on a ${stuScale.toFixed(2)} scale while the programme lists ${reqScale.toFixed(2)}. Different universities use different GPA conversion tables, so manual verification is required.`,
          sourceUrl,
          lastVerifiedDate,
        });
      } else if (stuCgpa >= reqCgpa) {
        criteria.push({
          key: 'academic_grade',
          label: 'Academic Grade (CGPA)',
          studentValue: `${stuCgpa.toFixed(2)} / ${stuScale.toFixed(2)}`,
          requiredValue: `${reqCgpa.toFixed(2)} / ${reqScale.toFixed(2)}`,
          status: 'pass',
          reason: `Meets the minimum listed CGPA of ${reqCgpa.toFixed(2)}/${reqScale.toFixed(2)}.`,
          sourceUrl,
          lastVerifiedDate,
        });
      } else {
        criteria.push({
          key: 'academic_grade',
          label: 'Academic Grade (CGPA)',
          studentValue: `${stuCgpa.toFixed(2)} / ${stuScale.toFixed(2)}`,
          requiredValue: `${reqCgpa.toFixed(2)} / ${reqScale.toFixed(2)}`,
          status: 'fail',
          reason: `Your CGPA (${stuCgpa.toFixed(2)}) is below the listed minimum (${reqCgpa.toFixed(2)}).`,
          sourceUrl,
          lastVerifiedDate,
        });
      }
    } else if (reqPct !== null && stuPct !== null) {
      if (stuPct >= reqPct) {
        criteria.push({
          key: 'academic_grade',
          label: 'Academic Percentage',
          studentValue: `${stuPct.toFixed(1)}%`,
          requiredValue: `${reqPct.toFixed(1)}%`,
          status: 'pass',
          reason: `Meets the minimum listed percentage of ${reqPct.toFixed(1)}%.`,
          sourceUrl,
          lastVerifiedDate,
        });
      } else {
        criteria.push({
          key: 'academic_grade',
          label: 'Academic Percentage',
          studentValue: `${stuPct.toFixed(1)}%`,
          requiredValue: `${reqPct.toFixed(1)}%`,
          status: 'fail',
          reason: `Your percentage (${stuPct.toFixed(1)}%) is below the listed minimum (${reqPct.toFixed(1)}%).`,
          sourceUrl,
          lastVerifiedDate,
        });
      }
    } else if (reqCgpa !== null && stuPct !== null && stuCgpa === null) {
      criteria.push({
        key: 'academic_grade',
        label: 'Academic Grade (Percentage vs CGPA)',
        studentValue: `${stuPct.toFixed(1)}%`,
        requiredValue: `${reqCgpa.toFixed(2)} / ${reqScale.toFixed(2)} CGPA`,
        status: 'manual_verification',
        reason:
          requirement.gpaConversionNote ||
          'ApplySmart never converts percentages to CGPA automatically without an institution-specific conversion rule. Please check the university grade equivalency table.',
        sourceUrl,
        lastVerifiedDate,
      });
    } else {
      criteria.push({
        key: 'academic_grade',
        label: 'Academic Grade',
        studentValue: stuCgpa !== null ? `${stuCgpa.toFixed(2)} CGPA` : `${stuPct?.toFixed(1)}%`,
        requiredValue: requiredDisplay,
        status: 'manual_verification',
        reason: 'Grade format differs from the listed requirement format and requires manual verification.',
        sourceUrl,
        lastVerifiedDate,
      });
    }
  }

  // 2. Degree Completion Status
  if (requirement.requiresCompletedDegree) {
    if (student.degreeCompleted === null || student.degreeCompleted === undefined) {
      criteria.push({
        key: 'degree_completion',
        label: 'Degree Completion Status',
        studentValue: 'Not specified',
        requiredValue: 'Completed prior degree',
        status: 'missing_info',
        reason: 'Specify whether your qualifying degree is completed or in progress.',
        sourceUrl,
        lastVerifiedDate,
      });
    } else if (student.degreeCompleted) {
      criteria.push({
        key: 'degree_completion',
        label: 'Degree Completion Status',
        studentValue: student.currentOrCompletedDegree
          ? `${student.currentOrCompletedDegree} (Completed)`
          : 'Completed',
        requiredValue: 'Completed prior degree',
        status: 'pass',
        reason: 'Qualifying degree is completed.',
        sourceUrl,
        lastVerifiedDate,
      });
    } else {
      criteria.push({
        key: 'degree_completion',
        label: 'Degree Completion Status',
        studentValue: 'In progress / Not yet completed',
        requiredValue: 'Completed prior degree (or conditional final-year transcript)',
        status: 'manual_verification',
        reason:
          'Your degree is marked as in progress. Verify whether the university accepts provisional transcripts for conditional admission.',
        sourceUrl,
        lastVerifiedDate,
      });
    }
  }

  // 3. Degree Field / Academic Background
  const acceptedFields = requirement.acceptedDegreeFields ?? [];
  if (!student.degreeField || student.degreeField.trim() === '') {
    criteria.push({
      key: 'degree_field',
      label: 'Academic Degree Background',
      studentValue: 'Not provided',
      requiredValue: requirement.requiredDegreeBackground,
      status: 'missing_info',
      reason: 'Your degree field is missing from your academic profile.',
      sourceUrl,
      lastVerifiedDate,
    });
  } else if (acceptedFields.length === 0) {
    criteria.push({
      key: 'degree_field',
      label: 'Academic Degree Background',
      studentValue: student.degreeField,
      requiredValue: requirement.requiredDegreeBackground,
      status: 'manual_verification',
      reason: 'Verify that your degree discipline matches the programme description.',
      sourceUrl,
      lastVerifiedDate,
    });
  } else {
    const normStudentField = normalizeText(student.degreeField);
    const matched = acceptedFields.some((f) => {
      const normAccepted = normalizeText(f);
      if (!normAccepted) return false;
      if (normStudentField.includes(normAccepted) || normAccepted.includes(normStudentField)) {
        return true;
      }
      const studentTokens = normStudentField.split(' ').filter((t) => t.length > 2);
      const acceptedTokens = normAccepted.split(' ').filter((t) => t.length > 2);
      const overlap = studentTokens.filter((t) => acceptedTokens.includes(t));
      return overlap.length >= Math.min(2, acceptedTokens.length);
    });

    criteria.push({
      key: 'degree_field',
      label: 'Academic Degree Background',
      studentValue: student.degreeField,
      requiredValue: requirement.requiredDegreeBackground,
      status: matched ? 'pass' : 'manual_verification',
      reason: matched
        ? `Your background in ${student.degreeField} aligns with accepted disciplines (${acceptedFields.join(', ')}).`
        : `${student.degreeField} is not an exact match for [${acceptedFields.join(', ')}]. Admissions may still accept closely related transcripts after syllabus review.`,
      sourceUrl,
      lastVerifiedDate,
    });
  }

  // 4. Prerequisite Subjects
  const prerequisites = requirement.prerequisiteSubjects ?? [];
  if (prerequisites.length > 0) {
    const completed = (student.completedCourses ?? []).map(normalizeText).filter(Boolean);
    if (completed.length === 0) {
      criteria.push({
        key: 'prerequisites',
        label: 'Prerequisite Subjects',
        studentValue: 'No courses listed in profile',
        requiredValue: prerequisites.join(', '),
        status: 'missing_info',
        reason: `Programme lists prerequisite subjects (${prerequisites.join(', ')}). Add completed courses to your profile or verify manually against your transcript.`,
        sourceUrl,
        lastVerifiedDate,
      });
    } else {
      const missingPrereqs = prerequisites.filter(
        (reqSub) =>
          !completed.some((c) => c.includes(normalizeText(reqSub)) || normalizeText(reqSub).includes(c))
      );
      if (missingPrereqs.length === 0) {
        criteria.push({
          key: 'prerequisites',
          label: 'Prerequisite Subjects',
          studentValue: `${student.completedCourses?.length ?? 0} courses matched`,
          requiredValue: prerequisites.join(', '),
          status: 'pass',
          reason: 'All listed prerequisite subjects were found in your completed coursework.',
          sourceUrl,
          lastVerifiedDate,
        });
      } else {
        criteria.push({
          key: 'prerequisites',
          label: 'Prerequisite Subjects',
          studentValue: `Missing: ${missingPrereqs.join(', ')}`,
          requiredValue: prerequisites.join(', '),
          status: 'manual_verification',
          reason: `Could not confirm [${missingPrereqs.join(', ')}] in your listed courses. Verify credit-hour equivalency on your transcript.`,
          sourceUrl,
          lastVerifiedDate,
        });
      }
    }
  }

  // 5. Language Proficiency & Validity Check
  const reqIeltsOverall = toNum(requirement.ieltsOverall);
  const reqListening = toNum(requirement.ieltsListening);
  const reqReading = toNum(requirement.ieltsReading);
  const reqWriting = toNum(requirement.ieltsWriting);
  const reqSpeaking = toNum(requirement.ieltsSpeaking);
  const reqToefl = requirement.toeflMin ?? null;
  const reqDuolingo = requirement.duolingoMin ?? null;

  const hasLangRequirement =
    reqIeltsOverall !== null ||
    reqListening !== null ||
    reqReading !== null ||
    reqWriting !== null ||
    reqSpeaking !== null ||
    reqToefl !== null ||
    reqDuolingo !== null;

  if (hasLangRequirement) {
    // Check test expiration first if a validity date is recorded
    let isExpired = false;
    if (student.languageTestValidityDate && isValidIsoDate(student.languageTestValidityDate)) {
      const validity = new Date(`${student.languageTestValidityDate}T00:00:00.000Z`);
      const refDay = new Date(`${referenceDate.toISOString().slice(0, 10)}T00:00:00.000Z`);
      if (validity < refDay) {
        isExpired = true;
      }
    }

    const stuIeltsOverall = toNum(student.ieltsOverall);
    const stuListening = toNum(student.ieltsListening);
    const stuReading = toNum(student.ieltsReading);
    const stuWriting = toNum(student.ieltsWriting);
    const stuSpeaking = toNum(student.ieltsSpeaking);
    const stuToefl = student.toeflScore ?? null;
    const stuDuolingo = student.duolingoScore ?? null;

    const langReqParts: string[] = [];
    if (reqIeltsOverall !== null) langReqParts.push(`IELTS ${reqIeltsOverall.toFixed(1)}`);
    const modParts: string[] = [];
    if (reqListening !== null) modParts.push(`L:${reqListening.toFixed(1)}`);
    if (reqReading !== null) modParts.push(`R:${reqReading.toFixed(1)}`);
    if (reqWriting !== null) modParts.push(`W:${reqWriting.toFixed(1)}`);
    if (reqSpeaking !== null) modParts.push(`S:${reqSpeaking.toFixed(1)}`);
    if (modParts.length > 0) langReqParts.push(`Modules (${modParts.join(', ')})`);
    if (reqToefl !== null) langReqParts.push(`TOEFL ${reqToefl}`);
    if (reqDuolingo !== null) langReqParts.push(`DET ${reqDuolingo}`);
    const reqLangLabel = langReqParts.join(' | ');

    if (isExpired) {
      criteria.push({
        key: 'language_validity',
        label: 'Language Test Validity',
        studentValue: `Expired on ${student.languageTestValidityDate}`,
        requiredValue: 'Valid (unexpired) language certificate',
        status: 'fail',
        reason: `Your language test expired on ${student.languageTestValidityDate}. Most universities require scores valid at enrollment.`,
        sourceUrl,
        lastVerifiedDate,
      });
    }

    if (
      stuIeltsOverall === null &&
      stuToefl === null &&
      stuDuolingo === null &&
      !student.otherLanguageTestScore
    ) {
      criteria.push({
        key: 'language_proficiency',
        label: 'English Language Proficiency',
        studentValue: 'No language test score provided',
        requiredValue: reqLangLabel,
        status: 'missing_info',
        reason: 'Add your IELTS, TOEFL, or Duolingo score to check language eligibility.',
        sourceUrl,
        lastVerifiedDate,
      });
    } else if (stuIeltsOverall !== null && reqIeltsOverall !== null) {
      // Overall IELTS check
      if (stuIeltsOverall < reqIeltsOverall) {
        criteria.push({
          key: 'ielts_overall',
          label: 'IELTS Overall Score',
          studentValue: stuIeltsOverall.toFixed(1),
          requiredValue: `${reqIeltsOverall.toFixed(1)} minimum`,
          status: 'fail',
          reason: `IELTS overall score (${stuIeltsOverall.toFixed(1)}) is below the required ${reqIeltsOverall.toFixed(1)}.`,
          sourceUrl,
          lastVerifiedDate,
        });
      } else {
        criteria.push({
          key: 'ielts_overall',
          label: 'IELTS Overall Score',
          studentValue: stuIeltsOverall.toFixed(1),
          requiredValue: `${reqIeltsOverall.toFixed(1)} minimum`,
          status: 'pass',
          reason: `IELTS overall score (${stuIeltsOverall.toFixed(1)}) meets the minimum ${reqIeltsOverall.toFixed(1)}.`,
          sourceUrl,
          lastVerifiedDate,
        });
      }

      // Individual IELTS modules checked separately!
      const moduleChecks: Array<{
        key: string;
        label: string;
        stu: number | null;
        req: number | null;
      }> = [
        { key: 'ielts_listening', label: 'IELTS Listening', stu: stuListening, req: reqListening },
        { key: 'ielts_reading', label: 'IELTS Reading', stu: stuReading, req: reqReading },
        { key: 'ielts_writing', label: 'IELTS Writing', stu: stuWriting, req: reqWriting },
        { key: 'ielts_speaking', label: 'IELTS Speaking', stu: stuSpeaking, req: reqSpeaking },
      ];

      for (const m of moduleChecks) {
        if (m.req !== null) {
          if (m.stu === null) {
            criteria.push({
              key: m.key,
              label: m.label,
              studentValue: 'Not provided',
              requiredValue: `${m.req.toFixed(1)} minimum`,
              status: 'missing_info',
              reason: `Programme requires ${m.label} >= ${m.req.toFixed(1)}, but your individual module score is missing.`,
              sourceUrl,
              lastVerifiedDate,
            });
          } else if (m.stu < m.req) {
            criteria.push({
              key: m.key,
              label: m.label,
              studentValue: m.stu.toFixed(1),
              requiredValue: `${m.req.toFixed(1)} minimum`,
              status: 'fail',
              reason: `${m.label} (${m.stu.toFixed(1)}) is below the required ${m.req.toFixed(1)} band.`,
              sourceUrl,
              lastVerifiedDate,
            });
          } else {
            criteria.push({
              key: m.key,
              label: m.label,
              studentValue: m.stu.toFixed(1),
              requiredValue: `${m.req.toFixed(1)} minimum`,
              status: 'pass',
              reason: `${m.label} (${m.stu.toFixed(1)}) meets the ${m.req.toFixed(1)} requirement.`,
              sourceUrl,
              lastVerifiedDate,
            });
          }
        }
      }
    } else if (stuToefl !== null && reqToefl !== null) {
      criteria.push({
        key: 'toefl_score',
        label: 'TOEFL iBT Score',
        studentValue: String(stuToefl),
        requiredValue: `${reqToefl} minimum`,
        status: stuToefl >= reqToefl ? 'pass' : 'fail',
        reason:
          stuToefl >= reqToefl
            ? `TOEFL score (${stuToefl}) meets the minimum ${reqToefl}.`
            : `TOEFL score (${stuToefl}) is below the required ${reqToefl}.`,
        sourceUrl,
        lastVerifiedDate,
      });
    } else if (stuDuolingo !== null && reqDuolingo !== null) {
      criteria.push({
        key: 'duolingo_score',
        label: 'Duolingo English Test',
        studentValue: String(stuDuolingo),
        requiredValue: `${reqDuolingo} minimum`,
        status: stuDuolingo >= reqDuolingo ? 'pass' : 'fail',
        reason:
          stuDuolingo >= reqDuolingo
            ? `Duolingo score (${stuDuolingo}) meets the minimum ${reqDuolingo}.`
            : `Duolingo score (${stuDuolingo}) is below the required ${reqDuolingo}.`,
        sourceUrl,
        lastVerifiedDate,
      });
    } else {
      const providedDesc =
        stuIeltsOverall !== null
          ? `IELTS ${stuIeltsOverall.toFixed(1)}`
          : stuToefl !== null
            ? `TOEFL ${stuToefl}`
            : stuDuolingo !== null
              ? `Duolingo ${stuDuolingo}`
              : `${student.otherLanguageTestName || 'Other'}: ${student.otherLanguageTestScore}`;
      criteria.push({
        key: 'language_proficiency',
        label: 'English Language Proficiency',
        studentValue: providedDesc,
        requiredValue: reqLangLabel,
        status: 'manual_verification',
        reason:
          'Your provided language test differs from the specific test scores listed in the programme requirements. Verify accepted equivalents with admissions.',
        sourceUrl,
        lastVerifiedDate,
      });
    }
  }

  // Determine overall status strictly without guessing
  const hasFail = criteria.some((c) => c.status === 'fail');
  const hasMissing = criteria.some((c) => c.status === 'missing_info');
  const hasManual = criteria.some((c) => c.status === 'manual_verification');

  let overallStatus: EligibilityOverallStatus = 'meets_requirements';
  let summaryLabel = 'Meets listed requirements';

  if (hasFail) {
    overallStatus = 'does_not_meet';
    summaryLabel = 'Does not meet listed requirements';
  } else if (hasMissing) {
    overallStatus = 'insufficient_information';
    summaryLabel = 'Insufficient information';
  } else if (hasManual) {
    overallStatus = 'needs_manual_verification';
    summaryLabel = 'Needs manual verification';
  }

  return {
    overallStatus,
    summaryLabel,
    criteria,
    disclaimer:
      'Eligibility checks compare your profile against minimum published entry requirements only. Meeting minimum requirements does not guarantee admission, which depends on holistic review, seat capacity, and official document verification.',
  };
}
