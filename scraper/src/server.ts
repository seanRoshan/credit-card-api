/**
 * Local development server
 * Run with: npm run dev
 */
import app from './app';
import { config } from './config/env';
import logger from './config/logger';

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`Scraper server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Health check: http://localhost:${PORT}/v1/health`);
});
