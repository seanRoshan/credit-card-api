import { onRequest } from 'firebase-functions/v2/https';
import app from './app';

/**
 * Credit Card Scraper Firebase Cloud Function
 *
 * This function provides endpoints for scraping credit card data from WalletHub.
 * It runs with higher memory allocation (2GB) to support Puppeteer browser operations.
 *
 * Endpoints:
 * - GET  /v1/health              - Health check
 * - GET  /v1/scrape/search       - Search WalletHub for cards
 * - POST /v1/scrape/card         - Scrape single card by URL
 * - GET  /v1/scrape/card/:slug   - Scrape card by slug
 * - POST /v1/scrape/bulk         - Bulk scrape from category page
 * - POST /v1/scrape/update/:id   - Re-scrape existing card
 */
export const scraper = onRequest(
  {
    memory: '2GiB', // Puppeteer requires more memory
    timeoutSeconds: 540, // 9 minutes for bulk operations
    maxInstances: 5, // Limit concurrent scrapers
    cors: true,
  },
  app
);
