import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './app';

// Define secrets
const scraperApiKey = defineSecret('SCRAPER_API_KEY');

/**
 * Credit Card Scraper Firebase Cloud Function
 *
 * This function provides endpoints for scraping credit card data from WalletHub and RateHub.
 * It runs with higher memory allocation (2GB) to support Puppeteer browser operations.
 *
 * Endpoints:
 * - GET  /v1/health              - Health check
 * - GET  /v1/scrape/search       - Search WalletHub for cards
 * - POST /v1/scrape/card         - Scrape single card by URL
 * - GET  /v1/scrape/card/:slug   - Scrape card by slug
 * - POST /v1/scrape/bulk         - Bulk scrape from category page
 * - POST /v1/scrape/update/:id   - Re-scrape existing card
 * - GET  /v1/scrape/ratehub/categories - Get RateHub categories
 * - POST /v1/scrape/ratehub/card - Scrape single RateHub card
 * - POST /v1/scrape/ratehub/bulk - Bulk scrape from RateHub category
 */
export const scraper = onRequest(
  {
    secrets: [scraperApiKey],
    memory: '2GiB', // Puppeteer requires more memory
    timeoutSeconds: 540, // 9 minutes for bulk operations
    maxInstances: 5, // Limit concurrent scrapers
    cors: true,
  },
  app
);
