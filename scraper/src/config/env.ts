export const config = {
  port: parseInt(process.env.PORT || '8002', 10),
  apiKey: process.env.SCRAPER_API_KEY || 'dev-scraper-key-change-in-production',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Firebase project
  projectId: process.env.FIREBASE_PROJECT_ID || 'credit-card-api-app',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'credit-card-api-images',

  // Backend API URL for internal communication
  backendUrl: process.env.BACKEND_URL || 'http://localhost:8001',

  // Puppeteer configuration for Firebase Functions
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
    ],
  },

  // WalletHub scraping settings
  wallethub: {
    baseUrl: 'https://wallethub.com',
    searchUrl: 'https://wallethub.com/credit-cards/',
    requestDelay: 2000, // 2 seconds between requests
    maxRetries: 3,
    timeout: 30000, // 30 seconds
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 10,
    maxConcurrent: 2,
  },
};

export type Config = typeof config;
