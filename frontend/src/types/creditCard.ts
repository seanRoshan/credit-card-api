export interface CreditCard {
  id: string;
  name: string;
  slug: string;
  annualFee: number;
  annualFeeText: string;
  apr: {
    introApr: string | null;
    regularApr: string;
  };
  rewards: {
    rate: string | null;
    bonus: string | null;
    type: string | null;
  };
  ratings: {
    overall: number | null;
    fees: number | null;
    rewards: number | null;
    cost: number | null;
  };
  pros: string[];
  cons: string[];
  creditRequired: string;
  country: string;
  countryCode: string;
  currency: string;
  currencySymbol: string;
  imageUrl: string;
  imageFilename: string;
  searchTerms: string[];
  createdAt: string;
  updatedAt: string;
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

export interface CardSearchResponse {
  data: CreditCard[];
}
