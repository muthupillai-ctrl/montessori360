import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

async function start(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  app.listen(PORT, () => logger.info(`AMS API running on port ${PORT}`));
}

start().catch(err => {
  logger.error('Failed to start AMS API', err);
  process.exit(1);
});
