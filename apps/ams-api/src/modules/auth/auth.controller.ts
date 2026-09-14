import { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler.js';

const SIS_URL = () => process.env['SIS_API_URL'] ?? 'http://localhost:3001/api/v1';

async function sisPost(path: string, body: unknown, cookies?: string): Promise<globalThis.Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookies) headers['Cookie'] = cookies;

  let res: globalThis.Response;
  try {
    res = await fetch(`${SIS_URL()}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError(503, 'Login service is temporarily unavailable. Please try again later.', 'SERVICE_UNAVAILABLE');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new AppError(
      res.status,
      err?.error?.message || 'Authentication failed',
      err?.error?.code   || 'AUTH_ERROR'
    );
  }
  return res;
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, tenantCode } = req.body;
  if (!email || !password || !tenantCode) {
    throw AppError.badRequest('email, password and tenantCode are required');
  }
  const upstream = await sisPost('/auth/login', { email, password, tenantCode });
  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) res.setHeader('Set-Cookie', setCookie);
  const data = await upstream.json();
  res.json(data);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const upstream = await sisPost('/auth/refresh', {}, req.headers.cookie);
  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) res.setHeader('Set-Cookie', setCookie);
  const data = await upstream.json();
  res.json(data);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await sisPost('/auth/logout', {}, req.headers.cookie).catch(() => {});
  res.clearCookie('refresh_token');
  res.json({ message: 'Logged out' });
}
