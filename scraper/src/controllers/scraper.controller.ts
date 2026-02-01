import { Request, Response } from 'express';
import * as scraperService from '../services/scraper.service';
import * as firestoreService from '../services/firestore.service';
import * as imageService from '../services/image.service';
import * as parserService from '../services/parser.service';
import { loggers } from '../config/logger';
import {
  createResponse,
  SearchResponse,
  ScrapeCardResponse,
  BulkScrapeResponse,
  UpdateCardResponse,
  CreditCard,
} from '../types';

/**
 * GET /v1/scrape/search
 * Search WalletHub for credit cards
 */
export async function searchCards(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 10;

    loggers.scraper(query, 'search request received');

    // Search existing cards first
    const existingCards = await firestoreService.searchCardsByName(query, limit);

    // Search WalletHub
    const wallethubResults = await scraperService.searchWalletHub(query, limit);

    const response: SearchResponse = {
      existingCards,
      wallethubResults,
    };

    res.json(createResponse(true, response));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Search failed: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to search cards', 'INTERNAL')
    );
  }
}

/**
 * POST /v1/scrape/card
 * Scrape a single card from WalletHub URL
 */
export async function scrapeCard(req: Request, res: Response): Promise<void> {
  try {
    const { url, forceUpdate } = req.body;

    loggers.scraper(url, 'scrape card request received');

    // Scrape the card
    const scrapedData = await scraperService.scrapeCardFromUrl(url);

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

    // Transform to CreditCard format
    const card = parserService.transformToCard(
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
    loggers.error(new Error(`Scrape card failed: ${errorMsg}`));

    if (errorMsg.includes('not found')) {
      res.status(404).json(
        createResponse(false, undefined, 'Card not found on WalletHub', 'NOT_FOUND')
      );
    } else if (errorMsg.includes('timeout')) {
      res.status(504).json(
        createResponse(false, undefined, 'Request timed out', 'TIMEOUT')
      );
    } else {
      res.status(500).json(
        createResponse(false, undefined, 'Failed to scrape card', 'INTERNAL')
      );
    }
  }
}

/**
 * POST /v1/scrape/bulk
 * Bulk scrape cards from a WalletHub category page
 */
export async function bulkScrape(req: Request, res: Response): Promise<void> {
  try {
    const { categoryUrl, limit, skipExisting } = req.body;

    loggers.scraper(categoryUrl, 'bulk scrape request received', { limit, skipExisting });

    // Get card URLs from category page
    const { cards: scrapedCards } = await scraperService.scrapeCategoryPage(
      categoryUrl,
      limit
    );

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

        // Transform and save
        const card = parserService.transformToCard(scrapedData, imageUrl);
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
    loggers.error(new Error(`Bulk scrape failed: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to bulk scrape cards', 'INTERNAL')
    );
  }
}

/**
 * POST /v1/scrape/update/:cardId
 * Re-scrape and update an existing card
 */
export async function updateCard(req: Request, res: Response): Promise<void> {
  try {
    const { cardId } = req.params;

    loggers.scraper(cardId, 'update card request received');

    // Get existing card
    const existing = await firestoreService.getCardById(cardId);
    if (!existing) {
      res.status(404).json(
        createResponse(false, undefined, 'Card not found', 'NOT_FOUND')
      );
      return;
    }

    // Determine source URL or search by name
    let scrapedData;
    if (existing.sourceUrl) {
      scrapedData = await scraperService.scrapeCardFromUrl(existing.sourceUrl);
    } else {
      // Search and scrape by name
      scrapedData = await scraperService.searchAndScrapeCard(existing.name);
      if (!scrapedData) {
        res.status(404).json(
          createResponse(
            false,
            undefined,
            'Card not found on WalletHub',
            'NOT_FOUND'
          )
        );
        return;
      }
    }

    // Compare changes
    const changes = parserService.compareCards(existing, scrapedData);

    // Check if image changed
    let newImageUrl: string | undefined;
    if (
      scrapedData.imageUrl &&
      scrapedData.imageUrl !== existing.imageUrl
    ) {
      newImageUrl = await imageService.processCardImage(
        scrapedData.imageUrl,
        scrapedData.slug
      );
      if (newImageUrl) {
        changes.push('imageUrl');
      }
    }

    // Merge updates
    const updatedCard = parserService.mergeCardUpdate(
      existing,
      scrapedData,
      newImageUrl
    );

    // Save to Firestore
    await firestoreService.updateCard(existing.id, updatedCard);

    const response: UpdateCardResponse = {
      card: updatedCard,
      changes,
    };

    res.json(createResponse(true, response));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Update card failed: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to update card', 'INTERNAL')
    );
  }
}

/**
 * GET /v1/scrape/card/:slug
 * Scrape a card by slug if not in database
 */
export async function scrapeBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const forceUpdate = req.query.forceUpdate === 'true';

    loggers.scraper(slug, 'scrape by slug request received');

    // Check if exists
    const existing = await firestoreService.getCardBySlug(slug);
    if (existing && !forceUpdate) {
      const response: ScrapeCardResponse = {
        card: existing,
        isNew: false,
        imageUploaded: false,
      };
      res.json(createResponse(true, response));
      return;
    }

    // Search WalletHub for the card
    const searchQuery = slug.replace(/-/g, ' ');
    const scrapedData = await scraperService.searchAndScrapeCard(searchQuery);

    if (!scrapedData) {
      res.status(404).json(
        createResponse(false, undefined, 'Card not found on WalletHub', 'NOT_FOUND')
      );
      return;
    }

    // Process image
    const imageUrl = await imageService.processCardImage(
      scrapedData.imageUrl,
      scrapedData.slug
    );

    // Transform and save
    const card = parserService.transformToCard(
      scrapedData,
      imageUrl,
      existing?.id
    );
    const { card: savedCard, isNew } = await firestoreService.upsertCard(card);

    const response: ScrapeCardResponse = {
      card: savedCard,
      isNew,
      imageUploaded: !!imageUrl,
    };

    res.status(isNew ? 201 : 200).json(createResponse(true, response));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Scrape by slug failed: ${errorMsg}`));
    res.status(500).json(
      createResponse(false, undefined, 'Failed to scrape card', 'INTERNAL')
    );
  }
}
