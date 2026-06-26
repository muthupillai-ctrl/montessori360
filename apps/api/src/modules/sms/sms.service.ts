import { logger } from '../../utils/logger.js';

interface SmsResult {
  sent:        boolean;
  message_id?: string;
  error?:      string;
}

class SmsService {
  private readonly ENABLED = false; // set to true when DLT registration is complete

  private get apiKey() { return process.env.BREVO_API_KEY; }
  private get sender()  { return process.env.BREVO_SMS_SENDER ?? 'SCHOOL'; }

  isEnabled():    boolean { return this.ENABLED; }
  isConfigured(): boolean { return this.ENABLED && !!this.apiKey; }

  async sendInvoiceNotification(params: {
    mobile:        string;
    studentName:   string;
    invoiceNo:     string;
    billingPeriod: string;
    amount:        string;
    dueDate:       string;
    schoolName:    string;
  }): Promise<SmsResult> {
    if (!this.ENABLED) return { sent: false, error: 'SMS disabled' };

    const apiKey = this.apiKey;
    if (!apiKey) {
      logger.warn('Brevo SMS not configured — set BREVO_API_KEY');
      return { sent: false, error: 'SMS not configured' };
    }

    const to = this.formatNumber(params.mobile);
    if (!to) return { sent: false, error: 'Invalid mobile number' };

    // Keep content under 160 chars; truncate student name if needed
    const name    = params.studentName.length > 20 ? params.studentName.slice(0, 18) + '..' : params.studentName;
    const school  = params.schoolName.length > 12  ? params.schoolName.slice(0, 12)         : params.schoolName;
    const content = `Fee invoice ${params.invoiceNo} for ${name} (${params.billingPeriod}) is ready. Amt: Rs.${params.amount}. Due: ${params.dueDate}. -${school}`;

    try {
      const response = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method:  'POST',
        headers: {
          'accept':       'application/json',
          'api-key':      apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender:    this.sender,
          recipient: to,
          content,
          type:      'transactional',
        }),
      });

      if (!response.ok) {
        const err: any = await response.json().catch(() => ({}));
        logger.warn('Brevo SMS delivery failed', { status: response.status, err });
        return { sent: false, error: err?.message ?? `HTTP ${response.status}` };
      }

      const data: any = await response.json();
      logger.info('SMS sent', { to, messageId: data.messageId });
      return { sent: true, message_id: data.messageId };
    } catch (err: any) {
      logger.warn('Brevo SMS error', { err: err.message });
      return { sent: false, error: err.message };
    }
  }

  private formatNumber(mobile: string): string | null {
    const digits = mobile.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length > 10) return '+' + digits;
    if (digits.length === 10 && /^[6-9]/.test(digits)) return '+91' + digits;
    return digits.length >= 7 ? '+' + digits : null;
  }
}

export const smsService = new SmsService();
