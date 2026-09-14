import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

export const sisProxyRouter = Router();

sisProxyRouter.use(authenticate);

async function sisGet(path: string, jwt: string): Promise<unknown> {
  const base = process.env['SIS_API_URL'] ?? 'http://localhost:3001/api/v1';
  const apiKey = process.env['SIS_API_KEY'] ?? '';
  try {
    const res = await fetch(`${base}${path}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Key': apiKey,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AppError(res.status, `SIS responded ${res.status}: ${text}`);
    }
    return res.json();
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    logger.warn('SIS proxy fetch error', err);
    throw new AppError(503, 'Cannot reach SIS API');
  }
}

sisProxyRouter.get('/students', async (req: Request, res: Response) => {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const data = await sisGet('/students?limit=500', token);
  const list: unknown[] = Array.isArray(data) ? data
    : (data as any)?.students ?? (data as any)?.data ?? [];
  res.json(list.map((s: any) => ({
    id:         s.id,
    first_name: s.first_name,
    last_name:  s.last_name,
    class_name: s.class_name ?? s.className ?? s.current_class?.name ?? undefined,
  })));
});

sisProxyRouter.get('/classes', async (req: Request, res: Response) => {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const data = await sisGet('/students/classes', token);
  res.json(data);
});

sisProxyRouter.get('/subjects', async (req: Request, res: Response) => {
  const token = (req.headers.authorization ?? '').replace('Bearer ', '');
  const data = await sisGet('/timetable/subjects', token);
  res.json(data);
});
