import cron from 'node-cron';
import { insightsService } from './insights.service.js';
import { logger } from '../../utils/logger.js';

export function startInsightsJob(): void {
  // Run every night at 2:00 AM server time
  cron.schedule('0 2 * * *', async () => {
    logger.info('[AI Insights] Cron triggered');
    try {
      await insightsService.runAllTenants();
    } catch (err) {
      logger.error('[AI Insights] Cron job failed', err);
    }
  });

  logger.info('[AI Insights] Nightly job scheduled (02:00 daily)');
}
