import winston from 'winston';
import { config } from './env';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.nodeEnv === 'production' ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new winston.transports.Console(),
  ],
  defaultMeta: { service: 'credit-card-scraper' },
});

// Helper loggers for specific domains
export const loggers = {
  scraper: (cardName: string, action: string, meta?: object) => {
    logger.info(`[Scraper] ${action}: ${cardName}`, meta);
  },

  auth: (message: string, meta?: object) => {
    logger.info(`[Auth] ${message}`, meta);
  },

  validation: (message: string, meta?: object) => {
    logger.warn(`[Validation] ${message}`, meta);
  },

  error: (error: Error | string, meta?: object) => {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error(`[Error] ${errorMessage}`, { ...meta, stack: errorStack });
  },

  http: (method: string, path: string, statusCode: number, duration: number) => {
    logger.info(`[HTTP] ${method} ${path} ${statusCode} - ${duration}ms`);
  },
};

export default logger;
