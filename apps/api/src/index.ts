import path from 'path';
import * as dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });


import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { startInsightsJob } from './modules/ai/insights.job.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

logger.info(`Loading .env from: ${envPath}, PORT=${PORT}`);

async function bootstrap() {
  try {
    await connectDatabase();
    await connectRedis();

    const app = createApp();

    app.listen(PORT, () => {
      logger.info(`🚀 Taji One API running on port ${PORT}`);
      logger.info(`📖 Environment: ${process.env.NODE_ENV ?? 'development'}`);
      startInsightsJob();
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

bootstrap();
