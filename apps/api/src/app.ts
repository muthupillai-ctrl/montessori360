import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { studentsRouter } from './modules/students/students.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { feesRouter } from './modules/fees/fees.routes.js';
import { communicationRouter } from './modules/communication/communication.routes.js';
import { journalRouter } from './modules/journal/journal.routes.js';
import { observationsRouter } from './modules/observations/observations.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { calendarRouter } from './modules/calendar/calendar.routes.js';
import { staffRouter } from './modules/staff/staff.routes.js';
import { transportRouter } from './modules/transport/transport.routes.js';
import { timetableRouter } from './modules/timetable/timetable.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { promotionRouter } from './modules/promotion/promotion.routes.js';
import { platformAdminRouter } from './modules/platform-admin/platform-admin.routes.js';

export function createApp(): Application {
  const app = express();

  // Trust one proxy hop (Nginx / AWS ALB in front of this server)
  app.set('trust proxy', 1);

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:4200'],
    credentials: true,
  }));

  // ── Global rate limit ─────────────────────────────────────────────────────
  app.use(rateLimit({
    windowMs: 60 * 1000,       // 1 minute
    max: 200,                   // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }));

  // ── Parsers & middleware ──────────────────────────────────────────────────
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));

  // ── Health check (no auth required) ──────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'montessori360-api', timestamp: new Date().toISOString() });
  });

  // ── API v1 routes ─────────────────────────────────────────────────────────
  const v1 = express.Router();

  // Platform admin routes (no tenant context — manages all schools)
  v1.use('/platform', platformAdminRouter);

  // Public routes (no tenant context required)
  v1.use('/auth', authRouter);

  // Tenant-scoped routes — tenant resolved from JWT
  v1.use(tenantMiddleware);
  v1.use('/students', studentsRouter);
  v1.use('/attendance', attendanceRouter);
  v1.use('/fees', feesRouter);
  v1.use('/communication', communicationRouter);
  v1.use('/journals', journalRouter);
  v1.use('/observations', observationsRouter);
  v1.use('/reports', reportsRouter);
  v1.use('/calendar', calendarRouter);
  v1.use('/staff', staffRouter);
  v1.use('/transport',  transportRouter);
  v1.use('/timetable',  timetableRouter);
  v1.use('/analytics', analyticsRouter);
  v1.use('/promotion', promotionRouter);

  app.use('/api/v1', v1);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
