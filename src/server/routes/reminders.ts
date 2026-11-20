import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { programmes, reminders, scholarships, universities } from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { isValidIsoDate } from '../utils/validation.ts';

export const remindersRouter = Router();

remindersRouter.get('/reminders', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const userReminders = await db
      .select()
      .from(reminders)
      .where(eq(reminders.userId, req.dbUser!.id))
      .orderBy(asc(reminders.dueDate));

    // Also include platform deadlines from programmes & scholarships so the calendar is immediately useful
    const [allUnis, allProgs, allSch] = await Promise.all([
      db.select().from(universities),
      db.select().from(programmes),
      db.select().from(scholarships),
    ]);
    const uniMap = new Map(allUnis.map((u) => [u.id, u]));

    const systemEvents: Array<{
      id: string;
      title: string;
      category: string;
      dueDate: string;
      sourceUrl: string;
      isSystemEvent: boolean;
    }> = [];

    for (const p of allProgs) {
      const uniName = uniMap.get(p.universityId)?.name ?? 'University';
      if (p.applicationOpeningDate) {
        systemEvents.push({
          id: `prog-open-${p.id}`,
          title: `Applications Open: ${uniName} — ${p.name}`,
          category: 'application_opening',
          dueDate: p.applicationOpeningDate,
          sourceUrl: p.officialProgrammeUrl,
          isSystemEvent: true,
        });
      }
      if (p.applicationDeadline) {
        systemEvents.push({
          id: `prog-due-${p.id}`,
          title: `Deadline: ${uniName} — ${p.name}`,
          category: 'application_deadline',
          dueDate: p.applicationDeadline,
          sourceUrl: p.officialProgrammeUrl,
          isSystemEvent: true,
        });
      }
    }

    for (const s of allSch) {
      if (s.applicationDeadline) {
        systemEvents.push({
          id: `sch-due-${s.id}`,
          title: `Scholarship Deadline: ${s.name}`,
          category: 'scholarship_deadline',
          dueDate: s.applicationDeadline,
          sourceUrl: s.officialUrl,
          isSystemEvent: true,
        });
      }
    }

    return res.json({
      reminders: userReminders,
      systemDeadlines: systemEvents.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    });
  } catch (error) {
    console.error('Failed to fetch reminders:', error);
    return res.status(500).json({ error: 'Unable to load calendar events.' });
  }
});

const reminderSchema = z.object({
  title: z.string().min(2).max(200),
  category: z
    .enum([
      'application_opening',
      'application_deadline',
      'scholarship_deadline',
      'ielts_test',
      'document_submission',
      'personal',
    ])
    .default('personal'),
  dueDate: z.string().refine(isValidIsoDate, 'Invalid calendar date (use YYYY-MM-DD)'),
  notes: z.string().max(1000).nullable().optional(),
  emailNotification: z.boolean().optional().default(false),
});

remindersRouter.post('/reminders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = reminderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid reminder input.', details: parsed.error.flatten() });
    }

    const [created] = await db
      .insert(reminders)
      .values({
        userId: req.dbUser!.id,
        title: parsed.data.title,
        category: parsed.data.category,
        dueDate: parsed.data.dueDate,
        notes: parsed.data.notes ?? null,
        emailNotification: parsed.data.emailNotification,
      })
      .returning();

    return res.status(201).json({ reminder: created });
  } catch (error) {
    console.error('Failed to create reminder:', error);
    return res.status(500).json({ error: 'Unable to create reminder.' });
  }
});

remindersRouter.put('/reminders/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid reminder ID.' });

    const updateSchema = reminderSchema.partial().extend({
      isCompleted: z.boolean().optional(),
    });
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid update payload.' });

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) updateFields[k] = v;
    }

    const [updated] = await db
      .update(reminders)
      .set(updateFields)
      .where(and(eq(reminders.id, id), eq(reminders.userId, req.dbUser!.id)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Reminder not found.' });
    return res.json({ reminder: updated });
  } catch (error) {
    console.error('Failed to update reminder:', error);
    return res.status(500).json({ error: 'Unable to update reminder.' });
  }
});

remindersRouter.delete('/reminders/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid reminder ID.' });

    const deleted = await db
      .delete(reminders)
      .where(and(eq(reminders.id, id), eq(reminders.userId, req.dbUser!.id)))
      .returning({ id: reminders.id });

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }

    return res.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete reminder:', error);
    return res.status(500).json({ error: 'Unable to delete reminder.' });
  }
});
