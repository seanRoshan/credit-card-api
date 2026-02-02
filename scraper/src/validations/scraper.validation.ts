import { z } from 'zod';

// URL validation helper for WalletHub URLs
const walletHubUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine((url) => url.includes('wallethub.com'), {
    message: 'URL must be a WalletHub URL',
  });

// URL validation helper for RateHub URLs
const rateHubUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine((url) => url.includes('ratehub.ca'), {
    message: 'URL must be a RateHub URL',
  });

/**
 * Schema for GET /v1/scrape/search
 * Search WalletHub for credit cards by name
 */
export const searchQuerySchema = z.object({
  query: z.object({
    q: z
      .string()
      .min(2, 'Search query must be at least 2 characters')
      .max(100, 'Search query must be at most 100 characters'),
    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a number')
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => !val || (val >= 1 && val <= 50), {
        message: 'Limit must be between 1 and 50',
      }),
  }),
});

/**
 * Schema for POST /v1/scrape/card
 * Scrape a single card from WalletHub URL
 */
export const scrapeCardSchema = z.object({
  body: z.object({
    url: walletHubUrlSchema,
    forceUpdate: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for POST /v1/scrape/ratehub/card
 * Scrape a single card from RateHub URL
 */
export const scrapeRateHubCardSchema = z.object({
  body: z.object({
    url: rateHubUrlSchema,
    forceUpdate: z.boolean().optional().default(false),
  }),
});

/**
 * Schema for POST /v1/scrape/bulk
 * Bulk scrape cards from a WalletHub category page
 */
export const bulkScrapeSchema = z.object({
  body: z.object({
    categoryUrl: walletHubUrlSchema,
    limit: z
      .number()
      .int()
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .optional()
      .default(20),
    skipExisting: z.boolean().optional().default(true),
  }),
});

/**
 * Schema for POST /v1/scrape/ratehub/bulk
 * Bulk scrape cards from a RateHub category page
 */
export const bulkScrapeRateHubSchema = z.object({
  body: z.object({
    categoryUrl: rateHubUrlSchema,
    limit: z
      .number()
      .int()
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .optional()
      .default(50),
    skipExisting: z.boolean().optional().default(true),
  }),
});

/**
 * Schema for POST /v1/scrape/ratehub/import-all
 * Import all cards from all RateHub categories
 */
export const importAllRateHubSchema = z.object({
  body: z.object({
    limitPerCategory: z
      .number()
      .int()
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .optional()
      .default(30),
    skipExisting: z.boolean().optional().default(true),
  }),
});

/**
 * Schema for POST /v1/scrape/update/:cardId
 * Re-scrape an existing card by its Firestore ID
 */
export const updateCardSchema = z.object({
  params: z.object({
    cardId: z
      .string()
      .min(1, 'Card ID is required')
      .max(100, 'Card ID is too long'),
  }),
});

/**
 * Schema for GET /v1/scrape/card/:slug
 * Scrape a card by its slug (if not in database)
 */
export const scrapeBySlugSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(200, 'Slug is too long')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  }),
  query: z.object({
    forceUpdate: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

// Export types inferred from schemas
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type ScrapeCardInput = z.infer<typeof scrapeCardSchema>;
export type BulkScrapeInput = z.infer<typeof bulkScrapeSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type ScrapeBySlugInput = z.infer<typeof scrapeBySlugSchema>;
