import { Timestamp } from 'firebase-admin/firestore';

// Reuse the same CreditCard interface from backend
export interface CreditCard {
  id: string;
  name: string;
  slug: string;

  // Fees
  annualFee: number;
  annualFeeText: string;

  // APR
  apr: {
    introApr: string | null;
    regularApr: string;
  };

  // Rewards
  rewards: {
    rate: string | null;
    bonus: string | null;
    type: string | null;
  };

  // Ratings (out of 5)
  ratings: {
    overall: number | null;
    fees: number | null;
    rewards: number | null;
    cost: number | null;
  };

  // Content
  pros: string[];
  cons: string[];
  creditRequired: string;

  // Location & Currency
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;

  // Image
  imageUrl: string;
  imageFilename: string;

  // Source tracking (for scraping)
  sourceUrl?: string;

  // Metadata
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;

  // Search optimization
  searchTerms: string[];
}

// Raw scraped data before transformation
export interface ScrapedCardData {
  name: string;
  slug: string;
  annualFee: number;
  annualFeeText: string;
  introApr: string | null;
  regularApr: string;
  rewardsRate: string | null;
  rewardsBonus: string | null;
  rewardsType: string | null;
  overallRating: number | null;
  feesRating: number | null;
  rewardsRating: number | null;
  costRating: number | null;
  pros: string[];
  cons: string[];
  creditRequired: string;
  imageUrl: string | null;
  sourceUrl: string;
}

// WalletHub search result
export interface WalletHubSearchResult {
  name: string;
  url: string;
  imageUrl: string | null;
  annualFeeText: string;
  rating: number | null;
}

// API Request types
export interface SearchQuery {
  q: string;
  limit?: number;
}

export interface ScrapeCardRequest {
  url: string;
  forceUpdate?: boolean;
}

export interface BulkScrapeRequest {
  categoryUrl: string;
  limit?: number;
  skipExisting?: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
  timestamp: string;
}

export interface SearchResponse {
  wallethubResults: WalletHubSearchResult[];
  existingCards: CreditCard[];
}

export interface ScrapeCardResponse {
  card: CreditCard;
  isNew: boolean;
  imageUploaded: boolean;
}

export interface BulkScrapeResponse {
  scraped: number;
  skipped: number;
  failed: number;
  cards: CreditCard[];
  errors?: string[];
}

export interface UpdateCardResponse {
  card: CreditCard;
  changes: string[];
}

// Error codes
export type ErrorCode =
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'PARSE_ERROR'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'INTERNAL';

// Helper function to create API response
export function createResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  code?: ErrorCode
): ApiResponse<T> {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(error && { error }),
    ...(code && { code }),
    timestamp: new Date().toISOString(),
  };
}
