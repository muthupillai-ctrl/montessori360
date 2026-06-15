import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { createApp } from './app.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './config/database.js';
import { connectRedis } from './config/redis.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function bootstrap() {
  try {
    await connectDatabase();
    await connectRedis();

    const app = createApp();

    app.listen(PORT, () => {
      logger.info(`🚀 Montessori360 API running on port ${PORT}`);
      logger.info(`📖 Environment: ${process.env.NODE_ENV ?? 'development'}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

bootstrap();
