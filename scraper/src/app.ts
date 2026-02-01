import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import scraperRoutes from './routes/scraper.route';
import logger, { loggers } from './config/logger';
import { createResponse } from './types';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: true, // Allow all origins (adjust in production)
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    loggers.http(req.method, req.path, res.statusCode, duration);
  });

  next();
});

// Health check endpoint (no auth required)
app.get('/v1/health', (_req: Request, res: Response) => {
  res.json(
    createResponse(true, {
      status: 'healthy',
      service: 'credit-card-scraper',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    })
  );
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json(
    createResponse(true, {
      service: 'Credit Card Scraper',
      version: '1.0.0',
      endpoints: {
        health: 'GET /v1/health',
        search: 'GET /v1/scrape/search?q=<query>',
        scrapeCard: 'POST /v1/scrape/card',
        scrapeBySlug: 'GET /v1/scrape/card/:slug',
        bulkScrape: 'POST /v1/scrape/bulk',
        updateCard: 'POST /v1/scrape/update/:cardId',
      },
    })
  );
});

// API routes
app.use('/v1/scrape', scraperRoutes);

// Also mount at /scraper/v1 for Firebase hosting rewrites
app.use('/scraper/v1/scrape', scraperRoutes);

// Duplicate health check for /scraper path
app.get('/scraper/v1/health', (_req: Request, res: Response) => {
  res.json(
    createResponse(true, {
      status: 'healthy',
      service: 'credit-card-scraper',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    })
  );
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json(
    createResponse(false, undefined, 'Endpoint not found', 'NOT_FOUND')
  );
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  loggers.error(err);

  // Don't expose internal errors in production
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(500).json(createResponse(false, undefined, message, 'INTERNAL'));
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
