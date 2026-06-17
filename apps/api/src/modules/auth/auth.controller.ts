import { Request, Response } from 'express';
import { authService } from './auth.service.js';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, tenantCode } = req.body as { email: string; password: string; tenantCode: string };
  const tokens = await authService.login(email, password, tenantCode);
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.json({ accessToken: tokens.accessToken, user: tokens.user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  const tokens = await authService.refreshTokens(refreshToken);
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refreshToken as string | undefined;
  await authService.logout(req.user!.sub, refreshToken);
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email, tenantCode } = req.body as { email: string; tenantCode: string };
  await authService.forgotPassword(email, tenantCode);
  // Always return success to prevent email enumeration
  res.json({ message: 'If that email exists, a reset link has been sent.' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as { token: string; newPassword: string };
  await authService.resetPassword(token, newPassword);
  res.json({ message: 'Password reset successfully' });
}

export async function setParentPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as { token: string; newPassword: string };
  await authService.setPasswordFromInvite(token, newPassword);
  res.json({ message: 'Password set. You can now log in.' });
}
