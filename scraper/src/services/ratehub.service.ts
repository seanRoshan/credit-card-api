import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config/env';
import logger, { loggers } from '../config/logger';
import { RateHubScrapedData } from '../types';

const TIMEOUT = config.ratehub.timeout;
const REQUEST_DELAY = config.ratehub.requestDelay;

/**
 * RateHub category page URLs
 * Some categories use comparison pages (/credit-cards/*) with structured widgets
 * Others use blog pages (/blog/*) with article-style layouts
 * type: 'comparison' or 'blog' indicates which parser to use
 */
export const RATEHUB_CATEGORIES: Record<string, { name: string; url: string; type: 'comparison' | 'blog' }> = {
  rewards: {
    name: 'Rewards',
    url: 'https://www.ratehub.ca/credit-cards/rewards',
    type: 'comparison',
  },
  cashback: {
    name: 'Cash Back',
    url: 'https://www.ratehub.ca/blog/best-cash-back-credit-cards-in-canada/',
    type: 'blog',
  },
  travel: {
    name: 'Travel',
    url: 'https://www.ratehub.ca/blog/best-travel-credit-cards-in-canada/',
    type: 'blog',
  },
  noFee: {
    name: 'No Annual Fee',
    url: 'https://www.ratehub.ca/blog/best-no-fee-credit-cards-in-canada/',
    type: 'blog',
  },
  lowInterest: {
    name: 'Low Interest',
    url: 'https://www.ratehub.ca/blog/best-low-interest-credit-cards-in-canada/',
    type: 'blog',
  },
  business: {
    name: 'Business',
    url: 'https://www.ratehub.ca/credit-cards/business',
    type: 'comparison',
  },
  student: {
    name: 'Student',
    url: 'https://www.ratehub.ca/blog/best-student-credit-cards-canada/',
    type: 'blog',
  },
  secured: {
    name: 'Secured',
    url: 'https://www.ratehub.ca/credit-cards/secured',
    type: 'comparison',
  },
  aeroplan: {
    name: 'Aeroplan',
    url: 'https://www.ratehub.ca/credit-cards/aeroplan-miles',
    type: 'comparison',
  },
  balanceTransfer: {
    name: 'Balance Transfer',
    url: 'https://www.ratehub.ca/blog/best-balance-transfer-credit-cards-in-canada-2/',
    type: 'blog',
  },
};

// Puppeteer launch configuration
const getPuppeteerConfig = () => {
  const executablePath = config.puppeteer.executablePath;

  const launchConfig: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
    ],
  };

  if (executablePath) {
    launchConfig.executablePath = executablePath;
    logger.debug(`Using Chromium at: ${executablePath}`);
  }

  return launchConfig;
};

async function createBrowser(): Promise<Browser> {
  const config = getPuppeteerConfig();
  return puppeteer.launch(config);
}

async function configurePage(page: Page): Promise<void> {
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setDefaultNavigationTimeout(TIMEOUT);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > 15000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Generate a slug from card name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™©*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract provider from card name
 */
function extractProvider(name: string): string | null {
  const providers: Record<string, string[]> = {
    TD: ['TD', 'Toronto-Dominion'],
    CIBC: ['CIBC'],
    RBC: ['RBC', 'Royal Bank'],
    BMO: ['BMO', 'Bank of Montreal'],
    Scotiabank: ['Scotiabank', 'Scotia'],
    'American Express': ['Amex', 'American Express'],
    MBNA: ['MBNA'],
    Tangerine: ['Tangerine'],
    Rogers: ['Rogers'],
    'PC Financial': ['PC Financial', "President's Choice", 'PC®'],
    'National Bank': ['National Bank'],
    Desjardins: ['Desjardins'],
    HSBC: ['HSBC'],
    'Capital One': ['Capital One'],
    Neo: ['Neo Financial', 'Neo '],
    Brim: ['Brim'],
    'Home Trust': ['Home Trust'],
    KOHO: ['KOHO'],
    Wealthsimple: ['Wealthsimple'],
    'Canadian Tire': ['Triangle', 'Canadian Tire'],
    Simplii: ['Simplii'],
  };

  const nameLower = name.toLowerCase();
  for (const [provider, keywords] of Object.entries(providers)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Get all category URLs
 */
export function getAllCategoryUrls(): Record<string, { name: string; url: string; type: 'comparison' | 'blog' }> {
  return RATEHUB_CATEGORIES;
}

/**
 * Scrape all cards from a RateHub comparison page
 * These pages have structured card widgets with images and details
 */
export async function scrapeCategoryPage(
  categoryUrl: string,
  limit = 50
): Promise<{ cards: RateHubScrapedData[]; total: number }> {
  let browser: Browser | null = null;

  try {
    loggers.scraper(categoryUrl, 'RateHub category scrape started', { limit });
    browser = await createBrowser();
    const page = await browser.newPage();
    await configurePage(page);

    // Navigate to category page
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Scroll to load all content
    await autoScroll(page);

    // Wait for card images to load
    await delay(3000);

    // Extract all cards from the comparison page
    const extractedCards = await page.evaluate(() => {
      interface ExtractedCard {
        name: string;
        imageUrl: string | null;
        annualFee: number;
        annualFeeText: string;
        rewardsRate: string | null;
        welcomeBonus: string | null;
        rating: number | null;
        applyUrl: string | null;
      }

      const cards: ExtractedCard[] = [];
      const seenNames = new Set<string>();

      // RateHub comparison pages use card image elements with alt text containing the card name
      // Each card is in a large wrapper that contains image, name, and details sections
      const cardImages = document.querySelectorAll('img[alt*="Card"], img[alt*="Visa"], img[alt*="Mastercard"], img[alt*="American Express"]');

      cardImages.forEach((img) => {
        const imgElement = img as HTMLImageElement;
        const altText = imgElement.alt?.trim();

        // Skip logos and icons
        if (!altText ||
            altText.toLowerCase().includes('logo') ||
            altText.toLowerCase().includes('icon') ||
            altText.length < 10 ||
            altText.length > 100) {
          return;
        }

        // Skip duplicates
        const nameKey = altText.toLowerCase();
        if (seenNames.has(nameKey)) return;
        seenNames.add(nameKey);

        // Get image URL
        let imageUrl: string | null = imgElement.src || null;
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = null;
        }

        // Find the card container - climb up the DOM to find the full card widget
        // RateHub uses nested divs, so we go up several levels
        let container: Element | null = imgElement;
        for (let i = 0; i < 10; i++) {
          if (!container.parentElement) break;
          container = container.parentElement;
          // Stop when we find a container that has annual fee info
          const text = container.textContent || '';
          if (text.includes('Annual fee') || text.includes('Earn rewards') || text.includes('Welcome bonus')) {
            break;
          }
        }

        const containerText = container?.textContent || '';

        // Parse annual fee - look for "$X" followed by strikethrough or "first year waived"
        let annualFee = 0;
        let annualFeeText = '$0';

        // First, try to find annual fee explicitly mentioned
        const annualFeeMatch = containerText.match(/Annual fee[\s\S]*?\$([\d,]+)/i);
        if (annualFeeMatch) {
          annualFee = parseFloat(annualFeeMatch[1].replace(',', ''));
          annualFeeText = `$${annualFee}`;

          // Check if first year waived
          if (containerText.toLowerCase().includes('first year waived') ||
              containerText.toLowerCase().includes('$0 first year')) {
            annualFeeText += ' ($0 first year)';
          }
        } else {
          // Look for fee in "after $X annual fee" pattern
          const afterFeeMatch = containerText.match(/after \$([\d,]+)\s*annual fee/i);
          if (afterFeeMatch) {
            annualFee = parseFloat(afterFeeMatch[1].replace(',', ''));
            annualFeeText = `$${annualFee}`;
          }
        }

        // Parse rewards rate
        let rewardsRate: string | null = null;

        // Look for "Earn rewards" section
        const earnRewardsMatch = containerText.match(/Earn rewards[\s\S]*?(\d+(?:\.\d+)?(?:pt|pts|x|%)?)\s*[-–]\s*(\d+(?:\.\d+)?(?:pt|pts|x|%)?)/i);
        if (earnRewardsMatch) {
          rewardsRate = `${earnRewardsMatch[1]} - ${earnRewardsMatch[2]} per dollar`;
        } else {
          // Try simpler patterns
          const simpleRewardsMatch = containerText.match(/(\d+(?:\.\d+)?%?\s*(?:cash\s*back|cashback|points?|miles?))/i);
          if (simpleRewardsMatch) {
            rewardsRate = simpleRewardsMatch[1].trim();
          }
        }

        // Parse welcome bonus
        let welcomeBonus: string | null = null;
        const welcomeBonusMatch = containerText.match(/Welcome bonus[\s\S]*?Earn up to\s*([\d,]+\s*(?:points?|miles?)?(?:\s*\([^)]+\))?)/i);
        if (welcomeBonusMatch) {
          welcomeBonus = welcomeBonusMatch[1].trim();
        } else {
          // Try alternative patterns
          const altBonusMatch = containerText.match(/Earn up to\s*([\d,]+)\s*(?:points?|miles?)/i);
          if (altBonusMatch) {
            welcomeBonus = `${altBonusMatch[1]} points`;
          }
        }

        // Parse rating
        let rating: number | null = null;
        const ratingMatch = containerText.match(/(\d+(?:\.\d+)?)\s*(?:\/\s*5|Ratehub rated|stars?)/i);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
          if (rating > 5) rating = null; // Invalid rating
        }

        cards.push({
          name: altText,
          imageUrl,
          annualFee,
          annualFeeText,
          rewardsRate,
          welcomeBonus,
          rating,
          applyUrl: null,
        });
      });

      return cards;
    });

    loggers.scraper(categoryUrl, `Found ${extractedCards.length} cards on page`);

    // Transform to RateHubScrapedData format
    const cards: RateHubScrapedData[] = extractedCards.slice(0, limit).map((card) => {
      const slug = generateSlug(card.name);
      const provider = extractProvider(card.name);

      // Determine rewards type
      let rewardsType: 'cashback' | 'points' | 'miles' | null = null;
      if (card.rewardsRate) {
        const lower = card.rewardsRate.toLowerCase();
        if (lower.includes('cash') || lower.includes('%')) rewardsType = 'cashback';
        else if (lower.includes('mile')) rewardsType = 'miles';
        else if (lower.includes('point') || lower.includes('pt')) rewardsType = 'points';
      }

      return {
        name: card.name,
        slug,
        annualFee: card.annualFee,
        annualFeeText: card.annualFeeText,
        introApr: null,
        regularApr: 'See details',
        rewardsRate: card.rewardsRate,
        rewardsBonus: card.welcomeBonus,
        rewardsType,
        overallRating: card.rating,
        pros: [],
        cons: [],
        creditRequired: 'Not specified',
        imageUrl: card.imageUrl,
        sourceUrl: categoryUrl,
        provider,
        features: [],
      };
    });

    return { cards, total: extractedCards.length };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`RateHub category scrape failed: ${errorMsg}`), { categoryUrl });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Scrape a single card from its RateHub URL
 */
export async function scrapeCardFromUrl(url: string): Promise<RateHubScrapedData> {
  let browser: Browser | null = null;

  try {
    loggers.scraper(url, 'RateHub single card scrape started');
    browser = await createBrowser();
    const page = await browser.newPage();
    await configurePage(page);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });
    await delay(2000);

    const cardData = await page.evaluate((pageUrl) => {
      // Get the card name from the page title or h1
      let name = '';
      const h1 = document.querySelector('h1');
      if (h1) {
        name = h1.textContent?.trim() || '';
      }
      if (!name) {
        name = document.title.replace(/\s*[-|].*$/, '').trim();
      }

      // Generate slug
      const slug = name
        .toLowerCase()
        .replace(/[®™©*]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Get card image
      let imageUrl: string | null = null;
      const cardImages = Array.from(document.querySelectorAll('img'));
      for (let i = 0; i < cardImages.length; i++) {
        const imgEl = cardImages[i] as HTMLImageElement;
        if (
          imgEl.alt?.toLowerCase().includes('card') &&
          imgEl.src?.startsWith('http') &&
          !imgEl.src.includes('logo') &&
          !imgEl.src.includes('icon')
        ) {
          imageUrl = imgEl.src;
          break;
        }
      }

      const pageText = document.body.innerText;

      // Annual fee
      let annualFee = 0;
      let annualFeeText = '$0';
      const feeMatch = pageText.match(/annual\s*fee[:\s]*\$?([\d,]+)/i);
      if (feeMatch) {
        annualFee = parseFloat(feeMatch[1].replace(',', ''));
        annualFeeText = `$${annualFee}`;
      } else if (pageText.toLowerCase().includes('no annual fee')) {
        annualFee = 0;
        annualFeeText = '$0';
      }

      // Rewards
      let rewardsRate: string | null = null;
      const rewardsMatch = pageText.match(/(\d+(?:\.\d+)?%?\s*(?:cash\s*back|points?|miles?))/i);
      if (rewardsMatch) {
        rewardsRate = rewardsMatch[1].trim();
      }

      // Interest rate
      let regularApr = 'See details';
      const aprMatch = pageText.match(/(\d+\.?\d*%)\s*(?:interest|apr)/i);
      if (aprMatch) {
        regularApr = aprMatch[1];
      }

      // Determine provider
      function extractProviderFromName(cardName: string): string | null {
        const providers: Record<string, string[]> = {
          TD: ['TD', 'Toronto-Dominion'],
          CIBC: ['CIBC'],
          RBC: ['RBC', 'Royal Bank'],
          BMO: ['BMO', 'Bank of Montreal'],
          Scotiabank: ['Scotiabank', 'Scotia'],
          'American Express': ['Amex', 'American Express'],
          MBNA: ['MBNA'],
          Tangerine: ['Tangerine'],
          Rogers: ['Rogers'],
          'PC Financial': ['PC Financial', "President's Choice"],
          'National Bank': ['National Bank'],
          Desjardins: ['Desjardins'],
          HSBC: ['HSBC'],
          'Capital One': ['Capital One'],
          Neo: ['Neo Financial'],
          Brim: ['Brim'],
        };

        for (const [provider, keywords] of Object.entries(providers)) {
          for (const keyword of keywords) {
            if (cardName.toLowerCase().includes(keyword.toLowerCase())) {
              return provider;
            }
          }
        }
        return null;
      }

      const provider = extractProviderFromName(name);

      // Determine rewards type
      let rewardsType: string | null = null;
      if (rewardsRate) {
        const lower = rewardsRate.toLowerCase();
        if (lower.includes('cash')) rewardsType = 'cashback';
        else if (lower.includes('mile')) rewardsType = 'miles';
        else if (lower.includes('point')) rewardsType = 'points';
      }

      return {
        name,
        slug,
        annualFee,
        annualFeeText,
        introApr: null as string | null,
        regularApr,
        rewardsRate,
        rewardsBonus: null as string | null,
        rewardsType,
        overallRating: null as number | null,
        pros: [] as string[],
        cons: [] as string[],
        creditRequired: 'Not specified',
        imageUrl,
        provider,
        features: [] as string[],
        sourceUrl: pageUrl,
      };
    }, url);

    if (!cardData || !cardData.name) {
      throw new Error('Failed to extract card data from RateHub page');
    }

    loggers.scraper(cardData.name, 'RateHub single card scrape completed');

    return cardData as RateHubScrapedData;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`RateHub scrape failed: ${errorMsg}`), { url });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
