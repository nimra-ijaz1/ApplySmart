import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  applicationDocuments,
  applications,
  applicationStatusHistory,
  documents,
  programmes,
  universities,
} from '../../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { isValidIsoDate } from '../utils/validation.ts';

export const applicationsRouter = Router();

export const APPLICATION_STATUSES = [
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
] as const;

applicationsRouter.get('/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const rows = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.updatedAt));

    const [allUnis, allProgs, appDocs, userDocs] = await Promise.all([
      db.select().from(universities),
      db.select().from(programmes),
      db.select().from(applicationDocuments),
      db.select().from(documents).where(eq(documents.userId, userId)),
    ]);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const progMap = new Map(allProgs.map((p) => [p.id, p]));
    const docMap = new Map(userDocs.map((d) => [d.id, { ...d, fileDataBase64: undefined }]));

    const items = rows.map((app) => {
      const attachedIds = appDocs.filter((ad) => ad.applicationId === app.id).map((ad) => ad.documentId);
      return {
        ...app,
        university: uniMap.get(app.universityId) ?? null,
        programme: progMap.get(app.programmeId) ?? null,
        attachedDocuments: attachedIds.map((id) => docMap.get(id)).filter(Boolean),
      };
    });

    return res.json({ items });
  } catch (error) {
    console.error('Failed to fetch applications:', error);
    return res.status(500).json({ error: 'Unable to load applications.' });
  }
});

applicationsRouter.get('/applications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid application ID.' });

    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, req.dbUser!.id)))
      .limit(1);

    if (!app) return res.status(404).json({ error: 'Application not found.' });

    const [[university], [programme], history, attachedRows, userDocs] = await Promise.all([
      db.select().from(universities).where(eq(universities.id, app.universityId)).limit(1),
      db.select().from(programmes).where(eq(programmes.id, app.programmeId)).limit(1),
      db
        .select()
        .from(applicationStatusHistory)
        .where(eq(applicationStatusHistory.applicationId, id))
        .orderBy(desc(applicationStatusHistory.createdAt)),
      db.select().from(applicationDocuments).where(eq(applicationDocuments.applicationId, id)),
      db.select().from(documents).where(eq(documents.userId, req.dbUser!.id)),
    ]);

    const docMap = new Map(userDocs.map((d) => [d.id, { ...d, fileDataBase64: undefined }]));

    return res.json({
      application: app,
      university: university ?? null,
      programme: programme ?? null,
      history,
      attachedDocuments: attachedRows.map((ar) => docMap.get(ar.documentId)).filter(Boolean),
    });
  } catch (error) {
    console.error('Failed to load application details:', error);
    return res.status(500).json({ error: 'Unable to load application details.' });
  }
});

const createAppSchema = z.object({
  universityId: z.number().int(),
  programmeId: z.number().int(),
  status: z.enum(APPLICATION_STATUSES).optional().default('Interested'),
  portalUrl: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

applicationsRouter.post('/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = createAppSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid application payload.' });

    const { universityId, programmeId, status, portalUrl, notes } = parsed.data;
    const [prog] = await db.select().from(programmes).where(eq(programmes.id, programmeId)).limit(1);
    if (!prog) return res.status(404).json({ error: 'Programme not found.' });
    if (universityId !== prog.universityId) {
      return res.status(400).json({ error: 'Selected programme does not belong to the specified university.' });
    }

    const created = await db.transaction(async (tx) => {
      const [appRow] = await tx
        .insert(applications)
        .values({
          userId: req.dbUser!.id,
          universityId: prog.universityId,
          programmeId,
          status,
          applicationDeadline: prog.applicationDeadline,
          applicationFee: prog.applicationFee,
          currency: prog.currency,
          portalUrl: portalUrl || prog.officialProgrammeUrl,
          notes: notes ?? null,
        })
        .returning();

      await tx.insert(applicationStatusHistory).values({
        applicationId: appRow.id,
        fromStatus: null,
        toStatus: status,
        note: 'Application created',
        changedByUserId: req.dbUser!.id,
      });

      return appRow;
    });

    return res.status(201).json({ application: created });
  } catch (error) {
    console.error('Failed to create application:', error);
    return res.status(500).json({ error: 'Unable to create application.' });
  }
});

const optionalDateField = z
  .string()
  .max(30)
  .refine((v) => v === '' || isValidIsoDate(v), 'Invalid calendar date (use YYYY-MM-DD)')
  .nullable()
  .optional();

const updateAppSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  applicationDeadline: optionalDateField,
  applicationFee: z.coerce.number().int().min(0).nullable().optional(),
  submissionDate: optionalDateField,
  portalUrl: z.string().max(500).nullable().optional(),
  notes: z.string().max(3000).nullable().optional(),
  statusNote: z.string().max(300).optional(),
});

applicationsRouter.put('/applications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid application ID.' });

    const parsed = updateAppSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid update payload.' });

    const [existing] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, req.dbUser!.id)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'Application not found.' });

    const { statusNote, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) updateData[k] = v;
    }

    const [updated] = await db
      .update(applications)
      .set(updateData)
      .where(eq(applications.id, id))
      .returning();

    if (parsed.data.status && parsed.data.status !== existing.status) {
      await db.insert(applicationStatusHistory).values({
        applicationId: id,
        fromStatus: existing.status,
        toStatus: parsed.data.status,
        note: statusNote || `Status updated from ${existing.status} to ${parsed.data.status}`,
        changedByUserId: req.dbUser!.id,
      });
    }

    return res.json({ application: updated });
  } catch (error) {
    console.error('Failed to update application:', error);
    return res.status(500).json({ error: 'Unable to update application.' });
  }
});

applicationsRouter.delete('/applications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid application ID.' });

    const deleted = await db
      .delete(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, req.dbUser!.id)))
      .returning({ id: applications.id });

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    return res.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete application:', error);
    return res.status(500).json({ error: 'Unable to delete application.' });
  }
});

applicationsRouter.post('/applications/:id/documents', requireAuth, async (req: AuthRequest, res) => {
  try {
    const applicationId = Number(req.params.id);
    const documentId = Number(req.body?.documentId);
    if (!Number.isInteger(applicationId) || !Number.isInteger(documentId)) {
      return res.status(400).json({ error: 'Invalid application or document ID.' });
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, req.dbUser!.id)))
      .limit(1);
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, req.dbUser!.id)))
      .limit(1);

    if (!app || !doc) return res.status(404).json({ error: 'Application or document not found.' });

    await db
      .insert(applicationDocuments)
      .values({ applicationId, documentId })
      .onConflictDoNothing();

    return res.status(201).json({ attached: true });
  } catch (error) {
    console.error('Failed to attach document:', error);
    return res.status(500).json({ error: 'Unable to attach document.' });
  }
});

applicationsRouter.delete('/applications/:id/documents/:docId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const applicationId = Number(req.params.id);
    const documentId = Number(req.params.docId);
    if (!Number.isInteger(applicationId) || !Number.isInteger(documentId)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, req.dbUser!.id)))
      .limit(1);
    if (!app) return res.status(404).json({ error: 'Application not found.' });

    await db
      .delete(applicationDocuments)
      .where(
        and(
          eq(applicationDocuments.applicationId, applicationId),
          eq(applicationDocuments.documentId, documentId)
        )
      );

    return res.json({ detached: true });
  } catch (error) {
    console.error('Failed to detach document:', error);
    return res.status(500).json({ error: 'Unable to detach document.' });
  }
});
