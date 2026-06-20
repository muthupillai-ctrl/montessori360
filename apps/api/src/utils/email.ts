import nodemailer from 'nodemailer';
import { logger } from './logger.js';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn(`[email] SMTP not configured — reset link for ${to}: ${resetLink}`);
    return;
  }
console.log('SMTP User:', process.env.SMTP_USER);
console.log('SMTP Pass:', process.env.SMTP_PASS);
console.log('SMTP Pass Length:', process.env.SMTP_PASS?.length);
  logger.info(`[email] Connecting to SMTP ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} user=${process.env.SMTP_USER}`);

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const transport = createTransport();

  try {
    await transport.verify();
    logger.info('[email] SMTP connection verified');
  } catch (err: any) {
    logger.error(`[email] SMTP connection failed: ${err.message}`);
    throw err;
  }

  await transport.sendMail({
    from: `"Montessori360" <${from}>`,
    to,
    subject: 'Reset your Montessori360 password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;color:#1e293b">Reset your password</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          We received a request to reset your Montessori360 password.
          Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
          Reset Password
        </a>
        <p style="color:#94a3b8;margin:24px 0 0;font-size:13px;line-height:1.6">
          If you didn't request this, you can safely ignore this email.<br>
          Or copy this link: <a href="${resetLink}" style="color:#2563EB">${resetLink}</a>
        </p>
      </div>
    `,
    text: `Reset your Montessori360 password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });

  logger.info(`[email] Password reset sent to ${to} — link: ${resetLink}`);
}

export async function sendParentInviteEmail(to: string, inviteLink: string, parentName: string, schoolName: string): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn(`[email] SMTP not configured — invite link for ${to}: ${inviteLink}`);
    return;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const transport = createTransport();

  await transport.sendMail({
    from: `"Montessori360" <${from}>`,
    to,
    subject: `You've been invited to ${schoolName}'s parent portal`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;color:#1e293b">Welcome, ${parentName}!</h2>
        <p style="color:#475569;margin:0 0 24px;line-height:1.6">
          ${schoolName} has invited you to their parent portal on Montessori360.
          Click the button below to set your password and get started.
          This link expires in <strong>72 hours</strong>.
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:14px 18px;margin:0 0 24px">
          <p style="margin:0 0 4px;font-size:13px;color:#64748b">Your login details</p>
          <p style="margin:0;font-size:14px;color:#1e293b">
            <strong>Username&nbsp;/&nbsp;Email:</strong>&nbsp;${to}
          </p>
        </div>
        <a href="${inviteLink}"
           style="display:inline-block;background:#059669;color:#fff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
          Set Up My Account
        </a>
        <p style="color:#94a3b8;margin:24px 0 0;font-size:13px;line-height:1.6">
          Or copy this link: <a href="${inviteLink}" style="color:#059669">${inviteLink}</a>
        </p>
      </div>
    `,
    text: `${schoolName} has invited you to their parent portal.\n\nYour username / email: ${to}\n\nSet up your account:\n${inviteLink}\n\nThis link expires in 72 hours.`,
  });

  logger.info(`[email] Parent invite sent to ${to}`);
}
