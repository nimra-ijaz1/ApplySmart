import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  aiConversations,
  aiMessages,
  documents,
  programmeRequirements,
  programmes,
  scholarships,
  studentProfiles,
  universities,
} from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  analyzeDocumentWithAI,
  chatWithAssistantAI,
  compareProgrammesWithAI,
  isAiConfigured,
} from '../services/aiService.ts';

export const aiRouter = Router();

const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait a minute before trying again.' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

aiRouter.get('/ai/status', requireAuth, (_req, res) => {
  res.json({ aiConfigured: isAiConfigured() });
});

aiRouter.get('/ai/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const convs = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, req.dbUser!.id))
      .orderBy(desc(aiConversations.updatedAt));
    return res.json({ items: convs });
  } catch (error) {
    console.error('Failed to list AI conversations:', error);
    return res.status(500).json({ error: 'Unable to load conversations.' });
  }
});

aiRouter.post('/ai/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const title = typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 120)
      : 'Study Abroad Consultation';
    const includeProfileContext = req.body?.includeProfileContext !== false;

    const [created] = await db
      .insert(aiConversations)
      .values({
        userId: req.dbUser!.id,
        title,
        includeProfileContext,
      })
      .returning();

    return res.status(201).json({ conversation: created });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return res.status(500).json({ error: 'Unable to create conversation.' });
  }
});

aiRouter.get('/ai/conversations/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const convId = Number(req.params.id);
    if (!Number.isInteger(convId)) return res.status(400).json({ error: 'Invalid conversation ID.' });

    const [conv] = await db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.id, convId), eq(aiConversations.userId, req.dbUser!.id)))
      .limit(1);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, convId))
      .orderBy(asc(aiMessages.createdAt));

    return res.json({ conversation: conv, messages });
  } catch (error) {
    console.error('Failed to fetch AI messages:', error);
    return res.status(500).json({ error: 'Unable to load messages.' });
  }
});

const chatSchema = z.object({
  conversationId: z.number().int().optional(),
  message: z.string().min(1).max(4000),
  includeProfileContext: z.boolean().optional().default(true),
});

aiRouter.post('/ai/chat', requireAuth, aiRateLimiter, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid chat message.' });

    if (!isAiConfigured()) {
      return res.status(503).json({
        aiConfigured: false,
        error:
          'GEMINI_API_KEY is not configured in environment variables. Please configure it in Settings > Secrets to enable the AI Study Abroad Assistant.',
      });
    }

    const { message, includeProfileContext } = parsed.data;
    const userId = req.dbUser!.id;

    let convId = parsed.data.conversationId;
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (convId) {
      const [existing] = await db
        .select()
        .from(aiConversations)
        .where(and(eq(aiConversations.id, convId), eq(aiConversations.userId, userId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Conversation not found.' });

      const existingHistory = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, convId))
        .orderBy(asc(aiMessages.createdAt));

      history = existingHistory.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    }

    // Retrieve verified DB records to ground the assistant
    const [allUnis, allProgs, allReqs, allSch, [profile], userDocs] = await Promise.all([
      db.select().from(universities),
      db.select().from(programmes),
      db.select().from(programmeRequirements),
      db.select().from(scholarships),
      db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1),
      db.select({ category: documents.category, title: documents.title }).from(documents).where(eq(documents.userId, userId)),
    ]);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    const progContext = allProgs
      .map((p) => {
        const u = uniMap.get(p.universityId);
        const r = reqMap.get(p.id);
        return `- ${u?.name} (${u?.country}) | ${p.name} (${p.degreeLevel}) | Tuition: ${p.tuitionFee} ${p.currency} | Deadline: ${p.applicationDeadline} | Min CGPA: ${r?.minCgpa ?? 'N/A'}/${r?.cgpaScale ?? '4.0'} | IELTS: ${r?.ieltsOverall ?? 'N/A'} | Required Docs: ${(r?.requiredDocuments ?? []).join(', ')} | Status: ${p.verificationStatus} | Source: ${p.sourceUrl}`;
      })
      .join('\n');

    const schContext = allSch
      .map(
        (s) =>
          `- Scholarship: ${s.name} (${s.country}, ${s.fundingType}) | Coverage: ${s.tuitionCoverage} | Stipend: ${s.monthlyStipend ?? 'N/A'} | Deadline: ${s.applicationDeadline} | Eligibility: ${s.eligibilityRequirements} | Source: ${s.sourceUrl}`
      )
      .join('\n');

    const studentProfileSummary =
      includeProfileContext && profile
        ? `Nationality: ${profile.nationality}, Degree: ${profile.currentOrCompletedDegree} in ${profile.degreeField}, CGPA: ${profile.cgpa ?? 'Not provided'}/${profile.cgpaScale ?? '4.0'}, Percentage: ${profile.academicPercentage ?? 'N/A'}, IELTS Overall: ${profile.ieltsOverall ?? 'Not provided'} (L:${profile.ieltsListening ?? '-'} R:${profile.ieltsReading ?? '-'} W:${profile.ieltsWriting ?? '-'} S:${profile.ieltsSpeaking ?? '-'}), Desired Level: ${profile.desiredDegreeLevel ?? 'Unspecified'}, Preferred Countries: ${(profile.preferredCountries ?? []).join(', ') || 'Any'}, Uploaded Documents: ${userDocs.map((d) => d.category).join(', ') || 'None yet'}`
        : null;

    const aiRes = await chatWithAssistantAI({
      message,
      history,
      studentProfileSummary,
      verifiedDatabaseContext: `UNIVERSITIES & PROGRAMMES:\n${progContext}\n\nSCHOLARSHIPS:\n${schContext}`,
    });

    if (!aiRes.aiConfigured || !aiRes.reply) {
      return res.status(503).json({
        conversationId: convId,
        aiConfigured: aiRes.aiConfigured,
        error: aiRes.error || 'AI Assistant unavailable.',
      });
    }

    // Collect relevant source citations mentioned or matching query
    const lowerReply = aiRes.reply.toLowerCase();
    const sources: Array<{ title: string; url: string }> = [];
    for (const p of allProgs) {
      const u = uniMap.get(p.universityId);
      if (u && (lowerReply.includes(u.name.toLowerCase()) || lowerReply.includes(p.name.toLowerCase()))) {
        sources.push({ title: `${u.name} — ${p.name}`, url: p.sourceUrl });
      }
    }
    for (const s of allSch) {
      if (lowerReply.includes(s.name.toLowerCase().split(' ')[0])) {
        sources.push({ title: s.name, url: s.sourceUrl });
      }
    }

    const saved = await db.transaction(async (tx) => {
      let targetConvId = convId;
      if (!targetConvId) {
        const [created] = await tx
          .insert(aiConversations)
          .values({
            userId,
            title: message.slice(0, 60),
            includeProfileContext,
          })
          .returning();
        targetConvId = created.id;
      }

      await tx.insert(aiMessages).values({
        conversationId: targetConvId,
        role: 'user',
        content: message,
      });

      const [assistantMsg] = await tx
        .insert(aiMessages)
        .values({
          conversationId: targetConvId,
          role: 'assistant',
          content: aiRes.reply!,
          sources: sources.slice(0, 6),
        })
        .returning();

      await tx
        .update(aiConversations)
        .set({ updatedAt: new Date() })
        .where(eq(aiConversations.id, targetConvId));

      return { conversationId: targetConvId, assistantMsg };
    });

    return res.json({
      conversationId: saved.conversationId,
      aiConfigured: true,
      message: saved.assistantMsg,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({ error: 'Unable to process chat request.' });
  }
});

aiRouter.post('/ai/analyze-document', requireAuth, aiRateLimiter, (req: AuthRequest, res) => {
  upload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid file.' });
    }

    try {
      let fileName = 'Uploaded Admission Document';
      let extractedText = '';

      let parsedDocId: number | null = null;
      if (req.file) {
        fileName = req.file.originalname;
        if (req.file.mimetype === 'application/pdf') {
          const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
          const pdfText = await parser.getText();
          await parser.destroy();
          extractedText = (pdfText.text || '').trim();
        } else {
          extractedText = req.file.buffer.toString('utf8').trim();
        }
      } else if (typeof req.body?.documentId === 'number' || typeof req.body?.documentId === 'string') {
        const docId = Number(req.body.documentId);
        if (!Number.isInteger(docId) || docId <= 0) {
          return res.status(400).json({ error: 'Invalid document ID.' });
        }
        parsedDocId = docId;
        const [doc] = await db
          .select()
          .from(documents)
          .where(and(eq(documents.id, docId), eq(documents.userId, req.dbUser!.id)))
          .limit(1);
        if (!doc) return res.status(404).json({ error: 'Document not found.' });
        fileName = doc.fileName;
        extractedText = doc.extractedText || '';
      } else if (typeof req.body?.rawText === 'string') {
        extractedText = req.body.rawText.trim();
        fileName = 'Pasted Admission Text';
      }

      if (!extractedText) {
        return res.status(400).json({
          error: 'No readable text could be extracted from this document.',
        });
      }

      const result = await analyzeDocumentWithAI({ fileName, extractedText });

      if (parsedDocId !== null && result.analysis) {
        await db
          .update(documents)
          .set({ aiAnalysis: result.analysis, updatedAt: new Date() })
          .where(and(eq(documents.id, parsedDocId), eq(documents.userId, req.dbUser!.id)));
      }

      return res.json({
        fileName,
        extractedPreview: extractedText.slice(0, 600),
        aiConfigured: result.aiConfigured,
        analysis: result.analysis,
        error: result.error,
      });
    } catch (error) {
      console.error('AI document analysis error:', error);
      return res.status(500).json({ error: 'Failed to analyze admission document.' });
    }
  });
});

aiRouter.post('/ai/compare-programmes', requireAuth, aiRateLimiter, async (req: AuthRequest, res) => {
  try {
    await ensureDatabaseSeeded();
    const idsSchema = z.object({
      programmeIds: z.array(z.number().int()).min(2).max(4),
    });
    const parsed = idsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Select 2 to 4 programmes to compare.' });

    const progs = await db
      .select()
      .from(programmes)
      .where(inArray(programmes.id, parsed.data.programmeIds));
    const allUnis = await db.select().from(universities);
    const allReqs = await db.select().from(programmeRequirements);
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, req.dbUser!.id))
      .limit(1);

    const uniMap = new Map(allUnis.map((u) => [u.id, u]));
    const reqMap = new Map(allReqs.map((r) => [r.programmeId, r]));

    const summaryText = progs
      .map((p) => {
        const u = uniMap.get(p.universityId);
        const r = reqMap.get(p.id);
        return `${u?.name} (${u?.country}) — ${p.name} (${p.degreeLevel}): Duration ${p.duration}, Tuition ${p.tuitionFee} ${p.currency}, App Fee ${p.applicationFee} ${p.currency}, Min CGPA ${r?.minCgpa ?? 'N/A'}/${r?.cgpaScale ?? '4.0'}, IELTS ${r?.ieltsOverall ?? 'N/A'}, Deadline ${p.applicationDeadline}, Scholarship Available: ${p.scholarshipAvailability ? 'Yes' : 'No'}, URL: ${p.officialProgrammeUrl}`;
      })
      .join('\n');

    const profileSummary = profile
      ? `CGPA: ${profile.cgpa}/${profile.cgpaScale}, IELTS: ${profile.ieltsOverall}, Degree: ${profile.degreeField}, Budget: ${profile.maxTuitionBudgetUsd ?? 'Not set'} USD`
      : null;

    const aiRes = await compareProgrammesWithAI({
      programmesSummary: summaryText,
      studentProfileSummary: profileSummary,
    });

    return res.json(aiRes);
  } catch (error) {
    console.error('Failed to compare programmes:', error);
    return res.status(500).json({ error: 'Unable to run AI comparison.' });
  }
});
