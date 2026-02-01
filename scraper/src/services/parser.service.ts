import { ScrapedCardData, CreditCard } from '../types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Generate a unique ID for a card based on its slug
 */
export function generateCardId(slug: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${slug}-${timestamp}${random}`;
}

/**
 * Generate search terms for a card to enable full-text search
 */
export function generateSearchTerms(card: ScrapedCardData): string[] {
  const terms = new Set<string>();

  // Add name words
  card.name
    .toLowerCase()
    .split(/\s+/)
    .forEach((word) => {
      if (word.length > 2) terms.add(word);
    });

  // Add common variations (remove dots, hyphens)
  const nameVariations = card.name.toLowerCase().replace(/\./g, '').replace(/-/g, ' ');
  nameVariations.split(/\s+/).forEach((word) => {
    if (word.length > 2) terms.add(word);
  });

  // Add slug words
  card.slug.split('-').forEach((word) => {
    if (word.length > 2) terms.add(word);
  });

  // Add rewards type
  if (card.rewardsType) {
    terms.add(card.rewardsType);
  }

  // Add credit level keywords
  if (card.creditRequired) {
    card.creditRequired
      .toLowerCase()
      .split(/[,\s]+/)
      .forEach((word) => {
        if (word.length > 2) terms.add(word);
      });
  }

  // Add feature keywords
  if (card.annualFee === 0) {
    terms.add('no annual fee');
    terms.add('free');
  }

  // Add issuer names if detectable
  const issuerKeywords = ['chase', 'amex', 'citi', 'capital one', 'discover', 'wells fargo', 'bank of america'];
  const lowerName = card.name.toLowerCase();
  issuerKeywords.forEach((issuer) => {
    if (lowerName.includes(issuer)) {
      terms.add(issuer);
    }
  });

  return Array.from(terms);
}

/**
 * Transform scraped data into the CreditCard format for Firestore
 */
export function transformToCard(
  scraped: ScrapedCardData,
  imageUrl: string,
  existingId?: string
): CreditCard {
  const now = Timestamp.now();
  const id = existingId || generateCardId(scraped.slug);

  // Extract image filename from URL
  const imageFilename = imageUrl
    ? imageUrl.split('/').pop() || `${scraped.slug}.webp`
    : '';

  return {
    id,
    name: scraped.name,
    slug: scraped.slug,

    // Fees
    annualFee: scraped.annualFee,
    annualFeeText: scraped.annualFeeText,

    // APR
    apr: {
      introApr: scraped.introApr,
      regularApr: scraped.regularApr,
    },

    // Rewards
    rewards: {
      rate: scraped.rewardsRate,
      bonus: scraped.rewardsBonus,
      type: scraped.rewardsType,
    },

    // Ratings
    ratings: {
      overall: scraped.overallRating,
      fees: scraped.feesRating,
      rewards: scraped.rewardsRating,
      cost: scraped.costRating,
    },

    // Content
    pros: scraped.pros,
    cons: scraped.cons,
    creditRequired: scraped.creditRequired,

    // Location (USA only for WalletHub)
    country: 'United States',
    countryCode: 'US',
    currency: 'USD',
    currencySymbol: '$',

    // Image
    imageUrl,
    imageFilename,

    // Source tracking
    sourceUrl: scraped.sourceUrl,

    // Metadata
    createdAt: now,
    updatedAt: now,

    // Search
    searchTerms: generateSearchTerms(scraped),
  };
}

/**
 * Compare two cards and return list of changed fields
 */
export function compareCards(
  existing: CreditCard,
  updated: ScrapedCardData
): string[] {
  const changes: string[] = [];

  if (existing.name !== updated.name) changes.push('name');
  if (existing.annualFee !== updated.annualFee) changes.push('annualFee');
  if (existing.annualFeeText !== updated.annualFeeText) changes.push('annualFeeText');
  if (existing.apr.introApr !== updated.introApr) changes.push('apr.introApr');
  if (existing.apr.regularApr !== updated.regularApr) changes.push('apr.regularApr');
  if (existing.rewards.rate !== updated.rewardsRate) changes.push('rewards.rate');
  if (existing.rewards.bonus !== updated.rewardsBonus) changes.push('rewards.bonus');
  if (existing.rewards.type !== updated.rewardsType) changes.push('rewards.type');
  if (existing.ratings.overall !== updated.overallRating) changes.push('ratings.overall');
  if (existing.ratings.fees !== updated.feesRating) changes.push('ratings.fees');
  if (existing.ratings.rewards !== updated.rewardsRating) changes.push('ratings.rewards');
  if (existing.ratings.cost !== updated.costRating) changes.push('ratings.cost');
  if (existing.creditRequired !== updated.creditRequired) changes.push('creditRequired');

  // Compare arrays
  if (JSON.stringify(existing.pros) !== JSON.stringify(updated.pros)) changes.push('pros');
  if (JSON.stringify(existing.cons) !== JSON.stringify(updated.cons)) changes.push('cons');

  return changes;
}

/**
 * Merge updated data into existing card
 */
export function mergeCardUpdate(
  existing: CreditCard,
  updated: ScrapedCardData,
  newImageUrl?: string
): CreditCard {
  return {
    ...existing,
    name: updated.name,
    slug: updated.slug,
    annualFee: updated.annualFee,
    annualFeeText: updated.annualFeeText,
    apr: {
      introApr: updated.introApr,
      regularApr: updated.regularApr,
    },
    rewards: {
      rate: updated.rewardsRate,
      bonus: updated.rewardsBonus,
      type: updated.rewardsType,
    },
    ratings: {
      overall: updated.overallRating,
      fees: updated.feesRating,
      rewards: updated.rewardsRating,
      cost: updated.costRating,
    },
    pros: updated.pros,
    cons: updated.cons,
    creditRequired: updated.creditRequired,
    sourceUrl: updated.sourceUrl,
    ...(newImageUrl && {
      imageUrl: newImageUrl,
      imageFilename: newImageUrl.split('/').pop() || existing.imageFilename,
    }),
    updatedAt: Timestamp.now(),
    searchTerms: generateSearchTerms(updated),
  };
}
