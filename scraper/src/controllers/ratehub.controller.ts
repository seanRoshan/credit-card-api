import { Request, Response } from 'express';
import * as ratehubService from '../services/ratehub.service';
import * as firestoreService from '../services/firestore.service';
import * as imageService from '../services/image.service';
import * as parserService from '../services/parser.service';
import { loggers } from '../config/logger';
import {
  createResponse,
  ScrapeCardResponse,
  BulkScrapeResponse,
  CreditCard,
} from '../types';

/**
 * POST /v1/scrape/ratehub/card
 * Scrape cards from a RateHub URL (blog page or direct card page)
 */
export async function scrapeRateHubCard(req: Request, res: Response): Promise<void> {
  try {
    const { url, forceUpdate } = req.body;

    loggers.scraper(url, 'RateHub scrape card request received');

    // Scrape the card(s) from the URL
    const scrapedData = await ratehubService.scrapeCardFromUrl(url);

    // Check if card already exists
    const existing = await firestoreService.getCardBySlug(scrapedData.slug);

    if (existing && !forceUpdate) {
      const response: ScrapeCardResponse = {
        card: existing,
        isNew: false,
        imageUploaded: false,
      };
      res.json(createResponse(true, response));
      return;
    }

    // Process and upload image
    const imageUrl = await imageService.processCardImage(
      scrapedData.imageUrl,
      scrapedData.slug
    );

    // Transform to CreditCard format (Canada)
    const card = parserService.transformRateHubToCard(
      scrapedData,
      imageUrl,
      existing?.id
    );

    // Save to Firestore
    const { card: savedCard, isNew } = await firestoreService.upsertCard(card);

    const response: ScrapeCardResponse = {
      card: savedCard,
      isNew,
      imageUploaded: !!imageUrl,
    };

    res.status(isNew ? 201 : 200).json(createResponse(true, response));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`RateHub scrape card failed: ${errorMsg}`));

    if (errorMsg.includes('not found') || errorMsg.includes('No cards found')) {
      res.status(404).json(
        createResponse(false, undefined, 'No cards found on this page', 'NOT_FOUND')
      );
    } else if (errorMsg.includes('timeout')) {
      res.status(504).json(
        createResponse(false, undefined, 'Request timed out', 'TIMEOUT')
      );
    } else {
      res.status(500).json(
        createResponse(false, undefined, 'Failed to scrape from RateHub', 'INTERNAL')
      );
    }
  }
}

/**
 * POST /v1/scrape/ratehub/bulk
 * Bulk scrape cards from a RateHub category/blog page URL
 */
export async function bulkScrapeRateHub(req: Request, res: Response): Promise<void> {
  try {
    const { categoryUrl, limit = 50, skipExisting = true } = req.body;

    loggers.scraper(categoryUrl, 'RateHub bulk scrape request received', { limit, skipExisting });

    // Get cards from category page
    const { cards: scrapedCards, total } = await ratehubService.scrapeCategoryPage(
      categoryUrl,
      limit
    );

    loggers.scraper(categoryUrl, `Found ${total} cards on page, processing ${scrapedCards.length}`);

    const results: CreditCard[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const scrapedData of scrapedCards) {
      try {
        // Check if should skip existing
        if (skipExisting) {
          const exists = await firestoreService.cardExistsBySlug(scrapedData.slug);
          if (exists) {
            skipped++;
            continue;
          }
        }

        // Process image
        const imageUrl = await imageService.processCardImage(
          scrapedData.imageUrl,
          scrapedData.slug
        );

        // Transform and save (Canada)
        const card = parserService.transformRateHubToCard(scrapedData, imageUrl);
        const { card: savedCard } = await firestoreService.upsertCard(card);
        results.push(savedCard);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${scrapedData.name}: ${errorMsg}`);
      }
    }

    const response: BulkScrapeResponse = {
      scraped: results.length,
      skipped,
      failed: errors.length,
      cards: results,
      ...(errors.length > 0 && { errors }),
    };

    res.json(createResponse(true, response));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`RateHub bulk scrape failed: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to bulk scrape from RateHub', 'INTERNAL')
    );
  }
}

/**
 * GET /v1/scrape/ratehub/categories
 * Get all available RateHub category URLs for bulk import
 */
export async function getRateHubCategories(_req: Request, res: Response): Promise<void> {
  try {
    const categories = ratehubService.getAllCategoryUrls();

    // Transform to simpler format for frontend
    const categoryList = Object.entries(categories).map(([key, value]) => ({
      key,
      name: value.name,
      url: value.url,
    }));

    res.json(createResponse(true, {
      categories: categoryList,
      total: categoryList.length,
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to get RateHub categories: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to get categories', 'INTERNAL')
    );
  }
}

/**
 * POST /v1/scrape/ratehub/import-all
 * Import all cards from all RateHub categories
 */
export async function importAllRateHub(req: Request, res: Response): Promise<void> {
  try {
    const { limitPerCategory = 30, skipExisting = true } = req.body;

    loggers.scraper('all-categories', 'RateHub import all request received', { limitPerCategory, skipExisting });

    const categories = ratehubService.getAllCategoryUrls();
    const allResults: CreditCard[] = [];
    const allErrors: string[] = [];
    let totalSkipped = 0;
    const categoryStats: Record<string, { scraped: number; skipped: number; failed: number }> = {};

    for (const [categoryKey, categoryInfo] of Object.entries(categories)) {
      try {
        loggers.scraper(categoryKey, `Processing category: ${categoryInfo.name} - ${categoryInfo.url}`);

        const { cards: scrapedCards, total } = await ratehubService.scrapeCategoryPage(
          categoryInfo.url,
          limitPerCategory
        );

        loggers.scraper(categoryKey, `Found ${total} cards, processing ${scrapedCards.length}`);

        let categoryScraped = 0;
        let categorySkipped = 0;
        let categoryFailed = 0;

        for (const scrapedData of scrapedCards) {
          try {
            // Check if should skip existing
            if (skipExisting) {
              const exists = await firestoreService.cardExistsBySlug(scrapedData.slug);
              if (exists) {
                categorySkipped++;
                totalSkipped++;
                continue;
              }
            }

            // Process image
            const imageUrl = await imageService.processCardImage(
              scrapedData.imageUrl,
              scrapedData.slug
            );

            // Transform and save
            const card = parserService.transformRateHubToCard(scrapedData, imageUrl);
            const { card: savedCard } = await firestoreService.upsertCard(card);
            allResults.push(savedCard);
            categoryScraped++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            allErrors.push(`[${categoryInfo.name}] ${scrapedData.name}: ${errorMsg}`);
            categoryFailed++;
          }
        }

        categoryStats[categoryKey] = {
          scraped: categoryScraped,
          skipped: categorySkipped,
          failed: categoryFailed,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        allErrors.push(`[${categoryInfo.name}] Category failed: ${errorMsg}`);
        categoryStats[categoryKey] = { scraped: 0, skipped: 0, failed: 1 };
      }
    }

    res.json(createResponse(true, {
      totalScraped: allResults.length,
      totalSkipped,
      totalFailed: allErrors.length,
      categoryStats,
      cards: allResults,
      ...(allErrors.length > 0 && { errors: allErrors.slice(0, 50) }),
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`RateHub import all failed: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to import all from RateHub', 'INTERNAL')
    );
  }
}
