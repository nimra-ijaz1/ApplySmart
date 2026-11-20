import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  applications,
  documents,
  eligibilityChecks,
  programmeRequirements,
  programmes,
  recentlyViewed,
  reminders,
  scholarshipEligibility,
  scholarships,
  studentProfiles,
  studentShortlists,
  universities,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { evaluateEligibility } from '../services/eligibilityEngine.ts';
import { evaluateRequiredDocuments } from '../services/documentCheckerService.ts';
import { explainEligibilityWithAI } from '../services/aiService.ts';
import { isValidIsoDate } from '../utils/validation.ts';

export const studentFeaturesRouter = Router();

// --- SHORTLIST ---
studentFeaturesRouter.get('/shortlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select()
      .from(studentShortlists)
      .where(eq(studentShortlists.userId, req.dbUser!.id))
      .orderBy(desc(studentShortlists.createdAt));

    const allUnis = await db.select().from(universities);
    const allProgs = await db.select().from(programmes);
    const allSch = await db.select().from(scholarships);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const progMap = new Map(allProgs.map((p) => [p.id, p]));
    const schMap = new Map(allSch.map((s) => [s.id, s]));

    const enriched = rows.map((row) => ({
      ...row,
      university: row.universityId ? uniMap.get(row.universityId) ?? null : null,
      programme: row.programmeId ? progMap.get(row.programmeId) ?? null : null,
      scholarship: row.scholarshipId ? schMap.get(row.scholarshipId) ?? null : null,
    }));

    return res.json({ items: enriched });
  } catch (error) {
    console.error('Failed to get shortlist:', error);
    return res.status(500).json({ error: 'Unable to load shortlist.' });
  }
});

const shortlistSchema = z
  .object({
    itemType: z.enum(['university', 'programme', 'scholarship']),
    universityId: z.number().int().positive().optional(),
    programmeId: z.number().int().positive().optional(),
    scholarshipId: z.number().int().positive().optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.itemType === 'university' && !data.universityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'universityId is required when itemType is university.',
        path: ['universityId'],
      });
    }
    if (data.itemType === 'programme' && !data.programmeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'programmeId is required when itemType is programme.',
        path: ['programmeId'],
      });
    }
    if (data.itemType === 'scholarship' && !data.scholarshipId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'scholarshipId is required when itemType is scholarship.',
        path: ['scholarshipId'],
      });
    }
  });

studentFeaturesRouter.post('/shortlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = shortlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid shortlist payload.',
      });
    }

    const { itemType, universityId, programmeId, scholarshipId, notes } = parsed.data;
    const userId = req.dbUser!.id;

    let resolvedUniversityId: number | null = null;
    const resolvedProgrammeId: number | null = itemType === 'programme' ? programmeId! : null;
    const resolvedScholarshipId: number | null = itemType === 'scholarship' ? scholarshipId! : null;

    if (itemType === 'university') {
      const [uni] = await db
        .select({ id: universities.id })
        .from(universities)
        .where(eq(universities.id, universityId!))
        .limit(1);
      if (!uni) return res.status(404).json({ error: 'University not found.' });
      resolvedUniversityId = uni.id;
    } else if (itemType === 'programme') {
      const [prog] = await db
        .select({ id: programmes.id, universityId: programmes.universityId })
        .from(programmes)
        .where(eq(programmes.id, programmeId!))
        .limit(1);
      if (!prog) return res.status(404).json({ error: 'Programme not found.' });
      resolvedUniversityId = prog.universityId;
    } else if (itemType === 'scholarship') {
      const [sch] = await db
        .select({ id: scholarships.id })
        .from(scholarships)
        .where(eq(scholarships.id, scholarshipId!))
        .limit(1);
      if (!sch) return res.status(404).json({ error: 'Scholarship not found.' });
    }

    // Exact equality match against existing shortlisted items
    const existingRows = await db
      .select()
      .from(studentShortlists)
      .where(and(eq(studentShortlists.userId, userId), eq(studentShortlists.itemType, itemType)));

    const match = existingRows.find(
      (r) =>
        (r.universityId ?? null) === resolvedUniversityId &&
        (r.programmeId ?? null) === resolvedProgrammeId &&
        (r.scholarshipId ?? null) === resolvedScholarshipId
    );

    if (match) {
      return res.json({ item: match, alreadySaved: true });
    }

    const [created] = await db
      .insert(studentShortlists)
      .values({
        userId,
        itemType,
        universityId: resolvedUniversityId,
        programmeId: resolvedProgrammeId,
        scholarshipId: resolvedScholarshipId,
        notes: notes ?? null,
      })
      .returning();

    return res.status(201).json({ item: created });
  } catch (error) {
    console.error('Failed to save shortlist:', error);
    return res.status(500).json({ error: 'Unable to save to shortlist.' });
  }
});

studentFeaturesRouter.delete('/shortlist/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid shortlist ID.' });

    const deleted = await db
      .delete(studentShortlists)
      .where(and(eq(studentShortlists.id, id), eq(studentShortlists.userId, req.dbUser!.id)))
      .returning({ id: studentShortlists.id });

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Shortlist item not found.' });
    }

    return res.json({ deleted: true });
  } catch (error) {
    console.error('Failed to remove shortlist:', error);
    return res.status(500).json({ error: 'Unable to remove shortlist item.' });
  }
});

// --- ELIGIBILITY CHECKER ---
const checkSchema = z.object({
  programmeId: z.number().int().positive(),
  includeAiExplanation: z.boolean().optional().default(true),
  overrideProfile: z
    .object({
      cgpa: z.union([z.coerce.number().min(0).max(10), z.null()]).optional(),
      cgpaScale: z.union([z.coerce.number().min(1).max(100), z.null()]).optional(),
      academicPercentage: z.union([z.coerce.number().min(0).max(100), z.null()]).optional(),
      degreeField: z.string().max(150).nullable().optional(),
      degreeCompleted: z.boolean().nullable().optional(),
      ieltsOverall: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
      ieltsListening: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
      ieltsReading: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
      ieltsWriting: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
      ieltsSpeaking: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
      toeflScore: z.union([z.coerce.number().int().min(0).max(120), z.null()]).optional(),
      duolingoScore: z.union([z.coerce.number().int().min(10).max(160), z.null()]).optional(),
      languageTestValidityDate: z
        .string()
        .max(30)
        .refine((v) => v === '' || isValidIsoDate(v), 'Invalid validity date')
        .nullable()
        .optional(),
    })
    .refine(
      (o) => {
        if (o.cgpa != null && o.cgpaScale != null) return o.cgpa <= o.cgpaScale;
        return true;
      },
      { message: 'What-if CGPA cannot exceed the specified CGPA scale.' }
    )
    .optional(),
});

studentFeaturesRouter.post('/eligibility/check', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const parsed = checkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid eligibility request.' });

    const { programmeId, includeAiExplanation, overrideProfile } = parsed.data;
    const [programme] = await db
      .select()
      .from(programmes)
      .where(eq(programmes.id, programmeId))
      .limit(1);
    if (!programme) return res.status(404).json({ error: 'Programme not found.' });

    const [university] = await db
      .select()
      .from(universities)
      .where(eq(universities.id, programme.universityId))
      .limit(1);

    const [reqRow] = await db
      .select()
      .from(programmeRequirements)
      .where(eq(programmeRequirements.programmeId, programmeId))
      .limit(1);

    if (!reqRow) {
      return res.status(400).json({ error: 'Programme requirements are not configured yet.' });
    }

    const [[profile], userDocs] = await Promise.all([
      db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, req.dbUser!.id))
        .limit(1),
      db
        .select({
          id: documents.id,
          category: documents.category,
          title: documents.title,
          fileName: documents.fileName,
          expirationDate: documents.expirationDate,
          uploadedAt: documents.uploadedAt,
        })
        .from(documents)
        .where(eq(documents.userId, req.dbUser!.id)),
    ]);

    const mergedStudent = {
      ...(profile ?? {}),
      ...(overrideProfile ?? {}),
    };

    const evaluation = evaluateEligibility(mergedStudent, reqRow);
    const documentCheck = evaluateRequiredDocuments(reqRow.requiredDocuments ?? [], userDocs);

    let aiExplanation: string | null = null;
    let aiConfigured = true;
    let aiNotice: string | undefined;

    if (includeAiExplanation) {
      const aiRes = await explainEligibilityWithAI({
        universityName: university?.name ?? 'University',
        programmeName: programme.name,
        degreeLevel: programme.degreeLevel,
        evaluation,
        sourceUrl: reqRow.sourceUrl,
      });
      aiExplanation = aiRes.explanation;
      aiConfigured = aiRes.aiConfigured;
      aiNotice = aiRes.error;
    }

    const [savedCheck] = await db
      .insert(eligibilityChecks)
      .values({
        userId: req.dbUser!.id,
        programmeId,
        overallStatus: evaluation.overallStatus,
        criteriaBreakdown: evaluation.criteria,
        aiExplanation,
        profileSnapshot: {
          cgpa: mergedStudent.cgpa ?? null,
          cgpaScale: mergedStudent.cgpaScale ?? null,
          degreeField: mergedStudent.degreeField ?? null,
          ieltsOverall: mergedStudent.ieltsOverall ?? null,
        },
      })
      .returning();

    return res.json({
      checkId: savedCheck.id,
      programme,
      university,
      requirements: reqRow,
      evaluation,
      documentCheck,
      aiExplanation,
      aiConfigured,
      aiNotice,
    });
  } catch (error) {
    console.error('Failed to evaluate eligibility:', error);
    return res.status(500).json({ error: 'Eligibility check failed.' });
  }
});

// --- DOCUMENT READINESS CHECKLIST ---
studentFeaturesRouter.get('/documents/checklist', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const userId = req.dbUser!.id;
    const rawProgId = req.query.programmeId;
    let programmeIdParam: number | null = null;
    if (rawProgId !== undefined && rawProgId !== '') {
      programmeIdParam = Number(rawProgId);
      if (!Number.isInteger(programmeIdParam) || programmeIdParam <= 0) {
        return res.status(400).json({ error: 'Invalid programmeId query parameter.' });
      }
    }

    const [userDocs, userApps, userShortlists, allUnis, allProgs, allReqs] = await Promise.all([
      db
        .select({
          id: documents.id,
          category: documents.category,
          title: documents.title,
          fileName: documents.fileName,
          expirationDate: documents.expirationDate,
          uploadedAt: documents.uploadedAt,
        })
        .from(documents)
        .where(eq(documents.userId, userId)),
      db.select().from(applications).where(eq(applications.userId, userId)),
      db.select().from(studentShortlists).where(eq(studentShortlists.userId, userId)),
      db.select().from(universities),
      db.select().from(programmes),
      db.select().from(programmeRequirements),
    ]);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const progMap = new Map(allProgs.map((p) => [p.id, p]));
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    let targetProgrammeIds: number[] = [];
    if (programmeIdParam !== null) {
      if (!progMap.has(programmeIdParam)) {
        return res.status(404).json({ error: 'Programme not found.' });
      }
      targetProgrammeIds = [programmeIdParam];
    } else {
      const set = new Set<number>();
      for (const a of userApps) set.add(a.programmeId);
      for (const s of userShortlists) {
        if (s.programmeId) set.add(s.programmeId);
      }
      targetProgrammeIds = Array.from(set);
    }

    const programmeChecks = targetProgrammeIds
      .map((pid) => {
        const prog = progMap.get(pid);
        if (!prog) return null;
        const uni = uniMap.get(prog.universityId);
        const reqRow = reqMap.get(pid);
        const requiredDocs = reqRow?.requiredDocuments ?? [];
        return {
          programme: {
            id: prog.id,
            name: prog.name,
            degreeLevel: prog.degreeLevel,
            applicationDeadline: prog.applicationDeadline,
          },
          university: uni
            ? { id: uni.id, name: uni.name, country: uni.country }
            : null,
          sourceUrl: reqRow?.sourceUrl ?? prog.sourceUrl,
          lastVerifiedDate: reqRow?.lastVerifiedDate ?? prog.lastVerifiedDate,
          documentCheck: evaluateRequiredDocuments(requiredDocs, userDocs),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Aggregate across all checked programmes (or baseline core documents if none selected/tracked)
    const combinedRequiredDocs =
      programmeChecks.length > 0
        ? Array.from(
            new Set(
              programmeChecks.flatMap((pc) =>
                pc.documentCheck.items.map((item) => item.requiredDocument)
              )
            )
          )
        : ['Passport', 'CV / Resume', 'Academic transcripts', 'Degree certificate', 'IELTS certificate'];

    const overallSummary = evaluateRequiredDocuments(combinedRequiredDocs, userDocs);

    return res.json({
      mode: programmeIdParam ? 'single' : 'tracked',
      hasTrackedProgrammes: programmeChecks.length > 0,
      overallSummary,
      programmeChecks,
    });
  } catch (error) {
    console.error('Failed to check required documents:', error);
    return res.status(500).json({ error: 'Unable to evaluate document checklist.' });
  }
});

studentFeaturesRouter.get('/eligibility/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const checks = await db
      .select()
      .from(eligibilityChecks)
      .where(eq(eligibilityChecks.userId, req.dbUser!.id))
      .orderBy(desc(eligibilityChecks.createdAt))
      .limit(25);

    const allProgs = await db.select().from(programmes);
    const allUnis = await db.select().from(universities);
    const progMap = new Map(allProgs.map((p) => [p.id, p]));
    const uniMap = new Map(allUnis.map((u) => [u.id, u]));

    const items = checks.map((c) => {
      const prog = progMap.get(c.programmeId);
      const uni = prog ? uniMap.get(prog.universityId) : undefined;
      return {
        ...c,
        programme: prog ?? null,
        university: uni ?? null,
      };
    });

    return res.json({ items });
  } catch (error) {
    console.error('Failed to fetch eligibility history:', error);
    return res.status(500).json({ error: 'Unable to load eligibility history.' });
  }
});

// --- SCHOLARSHIPS ---
studentFeaturesRouter.get('/scholarships', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const {
      q = '',
      country = '',
      degreeLevel = '',
      fundingType = '',
      nationality = '',
      sort = 'deadline',
    } = req.query as Record<string, string>;

    const allSch = await db.select().from(scholarships);
    const allElig = await db.select().from(scholarshipEligibility);
    const eligMap = new Map(allElig.map((e) => [e.scholarshipId, e]));

    const qLower = q.trim().toLowerCase();

    const items = allSch
      .map((s) => ({
        ...s,
        eligibility: eligMap.get(s.id) ?? null,
      }))
      .filter((s) => {
        if (country && !s.country.toLowerCase().includes(country.toLowerCase())) return false;
        if (fundingType && s.fundingType.toLowerCase() !== fundingType.toLowerCase()) return false;
        if (degreeLevel) {
          const levels = s.eligibility?.eligibleDegreeLevels ?? [];
          if (!levels.some((l) => l.toLowerCase() === degreeLevel.toLowerCase())) return false;
        }
        if (nationality) {
          const nats = s.eligibility?.eligibleNationalities ?? [];
          const matchesNat = nats.some(
            (n) =>
              n.toLowerCase().includes(nationality.toLowerCase()) ||
              n.toLowerCase().includes('all nationalities')
          );
          if (!matchesNat) return false;
        }
        if (qLower) {
          const hit =
            s.name.toLowerCase().includes(qLower) ||
            s.provider.toLowerCase().includes(qLower) ||
            s.country.toLowerCase().includes(qLower) ||
            s.eligibilityRequirements.toLowerCase().includes(qLower);
          if (!hit) return false;
        }
        return true;
      });

    items.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return (a.applicationDeadline ?? '9999-12-31').localeCompare(b.applicationDeadline ?? '9999-12-31');
    });

    const countries = Array.from(new Set(allSch.map((s) => s.country))).sort();

    return res.json({ items, total: items.length, facets: { countries } });
  } catch (error) {
    console.error('Failed to fetch scholarships:', error);
    return res.status(500).json({ error: 'Unable to load scholarships.' });
  }
});

studentFeaturesRouter.get('/scholarships/:id', async (req, res) => {
  try {
    await ensureDatabaseSeeded();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid scholarship ID.' });

    const [sch] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
    if (!sch) return res.status(404).json({ error: 'Scholarship not found.' });

    const [elig] = await db
      .select()
      .from(scholarshipEligibility)
      .where(eq(scholarshipEligibility.scholarshipId, id))
      .limit(1);

    return res.json({ scholarship: sch, eligibility: elig ?? null });
  } catch (error) {
    console.error('Failed to fetch scholarship details:', error);
    return res.status(500).json({ error: 'Unable to load scholarship details.' });
  }
});

studentFeaturesRouter.post('/scholarships/:id/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const scholarshipId = Number(req.params.id);
    if (!Number.isInteger(scholarshipId)) return res.status(400).json({ error: 'Invalid scholarship ID.' });

    const [sch] = await db
      .select({ id: scholarships.id })
      .from(scholarships)
      .where(eq(scholarships.id, scholarshipId))
      .limit(1);
    if (!sch) return res.status(404).json({ error: 'Scholarship not found.' });

    const userId = req.dbUser!.id;
    const existing = await db
      .select()
      .from(studentShortlists)
      .where(
        and(
          eq(studentShortlists.userId, userId),
          eq(studentShortlists.itemType, 'scholarship'),
          eq(studentShortlists.scholarshipId, scholarshipId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({ item: existing[0], alreadySaved: true });
    }

    const [created] = await db
      .insert(studentShortlists)
      .values({ userId, itemType: 'scholarship', scholarshipId })
      .returning();

    return res.status(201).json({ item: created });
  } catch (error) {
    console.error('Failed to save scholarship:', error);
    return res.status(500).json({ error: 'Unable to save scholarship.' });
  }
});

// --- STUDENT DASHBOARD ---
studentFeaturesRouter.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const userId = req.dbUser!.id;

    const [
      [profile],
      shortlists,
      userApps,
      userDocs,
      userReminders,
      recentViews,
      allUnis,
      allProgs,
      allReqs,
      allSch,
    ] = await Promise.all([
      db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1),
      db.select().from(studentShortlists).where(eq(studentShortlists.userId, userId)).orderBy(desc(studentShortlists.createdAt)),
      db.select().from(applications).where(eq(applications.userId, userId)).orderBy(desc(applications.updatedAt)),
      db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.uploadedAt)),
      db.select().from(reminders).where(eq(reminders.userId, userId)),
      db.select().from(recentlyViewed).where(eq(recentlyViewed.userId, userId)).orderBy(desc(recentlyViewed.viewedAt)).limit(5),
      db.select().from(universities),
      db.select().from(programmes),
      db.select().from(programmeRequirements),
      db.select().from(scholarships),
    ]);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const progMap = new Map(allProgs.map((p) => [p.id, p]));
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    // Eligible programmes count using deterministic engine
    let eligibleCount = 0;
    const recommendedProgrammes: Array<Record<string, unknown>> = [];

    for (const prog of allProgs) {
      const reqRow = reqMap.get(prog.id);
      const uni = uniMap.get(prog.universityId);
      if (!reqRow || !uni) continue;

      const evalRes = evaluateEligibility(profile ?? {}, reqRow);
      if (evalRes.overallStatus === 'meets_requirements') {
        eligibleCount += 1;
      }

      // Preference relevance score for ordering recommended programmes
      let matchScore = evalRes.overallStatus === 'meets_requirements' ? 3 : evalRes.overallStatus === 'needs_manual_verification' ? 2 : 0;
      if (profile?.desiredDegreeLevel && prog.degreeLevel.toLowerCase() === profile.desiredDegreeLevel.toLowerCase()) {
        matchScore += 2;
      }
      if (profile?.preferredCountries?.some((c) => c.toLowerCase() === uni.country.toLowerCase())) {
        matchScore += 2;
      }

      recommendedProgrammes.push({
        programme: prog,
        university: uni,
        eligibilityStatus: evalRes.overallStatus,
        eligibilityLabel: evalRes.summaryLabel,
        matchScore,
      });
    }

    recommendedProgrammes.sort((a, b) => Number(b.matchScore) - Number(a.matchScore));

    // Application status chart breakdown
    const statuses = [
      'Interested',
      'Researching',
      'Preparing Documents',
      'Ready to Apply',
      'Submitted',
      'Under Review',
      'Interview',
      'Accepted',
      'Rejected',
      'Withdrawn',
    ];
    const statusChart = statuses
      .map((s) => ({
        status: s,
        count: userApps.filter((a) => a.status === s).length,
      }))
      .filter((x) => x.count > 0);

    const inProgressCount = userApps.filter((a) =>
      ['Interested', 'Researching', 'Preparing Documents', 'Ready to Apply'].includes(a.status)
    ).length;
    const submittedCount = userApps.filter((a) =>
      ['Submitted', 'Under Review', 'Interview', 'Accepted'].includes(a.status)
    ).length;

    // Missing documents based on active applications + baseline core documents
    const uploadedCategories = new Set(userDocs.map((d) => d.category.toLowerCase()));
    const requiredDocSet = new Set<string>(['Passport', 'CV / Resume', 'Academic transcripts']);
    for (const app of userApps) {
      const reqRow = reqMap.get(app.programmeId);
      for (const docName of reqRow?.requiredDocuments ?? []) {
        requiredDocSet.add(docName);
      }
    }
    const missingDocuments = Array.from(requiredDocSet).filter((docName) => {
      const norm = docName.toLowerCase();
      return !Array.from(uploadedCategories).some((cat) => cat.includes(norm) || norm.includes(cat));
    });

    // Upcoming deadlines (combine programme deadlines from applications + user reminders)
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcomingDeadlines = [
      ...userReminders
        .filter((r) => !r.isCompleted && r.dueDate >= todayStr)
        .map((r) => ({
          id: `rem-${r.id}`,
          title: r.title,
          date: r.dueDate,
          category: r.category,
        })),
      ...userApps
        .filter((a) => a.applicationDeadline && a.applicationDeadline >= todayStr)
        .map((a) => {
          const prog = progMap.get(a.programmeId);
          const uni = uniMap.get(a.universityId);
          return {
            id: `app-${a.id}`,
            title: `${uni?.name ?? 'University'} — ${prog?.name ?? 'Programme'}`,
            date: a.applicationDeadline!,
            category: 'application_deadline',
          };
        }),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);

    // Recent activity feed from real DB rows
    const recentActivity = [
      ...shortlists.slice(0, 3).map((s) => ({
        id: `sl-${s.id}`,
        type: 'shortlist',
        description: `Shortlisted ${
          s.programmeId
            ? progMap.get(s.programmeId)?.name
            : s.universityId
              ? uniMap.get(s.universityId)?.name
              : 'Scholarship'
        }`,
        timestamp: s.createdAt,
      })),
      ...userDocs.slice(0, 3).map((d) => ({
        id: `doc-${d.id}`,
        type: 'document',
        description: `Uploaded ${d.title} (${d.category})`,
        timestamp: d.uploadedAt,
      })),
      ...userApps.slice(0, 3).map((a) => ({
        id: `app-${a.id}`,
        type: 'application',
        description: `Application for ${progMap.get(a.programmeId)?.name ?? 'Programme'} — ${a.status}`,
        timestamp: a.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);

    return res.json({
      stats: {
        shortlistedCount: shortlists.length,
        inProgressCount,
        submittedCount,
        upcomingDeadlinesCount: upcomingDeadlines.length,
        eligibleProgrammesCount: eligibleCount,
      },
      recentlyViewed: recentViews
        .map((rv) => uniMap.get(rv.universityId))
        .filter(Boolean),
      recommendedProgrammes: recommendedProgrammes.slice(0, 4),
      upcomingDeadlines,
      scholarships: allSch.slice(0, 4),
      statusChart,
      missingDocuments: missingDocuments.slice(0, 6),
      recentActivity,
    });
  } catch (error) {
    console.error('Failed to load dashboard:', error);
    return res.status(500).json({ error: 'Unable to load student dashboard.' });
  }
});
