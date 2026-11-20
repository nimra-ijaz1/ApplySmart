import { Router } from 'express';
import { count, desc, eq } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  adminAuditLogs,
  applications,
  dataSources,
  programmeRequirements,
  programmes,
  scholarshipEligibility,
  scholarships,
  systemSettings,
  universities,
  users,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  commitValidatedCsvImport,
  validateCsvImport,
} from '../services/csvImportService.ts';

export const adminRouter = Router();

async function logAdminAction(
  actor: { id: number; email: string },
  action: string,
  entityType: string,
  entityId: number | null,
  details?: Record<string, unknown>
) {
  await db.insert(adminAuditLogs).values({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    entityType,
    entityId,
    details: details ?? {},
  });
}

adminRouter.use('/admin', requireAuth, requireRole('admin', 'super_admin'));

adminRouter.get('/admin/overview', async (_req, res) => {
  try {
    await ensureDatabaseSeeded();
    const [[uCount], [uniCount], [progCount], [schCount], [appCount], pendingSources] =
      await Promise.all([
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(universities),
        db.select({ value: count() }).from(programmes),
        db.select({ value: count() }).from(scholarships),
        db.select({ value: count() }).from(applications),
        db.select().from(universities).where(eq(universities.verificationStatus, 'pending_verification')),
      ]);

    return res.json({
      stats: {
        totalUsers: Number(uCount.value),
        totalUniversities: Number(uniCount.value),
        totalProgrammes: Number(progCount.value),
        totalScholarships: Number(schCount.value),
        totalApplications: Number(appCount.value),
        pendingVerificationCount: pendingSources.length,
      },
    });
  } catch (error) {
    console.error('Admin overview failed:', error);
    return res.status(500).json({ error: 'Unable to load admin overview.' });
  }
});

// --- UNIVERSITIES CRUD ---
const uniSchema = z.object({
  name: z.string().min(2).max(200),
  country: z.string().min(2).max(100),
  city: z.string().min(2).max(100),
  officialWebsite: z.string().url(),
  logoUrl: z.string().url().nullable().optional(),
  description: z.string().min(10).max(3000),
  institutionType: z.enum(['Public', 'Private']).default('Public'),
  globalRanking: z.coerce.number().int().positive().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  sourceUrl: z.string().url(),
  lastVerifiedDate: z.string().min(8).max(20),
  verificationStatus: z
    .enum(['verified', 'pending_verification', 'outdated'])
    .default('verified'),
  isDemoRecord: z.boolean().optional().default(false),
});

adminRouter.post('/admin/universities', async (req: AuthRequest, res) => {
  try {
    const parsed = uniSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid university data.', details: parsed.error.flatten() });
    }
    const [created] = await db.insert(universities).values(parsed.data).returning();
    await db.insert(dataSources).values({
      entityType: 'university',
      entityId: created.id,
      sourceUrl: created.sourceUrl,
      verificationStatus: created.verificationStatus,
      verifiedByUserId: req.dbUser!.id,
      lastVerifiedDate: created.lastVerifiedDate,
    });
    await logAdminAction(req.dbUser!, 'CREATE_UNIVERSITY', 'university', created.id, { name: created.name });
    return res.status(201).json({ university: created });
  } catch (error) {
    console.error('Admin create university failed:', error);
    return res.status(500).json({ error: 'Unable to create university.' });
  }
});

adminRouter.put('/admin/universities/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const parsed = uniSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid update data.' });

    const [updated] = await db
      .update(universities)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(universities.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'University not found.' });

    await logAdminAction(req.dbUser!, 'UPDATE_UNIVERSITY', 'university', id, { name: updated.name });
    return res.json({ university: updated });
  } catch (error) {
    console.error('Admin update university failed:', error);
    return res.status(500).json({ error: 'Unable to update university.' });
  }
});

adminRouter.delete('/admin/universities/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const [deleted] = await db.delete(universities).where(eq(universities.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'University not found.' });

    await logAdminAction(req.dbUser!, 'DELETE_UNIVERSITY', 'university', id, { name: deleted.name });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Admin delete university failed:', error);
    return res.status(500).json({ error: 'Unable to delete university.' });
  }
});

// --- PROGRAMMES CRUD ---
const progSchema = z.object({
  universityId: z.coerce.number().int(),
  name: z.string().min(2).max(200),
  degreeLevel: z.enum(["Bachelor's", "Master's", 'PhD']),
  subjectArea: z.string().min(2).max(150),
  description: z.string().min(10).max(3000),
  duration: z.string().min(2).max(80),
  studyLanguage: z.string().default('English'),
  tuitionFee: z.coerce.number().int().min(0),
  currency: z.string().min(3).max(10).default('USD'),
  tuitionFeeUsdApprox: z.coerce.number().int().min(0),
  applicationFee: z.coerce.number().int().min(0).default(0),
  applicationOpeningDate: z.string().nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
  intake: z.string().min(2).max(80),
  scholarshipAvailability: z.boolean().default(false),
  officialProgrammeUrl: z.string().url(),
  sourceUrl: z.string().url(),
  lastVerifiedDate: z.string().min(8).max(20),
  minCgpa: z.union([z.coerce.number().min(0).max(10), z.null()]).optional(),
  cgpaScale: z.union([z.coerce.number().min(1).max(100), z.null()]).optional(),
  requiredDegreeBackground: z.string().min(2).max(300),
  acceptedDegreeFields: z.array(z.string()).optional().default([]),
  ieltsOverall: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsListening: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsReading: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsWriting: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  ieltsSpeaking: z.union([z.coerce.number().min(0).max(9), z.null()]).optional(),
  toeflMin: z.union([z.coerce.number().int().min(0).max(120), z.null()]).optional(),
  requiredDocuments: z.array(z.string()).optional().default([]),
});

adminRouter.post('/admin/programmes', async (req: AuthRequest, res) => {
  try {
    const parsed = progSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid programme payload.', details: parsed.error.flatten() });
    }

    const d = parsed.data;
    if (d.minCgpa != null && d.cgpaScale != null && d.minCgpa > d.cgpaScale) {
      return res.status(400).json({ error: 'minCgpa cannot exceed cgpaScale.' });
    }

    const [uni] = await db
      .select({ id: universities.id })
      .from(universities)
      .where(eq(universities.id, d.universityId))
      .limit(1);
    if (!uni) {
      return res.status(404).json({ error: 'Referenced university not found.' });
    }

    const created = await db.transaction(async (tx) => {
      const [progRow] = await tx
        .insert(programmes)
        .values({
          universityId: d.universityId,
          name: d.name,
          degreeLevel: d.degreeLevel,
          subjectArea: d.subjectArea,
          description: d.description,
          duration: d.duration,
          studyLanguage: d.studyLanguage,
          tuitionFee: d.tuitionFee,
          currency: d.currency,
          tuitionFeeUsdApprox: d.tuitionFeeUsdApprox,
          applicationFee: d.applicationFee,
          applicationOpeningDate: d.applicationOpeningDate ?? null,
          applicationDeadline: d.applicationDeadline ?? null,
          intake: d.intake,
          scholarshipAvailability: d.scholarshipAvailability,
          officialProgrammeUrl: d.officialProgrammeUrl,
          sourceUrl: d.sourceUrl,
          lastVerifiedDate: d.lastVerifiedDate,
          verificationStatus: 'verified',
          isDemoRecord: false,
        })
        .returning();

      await tx.insert(programmeRequirements).values({
        programmeId: progRow.id,
        minCgpa: d.minCgpa != null ? String(d.minCgpa) : null,
        cgpaScale: d.cgpaScale != null ? String(d.cgpaScale) : '4.00',
        requiredDegreeBackground: d.requiredDegreeBackground,
        acceptedDegreeFields: d.acceptedDegreeFields,
        requiresCompletedDegree: true,
        ieltsOverall: d.ieltsOverall != null ? String(d.ieltsOverall) : null,
        ieltsListening: d.ieltsListening != null ? String(d.ieltsListening) : null,
        ieltsReading: d.ieltsReading != null ? String(d.ieltsReading) : null,
        ieltsWriting: d.ieltsWriting != null ? String(d.ieltsWriting) : null,
        ieltsSpeaking: d.ieltsSpeaking != null ? String(d.ieltsSpeaking) : null,
        toeflMin: d.toeflMin ?? null,
        requiredDocuments: d.requiredDocuments,
        sourceUrl: d.sourceUrl,
        lastVerifiedDate: d.lastVerifiedDate,
      });

      await tx.insert(dataSources).values({
        entityType: 'programme',
        entityId: progRow.id,
        sourceUrl: progRow.sourceUrl,
        verificationStatus: 'verified',
        verifiedByUserId: req.dbUser!.id,
        lastVerifiedDate: progRow.lastVerifiedDate,
      });

      return progRow;
    });

    await logAdminAction(req.dbUser!, 'CREATE_PROGRAMME', 'programme', created.id, { name: created.name });
    return res.status(201).json({ programme: created });
  } catch (error) {
    console.error('Admin create programme failed:', error);
    return res.status(500).json({ error: 'Unable to create programme.' });
  }
});

adminRouter.delete('/admin/programmes/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const [deleted] = await db.delete(programmes).where(eq(programmes.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Programme not found.' });

    await logAdminAction(req.dbUser!, 'DELETE_PROGRAMME', 'programme', id, { name: deleted.name });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Admin delete programme failed:', error);
    return res.status(500).json({ error: 'Unable to delete programme.' });
  }
});

// --- SCHOLARSHIPS CRUD ---
const schSchema = z.object({
  name: z.string().min(2).max(200),
  provider: z.string().min(2).max(200),
  country: z.string().min(2).max(100),
  fundingType: z.enum(['full', 'partial']),
  fundingPercentage: z.coerce.number().int().min(1).max(100).nullable().optional(),
  tuitionCoverage: z.string().min(2).max(400),
  monthlyStipend: z.string().max(200).nullable().optional(),
  travelAllowance: z.string().max(200).nullable().optional(),
  accommodationCoverage: z.string().max(200).nullable().optional(),
  eligibilityRequirements: z.string().min(5).max(3000),
  applicationOpeningDate: z.string().nullable().optional(),
  applicationDeadline: z.string().nullable().optional(),
  officialUrl: z.string().url(),
  sourceUrl: z.string().url(),
  lastVerifiedDate: z.string().min(8).max(20),
  eligibleNationalities: z.array(z.string()).optional().default(['Pakistan', 'All Nationalities']),
  eligibleDegreeLevels: z.array(z.string()).optional().default(["Master's"]),
});

adminRouter.post('/admin/scholarships', async (req: AuthRequest, res) => {
  try {
    const parsed = schSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid scholarship payload.', details: parsed.error.flatten() });
    }

    const d = parsed.data;
    const created = await db.transaction(async (tx) => {
      const [schRow] = await tx
        .insert(scholarships)
        .values({
          name: d.name,
          provider: d.provider,
          country: d.country,
          fundingType: d.fundingType,
          fundingPercentage: d.fundingPercentage ?? null,
          tuitionCoverage: d.tuitionCoverage,
          monthlyStipend: d.monthlyStipend ?? null,
          travelAllowance: d.travelAllowance ?? null,
          accommodationCoverage: d.accommodationCoverage ?? null,
          eligibilityRequirements: d.eligibilityRequirements,
          applicationOpeningDate: d.applicationOpeningDate ?? null,
          applicationDeadline: d.applicationDeadline ?? null,
          officialUrl: d.officialUrl,
          sourceUrl: d.sourceUrl,
          lastVerifiedDate: d.lastVerifiedDate,
          verificationStatus: 'verified',
          isDemoRecord: false,
        })
        .returning();

      await tx.insert(scholarshipEligibility).values({
        scholarshipId: schRow.id,
        eligibleNationalities: d.eligibleNationalities,
        eligibleDegreeLevels: d.eligibleDegreeLevels,
      });

      await tx.insert(dataSources).values({
        entityType: 'scholarship',
        entityId: schRow.id,
        sourceUrl: schRow.sourceUrl,
        verificationStatus: 'verified',
        verifiedByUserId: req.dbUser!.id,
        lastVerifiedDate: schRow.lastVerifiedDate,
      });

      return schRow;
    });

    await logAdminAction(req.dbUser!, 'CREATE_SCHOLARSHIP', 'scholarship', created.id, { name: created.name });
    return res.status(201).json({ scholarship: created });
  } catch (error) {
    console.error('Admin create scholarship failed:', error);
    return res.status(500).json({ error: 'Unable to create scholarship.' });
  }
});

adminRouter.delete('/admin/scholarships/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const [deleted] = await db.delete(scholarships).where(eq(scholarships.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Scholarship not found.' });

    await logAdminAction(req.dbUser!, 'DELETE_SCHOLARSHIP', 'scholarship', id, { name: deleted.name });
    return res.json({ deleted: true });
  } catch (error) {
    console.error('Admin delete scholarship failed:', error);
    return res.status(500).json({ error: 'Unable to delete scholarship.' });
  }
});

// --- CSV VALIDATION & BULK IMPORT FOR UNIVERSITIES & PROGRAMMES ---
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = new Set([
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'text/plain',
      'application/octet-stream',
    ]);
    if (file.originalname.toLowerCase().endsWith('.csv') || allowedMimes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv files are accepted for bulk upload.'));
    }
  },
});

const bulkUploadOptionsSchema = z.object({
  entityType: z.enum(['universities', 'programmes']).default('universities'),
  mode: z.enum(['validate', 'commit']).default('validate'),
  skipDuplicates: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? true : v === true || v === 'true')),
  skipInvalidRows: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

adminRouter.post('/admin/bulk-upload', (req: AuthRequest, res) => {
  csvUpload.single('file')(req, res, async (uploadErr: unknown) => {
    if (uploadErr) {
      const message =
        uploadErr instanceof Error ? uploadErr.message : 'CSV file upload validation failed.';
      return res.status(400).json({ error: message });
    }

    try {
      await ensureDatabaseSeeded();
      const parsedOptions = bulkUploadOptionsSchema.safeParse(req.body ?? {});
      if (!parsedOptions.success) {
        return res.status(400).json({
          error: parsedOptions.error.issues[0]?.message || 'Invalid bulk upload options.',
        });
      }

      const file = req.file;
      const csvText = file
        ? file.buffer.toString('utf8')
        : typeof req.body?.csvText === 'string'
          ? req.body.csvText
          : '';

      if (!csvText.trim()) {
        return res.status(400).json({ error: 'A non-empty CSV file is required.' });
      }

      const { entityType, mode, skipDuplicates, skipInvalidRows } = parsedOptions.data;
      const report = await validateCsvImport(entityType, csvText);

      if (mode === 'validate') {
        return res.json({
          fileName: file?.originalname ?? 'inline.csv',
          fileSize: file?.size ?? Buffer.byteLength(csvText, 'utf8'),
          mode: 'validate',
          report,
        });
      }

      const commitResult = await commitValidatedCsvImport({
        entityType,
        csvText,
        skipDuplicates,
        skipInvalidRows,
        actorUserId: req.dbUser!.id,
      });

      await logAdminAction(
        req.dbUser!,
        entityType === 'universities'
          ? 'CSV_BULK_UPLOAD_UNIVERSITIES'
          : 'CSV_BULK_UPLOAD_PROGRAMMES',
        entityType === 'universities' ? 'university' : 'programme',
        null,
        {
          fileName: file?.originalname ?? 'inline.csv',
          ...commitResult,
        }
      );

      return res.status(201).json({
        fileName: file?.originalname ?? 'inline.csv',
        fileSize: file?.size ?? Buffer.byteLength(csvText, 'utf8'),
        mode: 'commit',
        report,
        commitResult,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bulk CSV processing failed.';
      const isValidationErr =
        message.includes('Missing required') ||
        message.includes('Validation failed') ||
        message.includes('already exist') ||
        message.includes('no data rows');
      console.error('Admin bulk-upload failed:', error);
      return res.status(isValidationErr ? 400 : 500).json({ error: message });
    }
  });
});

const csvValidateSchema = z.object({
  entityType: z.enum(['universities', 'programmes']).default('universities'),
  csvText: z.string().min(1, 'CSV content is required.').max(2_000_000, 'CSV exceeds 2MB limit.'),
});

const csvCommitSchema = z.object({
  entityType: z.enum(['universities', 'programmes']).default('universities'),
  csvText: z.string().min(1, 'CSV content is required.').max(2_000_000, 'CSV exceeds 2MB limit.'),
  skipDuplicates: z.boolean().default(true),
  skipInvalidRows: z.boolean().default(false),
});

adminRouter.post('/admin/import-csv/validate', async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const parsed = csvValidateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid CSV validation payload.',
      });
    }

    const report = await validateCsvImport(parsed.data.entityType, parsed.data.csvText);
    return res.json(report);
  } catch (error) {
    console.error('CSV validation failed:', error);
    return res.status(500).json({ error: 'Failed to validate CSV content.' });
  }
});

adminRouter.post('/admin/import-csv/commit', async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const parsed = csvCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid CSV import payload.',
      });
    }

    const result = await commitValidatedCsvImport({
      entityType: parsed.data.entityType,
      csvText: parsed.data.csvText,
      skipDuplicates: parsed.data.skipDuplicates,
      skipInvalidRows: parsed.data.skipInvalidRows,
      actorUserId: req.dbUser!.id,
    });

    await logAdminAction(
      req.dbUser!,
      parsed.data.entityType === 'universities'
        ? 'CSV_IMPORT_UNIVERSITIES'
        : 'CSV_IMPORT_PROGRAMMES',
      parsed.data.entityType === 'universities' ? 'university' : 'programme',
      null,
      result
    );

    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to commit CSV records.';
    const isValidationErr =
      message.includes('Missing required') ||
      message.includes('Validation failed') ||
      message.includes('already exist') ||
      message.includes('no data rows');
    console.error('CSV commit failed:', error);
    return res.status(isValidationErr ? 400 : 500).json({ error: message });
  }
});

adminRouter.post('/admin/import-csv', async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const csvText = typeof req.body?.csvText === 'string' ? req.body.csvText : '';
    const entityType = req.body?.entityType === 'programmes' ? 'programmes' : 'universities';
    if (!csvText.trim()) return res.status(400).json({ error: 'CSV content is required.' });

    const result = await commitValidatedCsvImport({
      entityType,
      csvText,
      skipDuplicates: true,
      skipInvalidRows: true,
      actorUserId: req.dbUser!.id,
    });

    await logAdminAction(
      req.dbUser!,
      entityType === 'universities' ? 'CSV_IMPORT_UNIVERSITIES' : 'CSV_IMPORT_PROGRAMMES',
      entityType === 'universities' ? 'university' : 'programme',
      null,
      result
    );
    return res.status(201).json(result);
  } catch (error) {
    console.error('CSV import failed:', error);
    return res.status(500).json({ error: 'Failed to import CSV records.' });
  }
});

// --- DATA VERIFICATION ---
adminRouter.get('/admin/verification', async (_req, res) => {
  try {
    await ensureDatabaseSeeded();
    const [unis, progs, schs] = await Promise.all([
      db.select().from(universities),
      db.select().from(programmes),
      db.select().from(scholarships),
    ]);

    const items = [
      ...unis.map((u) => ({
        entityType: 'university',
        entityId: u.id,
        title: u.name,
        subtitle: `${u.city}, ${u.country}`,
        sourceUrl: u.sourceUrl,
        lastVerifiedDate: u.lastVerifiedDate,
        verificationStatus: u.verificationStatus,
        isDemoRecord: u.isDemoRecord,
      })),
      ...progs.map((p) => ({
        entityType: 'programme',
        entityId: p.id,
        title: p.name,
        subtitle: `${p.degreeLevel} · ${p.subjectArea}`,
        sourceUrl: p.sourceUrl,
        lastVerifiedDate: p.lastVerifiedDate,
        verificationStatus: p.verificationStatus,
        isDemoRecord: p.isDemoRecord,
      })),
      ...schs.map((s) => ({
        entityType: 'scholarship',
        entityId: s.id,
        title: s.name,
        subtitle: `${s.provider} · ${s.country}`,
        sourceUrl: s.sourceUrl,
        lastVerifiedDate: s.lastVerifiedDate,
        verificationStatus: s.verificationStatus,
        isDemoRecord: s.isDemoRecord,
      })),
    ];

    return res.json({ items });
  } catch (error) {
    console.error('Verification queue failed:', error);
    return res.status(500).json({ error: 'Unable to load verification queue.' });
  }
});

adminRouter.put('/admin/verification/:entityType/:id', async (req: AuthRequest, res) => {
  try {
    const { entityType, id } = req.params;
    const entityId = Number(id);
    if (!Number.isInteger(entityId)) return res.status(400).json({ error: 'Invalid ID.' });

    const schema = z.object({
      verificationStatus: z.enum(['verified', 'pending_verification', 'outdated']),
      sourceUrl: z.string().url().optional(),
      lastVerifiedDate: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid verification update.' });

    const today = parsed.data.lastVerifiedDate || new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = {
      verificationStatus: parsed.data.verificationStatus,
      lastVerifiedDate: today,
      updatedAt: new Date(),
    };
    if (parsed.data.sourceUrl) patch.sourceUrl = parsed.data.sourceUrl;

    if (entityType === 'university') {
      await db.update(universities).set(patch).where(eq(universities.id, entityId));
    } else if (entityType === 'programme') {
      await db.update(programmes).set(patch).where(eq(programmes.id, entityId));
    } else if (entityType === 'scholarship') {
      await db.update(scholarships).set(patch).where(eq(scholarships.id, entityId));
    } else {
      return res.status(400).json({ error: 'Invalid entityType.' });
    }

    await logAdminAction(req.dbUser!, 'VERIFY_RECORD', entityType, entityId, parsed.data);
    return res.json({ updated: true });
  } catch (error) {
    console.error('Failed to update verification:', error);
    return res.status(500).json({ error: 'Unable to update verification status.' });
  }
});

// --- USER MANAGEMENT ---
adminRouter.get('/admin/users', async (_req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    return res.json({ items: allUsers });
  } catch (error) {
    console.error('Admin users failed:', error);
    return res.status(500).json({ error: 'Unable to load users.' });
  }
});

adminRouter.put('/admin/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user ID.' });

    const schema = z.object({
      role: z.enum(['student', 'admin', 'super_admin']).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid user update.' });

    const [targetUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    // Only super_admin can assign roles or modify super_admin accounts
    if (parsed.data.role && req.dbUser!.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Administrators can modify user roles.' });
    }
    if (targetUser.role === 'super_admin' && req.dbUser!.role !== 'super_admin') {
      return res.status(403).json({ error: 'Administrators cannot modify Super Administrator accounts.' });
    }
    if (id === req.dbUser!.id && parsed.data.isActive === false) {
      return res.status(400).json({ error: 'You cannot suspend your own account.' });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.role !== undefined) patch.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) patch.isActive = parsed.data.isActive;

    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    await logAdminAction(req.dbUser!, 'UPDATE_USER', 'user', id, parsed.data);
    return res.json({ user: updated });
  } catch (error) {
    console.error('Admin update user failed:', error);
    return res.status(500).json({ error: 'Unable to update user.' });
  }
});

// --- AUDIT LOGS & SYSTEM SETTINGS (SUPER ADMIN) ---
adminRouter.get('/admin/audit-logs', requireRole('super_admin'), async (_req, res) => {
  try {
    const logs = await db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(100);
    return res.json({ items: logs });
  } catch (error) {
    console.error('Audit logs failed:', error);
    return res.status(500).json({ error: 'Unable to load audit logs.' });
  }
});

adminRouter.get('/admin/settings', requireRole('super_admin'), async (_req, res) => {
  try {
    await ensureDatabaseSeeded();
    const rows = await db.select().from(systemSettings);
    return res.json({ items: rows });
  } catch (error) {
    console.error('System settings failed:', error);
    return res.status(500).json({ error: 'Unable to load system settings.' });
  }
});

adminRouter.put('/admin/settings', requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      key: z.string().min(2).max(100),
      value: z.record(z.string(), z.unknown()),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid setting payload.' });

    const [updated] = await db
      .insert(systemSettings)
      .values({
        key: parsed.data.key,
        value: parsed.data.value,
        updatedByUserId: req.dbUser!.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: parsed.data.value,
          updatedByUserId: req.dbUser!.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAdminAction(req.dbUser!, 'UPDATE_SYSTEM_SETTING', 'system_setting', updated.id, {
      key: parsed.data.key,
    });
    return res.json({ setting: updated });
  } catch (error) {
    console.error('Update system setting failed:', error);
    return res.status(500).json({ error: 'Unable to save system settings.' });
  }
});
