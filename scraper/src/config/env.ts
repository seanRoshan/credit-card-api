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

  // WalletHub scraping settings (USA)
  wallethub: {
    baseUrl: 'https://wallethub.com',
    searchUrl: 'https://wallethub.com/credit-cards/',
    requestDelay: 2000, // 2 seconds between requests
    maxRetries: 3,
    timeout: 30000, // 30 seconds
  },

  // RateHub scraping settings (Canada)
  ratehub: {
    baseUrl: 'https://www.ratehub.ca',
    creditCardsUrl: 'https://www.ratehub.ca/credit-cards',
    categories: {
      cashback: 'https://www.ratehub.ca/credit-cards/cash-back',
      travel: 'https://www.ratehub.ca/credit-cards/travel',
      rewards: 'https://www.ratehub.ca/credit-cards/rewards',
      lowInterest: 'https://www.ratehub.ca/credit-cards/low-interest',
      noFee: 'https://www.ratehub.ca/credit-cards/no-annual-fee',
      business: 'https://www.ratehub.ca/credit-cards/business',
      student: 'https://www.ratehub.ca/credit-cards/student',
      secured: 'https://www.ratehub.ca/credit-cards/secured',
      balanceTransfer: 'https://www.ratehub.ca/credit-cards/balance-transfer',
      airmiles: 'https://www.ratehub.ca/credit-cards/airmiles',
      aeroplan: 'https://www.ratehub.ca/credit-cards/aeroplan',
    },
    requestDelay: 2500, // 2.5 seconds between requests (be gentle)
    maxRetries: 3,
    timeout: 45000, // 45 seconds (Next.js apps can be slow)
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 10,
    maxConcurrent: 2,
  },
};

export type Config = typeof config;
