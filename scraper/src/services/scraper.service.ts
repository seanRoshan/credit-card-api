import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from '../config/env';
import logger, { loggers } from '../config/logger';
import { ScrapedCardData, WalletHubSearchResult } from '../types';

const WALLETHUB_BASE = config.wallethub.baseUrl;
const TIMEOUT = config.wallethub.timeout;
const REQUEST_DELAY = config.wallethub.requestDelay;

// Puppeteer launch configuration
const getPuppeteerConfig = () => {
  // PUPPETEER_EXECUTABLE_PATH is set in Docker/Cloud Run environments
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

  // Use system Chromium in Docker/Cloud Run
  if (executablePath) {
    launchConfig.executablePath = executablePath;
    logger.debug(`Using Chromium at: ${executablePath}`);
  }

  return launchConfig;
};

// WalletHub selectors (based on actual page analysis)
const SELECTORS = {
  // Search results page - Offers section
  searchOfferItem: '.search-container .offers-list li, .search-container .offer-item, .offers li',
  searchOfferLink: 'a[href*="/credit-cards/"]',
  searchOfferTitle: 'a[href*="/credit-cards/"] strong, a[href*="/credit-cards/"]',
  searchOfferImage: 'img',

  // Card detail page container
  cardContainer: 'div.card-object[data-sel-id="cc-container"], .card-details, .product-details',

  // Card details
  cardTitle: '[data-sel-id="card-title"] a span, [data-sel-id="card-title"] span, .card-name, h1',
  cardImage: '[data-sel-id="card-image"], .card-image img, .product-image img',
  cardLink: '[data-sel-id="card-title"] a, .card-name a',

  // Financial info
  annualFee: '[data-sel-id="annual-fee"], .annual-fee',
  regularApr: '[data-sel-id="regular-apr"], .regular-apr',
  purchaseIntroApr: '[data-sel-id="purchase-intro-apr"]',
  transferIntroApr: '[data-sel-id="transfer-intro-apr"]',

  // Rewards
  rewardsRate: '[data-sel-id="rewards-rate"], .rewards-rate',
  rewardsBonus: '[data-sel-id="rewards-bonus"], .rewards-bonus',

  // Credit & ratings
  acceptedCredit: '[data-sel-id="accepted-credit"], .credit-required',
  whRating: '.details-wh-rating-num, .wh-rating',
  ratingItems: '.wh-comp-item .ng-binding',

  // Pros and cons
  prosList: '[data-sel-id="pros-list"] [data-sel-id="pros-item"], .pros li',
  consList: '[data-sel-id="cons-list"] [data-sel-id="cons-item"], .cons li',

  // Search results
  searchInput: 'input[type="search"], input[placeholder*="search"], input[name="search"]',
  searchResults: '.search-results .card-item, .card-list .card-object, .offers-list',
};

/**
 * Helper to delay between requests
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely check if an element exists on the page
 */
async function exists(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    return element !== null;
  } catch {
    return false;
  }
}

/**
 * Create and configure a new browser instance
 */
async function createBrowser(): Promise<Browser> {
  logger.debug('Launching Puppeteer browser');
  return puppeteer.launch(getPuppeteerConfig());
}

/**
 * Configure page settings for scraping
 */
async function configurePage(page: Page): Promise<void> {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  // Block unnecessary resources to speed up scraping
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    if (['font', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
 * Normalize text for comparison (remove trademark symbols, lowercase, trim)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between query and result name
 * Returns a score from 0 to 1, where 1 is a perfect match
 */
function calculateMatchScore(query: string, resultName: string): number {
  const normalizedQuery = normalizeText(query);
  const normalizedName = normalizeText(resultName);

  // Exact match
  if (normalizedQuery === normalizedName) {
    return 1.0;
  }

  // Check if one contains the other
  if (normalizedName.includes(normalizedQuery)) {
    return 0.9;
  }
  if (normalizedQuery.includes(normalizedName)) {
    return 0.85;
  }

  // Word-based matching
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 2);
  const nameWords = normalizedName.split(/\s+/).filter((w) => w.length > 2);

  if (queryWords.length === 0 || nameWords.length === 0) {
    return 0;
  }

  // Count matching words
  let matchingWords = 0;
  for (const qWord of queryWords) {
    for (const nWord of nameWords) {
      if (nWord.includes(qWord) || qWord.includes(nWord)) {
        matchingWords++;
        break;
      }
    }
  }

  // Calculate score based on word overlap
  const wordScore = matchingWords / Math.max(queryWords.length, nameWords.length);

  // Bonus for matching important keywords (issuer names, card types)
  const importantKeywords = [
    'chase', 'amex', 'american express', 'citi', 'capital one', 'discover',
    'wells fargo', 'bank of america', 'freedom', 'sapphire', 'venture',
    'platinum', 'gold', 'preferred', 'unlimited', 'flex', 'rewards'
  ];

  let keywordBonus = 0;
  for (const keyword of importantKeywords) {
    if (normalizedQuery.includes(keyword) && normalizedName.includes(keyword)) {
      keywordBonus += 0.1;
    }
  }

  return Math.min(0.8, wordScore * 0.7 + keywordBonus);
}

/**
 * Find the best matching result from search results
 */
export function findBestMatch(
  query: string,
  results: WalletHubSearchResult[]
): WalletHubSearchResult | null {
  if (results.length === 0) {
    return null;
  }

  // Score all results
  const scoredResults = results.map((result) => ({
    result,
    score: calculateMatchScore(query, result.name),
  }));

  // Sort by score descending
  scoredResults.sort((a, b) => b.score - a.score);

  // Log match scores for debugging
  logger.debug('Match scores:', {
    query,
    results: scoredResults.map((r) => ({
      name: r.result.name,
      score: r.score.toFixed(2),
    })),
  });

  // Return best match if score is above threshold
  const bestMatch = scoredResults[0];
  if (bestMatch.score >= 0.5) {
    return bestMatch.result;
  }

  // If no good match, return the first result but log a warning
  logger.warn('No confident match found, returning first result', {
    query,
    bestScore: bestMatch.score,
    selectedName: results[0].name,
  });

  return results[0];
}

/**
 * Search WalletHub for credit cards matching a query
 * Uses the correct search URL format: /search/?s=<query>
 */
export async function searchWalletHub(
  query: string,
  limit = 10
): Promise<WalletHubSearchResult[]> {
  let browser: Browser | null = null;

  try {
    loggers.scraper(query, 'search started');

    logger.debug('About to create browser...');
    browser = await createBrowser();
    logger.debug('Browser created successfully');

    const page = await browser.newPage();
    logger.debug('New page created');

    await configurePage(page);
    logger.debug('Page configured');

    // Use the correct WalletHub search URL format
    const searchUrl = `${WALLETHUB_BASE}/search/?s=${encodeURIComponent(query)}`;
    logger.debug(`Navigating to search URL: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Wait for search results to load (try multiple selectors)
    await Promise.race([
      page.waitForSelector(SELECTORS.cardContainer, { timeout: 15000 }),
      page.waitForSelector('.search-results', { timeout: 15000 }),
      page.waitForSelector('[data-sel-id="cc-container"]', { timeout: 15000 }),
    ]).catch(() => {
      logger.debug('No results selector found, page may have different structure');
    });

    // Give the page a moment to render dynamic content
    await delay(2000);

    // Extract search results - WalletHub card URLs use pattern /d/<slug>-<id>c
    const results = await page.evaluate(
      (baseUrl, maxResults) => {
        interface SearchResult {
          name: string;
          url: string;
          imageUrl: string | null;
          annualFeeText: string;
          rating: number | null;
        }
        const cards: SearchResult[] = [];
        const seen = new Set<string>();

        // Find all links that point to individual card pages (pattern: /d/<slug>-<id>c)
        const allLinks = document.querySelectorAll('a[href*="/d/"]');

        allLinks.forEach((link) => {
          if (cards.length >= maxResults) return;

          const anchor = link as HTMLAnchorElement;
          const href = anchor.href;

          // Only match card detail pages: /d/<card-slug>-<numeric-id>c
          if (!href.match(/\/d\/[\w-]+-\d+c$/i)) {
            return;
          }

          // Skip duplicates
          if (seen.has(href)) return;
          seen.add(href);

          // Get the card name from the link text
          let name = anchor.textContent?.trim() || '';

          // If name is empty or too short, try to get from parent
          if (!name || name.length < 3) {
            const parent = anchor.closest('li') || anchor.parentElement;
            if (parent) {
              const strong = parent.querySelector('strong');
              name = strong?.textContent?.trim() || parent.textContent?.trim().split('\n')[0] || '';
            }
          }

          // Clean up the name
          name = name.replace(/\s+/g, ' ').trim();

          // Skip if no name or if it's a generic link text
          if (!name || name.length < 5 || name.toLowerCase().includes('see more') || name.toLowerCase().includes('view all')) {
            return;
          }

          // Try to get image from parent container
          const parent = anchor.closest('li') || anchor.parentElement;
          const img = parent?.querySelector('img') as HTMLImageElement | null;

          cards.push({
            name,
            url: href.startsWith('http') ? href : `${baseUrl}${href}`,
            imageUrl: img?.src || null,
            annualFeeText: 'N/A',
            rating: null,
          });
        });

        return cards;
      },
      WALLETHUB_BASE,
      limit
    );

    loggers.scraper(query, 'search completed', { resultCount: results.length });
    return results;
  } catch (error: unknown) {
    // Capture full error details
    let errorMsg = 'Unknown error';
    let errorStack = '';

    if (error instanceof Error) {
      errorMsg = error.message;
      errorStack = error.stack || '';
    } else if (typeof error === 'string') {
      errorMsg = error;
    } else if (error && typeof error === 'object') {
      errorMsg = JSON.stringify(error);
    }

    logger.error(`Search failed: ${errorMsg}`, { query, stack: errorStack, errorType: typeof error, rawError: String(error) });
    loggers.error(new Error(`Search failed: ${errorMsg}`), { query });
    throw new Error(`Search failed: ${errorMsg}`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Scrape a single card from its WalletHub URL
 */
export async function scrapeCardFromUrl(url: string): Promise<ScrapedCardData> {
  let browser: Browser | null = null;

  try {
    loggers.scraper(url, 'scrape started');
    browser = await createBrowser();
    const page = await browser.newPage();
    await configurePage(page);

    // Navigate to card page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Try multiple container selectors to find card content
    const containerSelectors = [
      SELECTORS.cardContainer,
      '.card-details',
      '.product-details',
      '.card-container',
      'main',
      '#content'
    ];

    let hasCard = false;
    for (const selector of containerSelectors) {
      if (await exists(page, selector)) {
        hasCard = true;
        break;
      }
    }

    if (!hasCard) {
      throw new Error('Card container not found on page');
    }

    // Extract card data - Updated for WalletHub's actual page structure
    const cardData = await page.evaluate(() => {
      // Helper to safely get text
      const getText = (selectors: string[]): string => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
        return '';
      };

      // Helper to get list items
      const getListItems = (selectors: string[]): string[] => {
        const items: string[] = [];
        for (const sel of selectors) {
          const elements = document.querySelectorAll(sel);
          if (elements.length > 0) {
            elements.forEach((el) => {
              const text = el.textContent?.trim();
              if (text && !items.includes(text)) items.push(text);
            });
            break;
          }
        }
        return items;
      };

      // Extract name from h1 or title
      let name = getText(['h1', '.card-name', '[data-sel-id="card-title"]']);
      if (!name) {
        // Try from page title
        const title = document.title;
        if (title) {
          name = title.split(' Reviews')[0].split(' |')[0].trim();
        }
      }
      name = name.replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();

      if (!name) return null;

      // Generate slug
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Extract image URL - card image is usually in main content area
      const imageSelectors = [
        '.card-image img',
        '.product-image img',
        'img[alt*="card"]',
        'main img[src*="credit"]',
        'img[src*="wallethub"]'
      ];
      let imageUrl: string | null = null;
      for (const sel of imageSelectors) {
        const img = document.querySelector(sel) as HTMLImageElement | null;
        if (img?.src && !img.src.includes('avatar') && !img.src.includes('logo')) {
          imageUrl = img.src;
          break;
        }
      }

      // Extract overall rating - WalletHub shows a prominent rating number
      let overallRating: number | null = null;
      const ratingSelectors = [
        '.wh-rating-num',
        '.rating-number',
        '[class*="rating"] .number',
        '.details-wh-rating-num'
      ];
      for (const sel of ratingSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent) {
          const num = parseFloat(el.textContent.trim());
          if (!isNaN(num) && num >= 1 && num <= 5) {
            overallRating = num;
            break;
          }
        }
      }

      // If no rating found, try to find it in text containing rating values
      if (!overallRating) {
        const allText = document.body.innerText;
        const ratingMatch = allText.match(/WalletHub Rating[:\s]*(\d+\.?\d*)/i);
        if (ratingMatch) {
          overallRating = parseFloat(ratingMatch[1]);
        }
      }

      // Annual Fee
      let annualFeeText = '$0';
      let annualFee = 0;
      const feePatterns = [
        /annual\s*fee[:\s]*\$?([\d,]+)/i,
        /\$(\d+)\s*annual/i
      ];
      const pageText = document.body.innerText;
      for (const pattern of feePatterns) {
        const match = pageText.match(pattern);
        if (match) {
          annualFee = parseInt(match[1].replace(',', ''), 10);
          annualFeeText = `$${annualFee}`;
          break;
        }
      }

      // Regular APR
      let regularApr = 'N/A';
      const aprMatch = pageText.match(/regular\s*apr[:\s]*([\d.]+%?\s*-?\s*[\d.]*%?)/i) ||
                       pageText.match(/purchase\s*apr[:\s]*([\d.]+%?\s*-?\s*[\d.]*%?)/i);
      if (aprMatch) {
        regularApr = aprMatch[1].trim();
      }

      // Intro APR
      let introApr: string | null = null;
      const introMatch = pageText.match(/intro\s*apr[:\s]*([\d.]+%?[^.]*)/i) ||
                        pageText.match(/0%\s*(?:apr\s*)?for\s*(\d+)\s*months/i);
      if (introMatch) {
        introApr = introMatch[0].trim();
      }

      // Rewards rate
      let rewardsRate: string | null = null;
      let rewardsBonus: string | null = null;
      let rewardsType: string | null = null;

      const rewardsMatch = pageText.match(/([\d.]+%?\s*(?:cash\s*back|points?|miles?))/i);
      if (rewardsMatch) {
        rewardsRate = rewardsMatch[1].trim();
        const lower = rewardsRate.toLowerCase();
        if (lower.includes('cash')) rewardsType = 'cashback';
        else if (lower.includes('mile')) rewardsType = 'miles';
        else if (lower.includes('point')) rewardsType = 'points';
      }

      const bonusMatch = pageText.match(/(?:sign[- ]?up\s*)?bonus[:\s]*([^\n.]+)/i);
      if (bonusMatch) {
        rewardsBonus = bonusMatch[1].trim().substring(0, 100);
      }

      // Credit required - look for credit score info
      let creditRequired = 'N/A';
      const creditMatch = pageText.match(/credit\s*(?:score|needed|required)[:\s]*(excellent|good|fair|poor|bad|no credit|\d{3})/i);
      if (creditMatch) {
        creditRequired = creditMatch[1].trim();
      }

      // Detailed ratings
      let feesRating: number | null = null;
      let rewardsRating: number | null = null;
      let costRating: number | null = null;

      // Look for User Reviews, Editor's Review, Market Comparison ratings
      const userReviewMatch = pageText.match(/user\s*reviews?[:\s]*([\d.]+)/i);
      if (userReviewMatch) {
        feesRating = parseFloat(userReviewMatch[1]);
      }
      const editorMatch = pageText.match(/editor'?s?\s*review[:\s]*([\d.]+)/i);
      if (editorMatch) {
        rewardsRating = parseFloat(editorMatch[1]);
      }
      const marketMatch = pageText.match(/market\s*comparison[:\s]*([\d.]+)/i);
      if (marketMatch) {
        costRating = parseFloat(marketMatch[1]);
      }

      // Pros and cons
      const pros = getListItems([
        '.pros li',
        '[class*="pros"] li',
        '.advantages li'
      ]);
      const cons = getListItems([
        '.cons li',
        '[class*="cons"] li',
        '.disadvantages li'
      ]);

      return {
        name,
        slug,
        annualFee,
        annualFeeText,
        introApr,
        regularApr,
        rewardsRate,
        rewardsBonus,
        rewardsType,
        overallRating,
        feesRating,
        rewardsRating,
        costRating,
        pros,
        cons,
        creditRequired,
        imageUrl,
      };
    });

    if (!cardData) {
      throw new Error('Failed to extract card data from page');
    }

    loggers.scraper(cardData.name, 'scrape completed');

    return {
      ...cardData,
      sourceUrl: url,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Scrape failed: ${errorMsg}`), { url });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Scrape multiple cards from a WalletHub category page
 */
export async function scrapeCategoryPage(
  categoryUrl: string,
  limit = 20
): Promise<{ cards: ScrapedCardData[]; urls: string[] }> {
  let browser: Browser | null = null;

  try {
    loggers.scraper(categoryUrl, 'bulk scrape started', { limit });
    browser = await createBrowser();
    const page = await browser.newPage();
    await configurePage(page);

    // Navigate to category page
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: TIMEOUT });

    // Scroll to load more cards (lazy loading)
    await autoScroll(page);

    // Extract card URLs from the category page
    const cardUrls = await page.evaluate(
      (selectors, maxCards) => {
        const urls: string[] = [];
        const containers = document.querySelectorAll(selectors.cardContainer);

        containers.forEach((container, index) => {
          if (index >= maxCards) return;
          const linkEl = container.querySelector(selectors.cardLink) as HTMLAnchorElement;
          if (linkEl?.href) {
            urls.push(linkEl.href);
          }
        });

        return urls;
      },
      SELECTORS,
      limit
    );

    await browser.close();
    browser = null;

    // Scrape each card URL with delays
    const cards: ScrapedCardData[] = [];
    for (const url of cardUrls) {
      try {
        await delay(REQUEST_DELAY);
        const card = await scrapeCardFromUrl(url);
        cards.push(card);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to scrape ${url}: ${errorMsg}`);
      }
    }

    loggers.scraper(categoryUrl, 'bulk scrape completed', {
      requested: limit,
      found: cardUrls.length,
      scraped: cards.length,
    });

    return { cards, urls: cardUrls };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Auto-scroll to load lazy-loaded content
 */
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const maxScrolls = 10;
      let scrollCount = 0;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;

        if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });

  // Wait for any new content to load
  await delay(1000);
}

/**
 * Search for a card by name and scrape it using smart matching
 */
export async function searchAndScrapeCard(
  cardName: string
): Promise<ScrapedCardData | null> {
  // First, search for the card
  const searchResults = await searchWalletHub(cardName, 10);

  if (searchResults.length === 0) {
    logger.warn(`No search results found for: ${cardName}`);
    return null;
  }

  // Use smart matching to find the best result
  const bestMatch = findBestMatch(cardName, searchResults);

  if (!bestMatch) {
    logger.warn(`No suitable match found for: ${cardName}`);
    return null;
  }

  if (!bestMatch.url) {
    logger.warn(`Best match has no URL: ${bestMatch.name}`);
    return null;
  }

  logger.info(`Selected match for "${cardName}": "${bestMatch.name}"`);

  // Scrape the card page
  await delay(REQUEST_DELAY);
  return scrapeCardFromUrl(bestMatch.url);
}
