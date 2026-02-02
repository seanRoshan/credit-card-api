import { Timestamp } from 'firebase-admin/firestore';

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

  // Metadata
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;

  // Search optimization
  searchTerms: string[];
}

export interface CreditCardRaw {
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
  imageFilename: string | null;
}

export interface CardListResponse {
  data: CreditCard[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CardSearchParams {
  q?: string;
  limit?: number;
  offset?: number;
  sort?: 'name' | 'annualFee' | 'rating';
  order?: 'asc' | 'desc';
  noAnnualFee?: boolean;
  creditRequired?: string;
  country?: 'US' | 'CA';
}
