import express from 'express';
import { publicRouter } from './routes/public.ts';
import { profileRouter } from './routes/profile.ts';
import { universitiesRouter } from './routes/universities.ts';
import { studentFeaturesRouter } from './routes/studentFeatures.ts';
import { applicationsRouter } from './routes/applications.ts';
import { documentsRouter } from './routes/documents.ts';
import { remindersRouter } from './routes/reminders.ts';
import { aiRouter } from './routes/ai.ts';
import { adminRouter } from './routes/admin.ts';

export function createApiApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'applysmart-api' });
  });

  // Mount API routes
  app.use('/api', publicRouter);
  app.use('/api', profileRouter);
  app.use('/api', universitiesRouter);
  app.use('/api', studentFeaturesRouter);
  app.use('/api', applicationsRouter);
  app.use('/api', documentsRouter);
  app.use('/api', remindersRouter);
  app.use('/api', aiRouter);
  app.use('/api', adminRouter);

  return app;
}
