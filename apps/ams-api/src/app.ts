import express, { Application } from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { worksheetsRouter } from './modules/worksheets/worksheets.routes.js';
import { curriculumRouter } from './modules/curriculum/curriculum.routes.js';
import { lessonPlansRouter } from './modules/lesson-plans/lesson-plans.routes.js';
import { questionPapersRouter } from './modules/question-papers/question-papers.routes.js';
import { assignmentsRouter } from './modules/assignments/assignments.routes.js';
import { sisProxyRouter } from './modules/sis-proxy/sis-proxy.routes.js';
import { aiUsageRouter } from './modules/ai-usage/ai-usage.routes.js';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env['CORS_ORIGIN'] ?? '*', credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

  const uploadsDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'ams-api' }));

  const v1 = express.Router();
  v1.use('/auth',           authRouter);
  v1.use('/worksheets',     worksheetsRouter);
  v1.use('/curriculum',     curriculumRouter);
  v1.use('/lesson-plans',   lessonPlansRouter);
  v1.use('/question-papers', questionPapersRouter);
  v1.use('/assignments',    assignmentsRouter);
  v1.use('/sis',            sisProxyRouter);
  v1.use('/ai-usage',       aiUsageRouter);

  app.use('/api/v1', v1);
  app.use(errorHandler);

  return app;
}
