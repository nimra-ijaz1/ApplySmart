import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { db } from '../../db/index.ts';
import { documents } from '../../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { isValidIsoDate } from '../utils/validation.ts';

export const documentsRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: PDF, TXT, MD, DOCX, PNG, JPG.'));
    }
  },
});

async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const res = await parser.getText();
      await parser.destroy();
      return (res.text || '').trim();
    }
    if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return buffer.toString('utf8').trim();
    }
    return '';
  } catch (err) {
    console.warn('Text extraction warning:', err);
    return '';
  }
}

documentsRouter.get('/documents', requireAuth, async (req: AuthRequest, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const rows = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        category: documents.category,
        title: documents.title,
        fileName: documents.fileName,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        description: documents.description,
        expirationDate: documents.expirationDate,
        aiAnalysis: documents.aiAnalysis,
        uploadedAt: documents.uploadedAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.userId, req.dbUser!.id))
      .orderBy(desc(documents.uploadedAt));

    const filtered = category ? rows.filter((r) => r.category === category) : rows;
    return res.json({ items: filtered });
  } catch (error) {
    console.error('Failed to list documents:', error);
    return res.status(500).json({ error: 'Unable to list documents.' });
  }
});

documentsRouter.post('/documents/upload', requireAuth, (req: AuthRequest, res) => {
  upload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'File upload validation failed.';
      return res.status(400).json({ error: message });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file attached.' });
    }
    if (file.size === 0) {
      return res.status(400).json({ error: 'Uploaded file cannot be empty.' });
    }

    try {
      const category = typeof req.body?.category === 'string' && req.body.category.trim()
        ? req.body.category.trim()
        : 'Other documents';
      const title = typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : file.originalname;
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : null;
      const expirationDate = typeof req.body?.expirationDate === 'string' && req.body.expirationDate.trim()
        ? req.body.expirationDate.trim()
        : null;

      if (expirationDate && !isValidIsoDate(expirationDate)) {
        return res.status(400).json({ error: 'Invalid expiration date. Use YYYY-MM-DD.' });
      }

      const extractedText = await extractTextFromBuffer(file.buffer, file.mimetype);
      const base64 = file.buffer.toString('base64');

      const [created] = await db
        .insert(documents)
        .values({
          userId: req.dbUser!.id,
          category,
          title,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          fileDataBase64: base64,
          extractedText,
          description,
          expirationDate,
        })
        .returning({
          id: documents.id,
          userId: documents.userId,
          category: documents.category,
          title: documents.title,
          fileName: documents.fileName,
          mimeType: documents.mimeType,
          fileSize: documents.fileSize,
          description: documents.description,
          expirationDate: documents.expirationDate,
          aiAnalysis: documents.aiAnalysis,
          uploadedAt: documents.uploadedAt,
          updatedAt: documents.updatedAt,
        });

      return res.status(201).json({ document: created, hasExtractedText: extractedText.length > 0 });
    } catch (dbErr) {
      console.error('Failed to store document:', dbErr);
      return res.status(500).json({ error: 'Unable to save uploaded document.' });
    }
  });
});

documentsRouter.get('/documents/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid document ID.' });

    // Strict owner authorization check
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, req.dbUser!.id)))
      .limit(1);

    if (!doc || !doc.fileDataBase64) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    const buffer = Buffer.from(doc.fileDataBase64, 'base64');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Failed to download document:', error);
    return res.status(500).json({ error: 'Unable to download document.' });
  }
});

documentsRouter.delete('/documents/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid document ID.' });

    const deleted = await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, req.dbUser!.id)))
      .returning({ id: documents.id });

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    return res.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return res.status(500).json({ error: 'Unable to delete document.' });
  }
});
