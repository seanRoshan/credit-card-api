import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import app from './app';

// Define secrets
const scraperUrl = defineSecret('SCRAPER_URL');
const scraperApiKey = defineSecret('SCRAPER_API_KEY');

// Export Express app as Firebase Cloud Function with secrets
export const api = onRequest(
  {
    secrets: [scraperUrl, scraperApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
    minInstances: 0,
    maxInstances: 10,
  },
  app
);
