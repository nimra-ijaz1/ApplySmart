import { Router } from 'express';
import { count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { contactInquiries, programmes, scholarships, universities } from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';

export const publicRouter = Router();

publicRouter.get('/public/stats', async (_req, res) => {
  try {
    await ensureDatabaseSeeded();
    const [[uniRes], [progRes], [schRes]] = await Promise.all([
      db.select({ value: count() }).from(universities),
      db.select({ value: count() }).from(programmes),
      db.select({ value: count() }).from(scholarships),
    ]);
    res.json({
      universitiesCount: Number(uniRes.value),
      programmesCount: Number(progRes.value),
      scholarshipsCount: Number(schRes.value),
    });
  } catch (error) {
    console.error('Failed to fetch public stats:', error);
    res.status(500).json({ error: 'Unable to load platform summary.' });
  }
});

const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(3000),
});

publicRouter.post('/contact', async (req, res) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid contact form submission.', details: parsed.error.flatten() });
    }
    const [created] = await db.insert(contactInquiries).values(parsed.data).returning();
    return res.status(201).json({ message: 'Thank you for contacting ApplySmart. Your inquiry has been saved.', inquiryId: created.id });
  } catch (error) {
    console.error('Failed to submit contact inquiry:', error);
    return res.status(500).json({ error: 'Failed to submit contact inquiry.' });
  }
});
