import { Router } from 'express';
import * as controller from '../controllers/scraper.controller';
import { authenticateApiKey } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  searchQuerySchema,
  scrapeCardSchema,
  bulkScrapeSchema,
  updateCardSchema,
  scrapeBySlugSchema,
} from '../validations/scraper.validation';

const router = Router();

/**
 * @route   GET /v1/scrape/search
 * @desc    Search WalletHub for credit cards
 * @access  Protected (API Key)
 * @query   q - Search query (required, min 3 chars)
 * @query   limit - Max results (optional, default 10, max 50)
 */
router.get(
  '/search',
  authenticateApiKey,
  validate(searchQuerySchema),
  controller.searchCards
);

/**
 * @route   POST /v1/scrape/card
 * @desc    Scrape a single card from WalletHub URL
 * @access  Protected (API Key)
 * @body    url - WalletHub card URL (required)
 * @body    forceUpdate - Re-scrape even if exists (optional, default false)
 */
router.post(
  '/card',
  authenticateApiKey,
  validate(scrapeCardSchema),
  controller.scrapeCard
);

/**
 * @route   GET /v1/scrape/card/:slug
 * @desc    Scrape a card by slug if not in database
 * @access  Protected (API Key)
 * @param   slug - Card slug
 * @query   forceUpdate - Re-scrape even if exists (optional)
 */
router.get(
  '/card/:slug',
  authenticateApiKey,
  validate(scrapeBySlugSchema),
  controller.scrapeBySlug
);

/**
 * @route   POST /v1/scrape/bulk
 * @desc    Bulk scrape cards from a WalletHub category page
 * @access  Protected (API Key)
 * @body    categoryUrl - WalletHub category page URL (required)
 * @body    limit - Max cards to scrape (optional, default 20, max 100)
 * @body    skipExisting - Skip cards already in DB (optional, default true)
 */
router.post(
  '/bulk',
  authenticateApiKey,
  validate(bulkScrapeSchema),
  controller.bulkScrape
);

/**
 * @route   POST /v1/scrape/update/:cardId
 * @desc    Re-scrape and update an existing card
 * @access  Protected (API Key)
 * @param   cardId - Firestore document ID
 */
router.post(
  '/update/:cardId',
  authenticateApiKey,
  validate(updateCardSchema),
  controller.updateCard
);

export default router;
