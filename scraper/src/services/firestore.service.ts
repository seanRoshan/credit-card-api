import { db } from '../config/firebase';
import { CreditCard } from '../types';
import logger, { loggers } from '../config/logger';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'credit_cards';
const collection = db.collection(COLLECTION_NAME);

/**
 * Get a card by its ID
 */
export async function getCardById(id: string): Promise<CreditCard | null> {
  try {
    const doc = await collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() as CreditCard;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to get card: ${errorMsg}`), { id });
    throw error;
  }
}

/**
 * Get a card by its slug
 */
export async function getCardBySlug(slug: string): Promise<CreditCard | null> {
  try {
    const snapshot = await collection.where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) {
      return null;
    }
    return snapshot.docs[0].data() as CreditCard;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to get card by slug: ${errorMsg}`), { slug });
    throw error;
  }
}

/**
 * Search for cards by name (partial match)
 */
export async function searchCardsByName(
  name: string,
  limit = 10
): Promise<CreditCard[]> {
  try {
    // Normalize search terms
    const searchTerms = name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    if (searchTerms.length === 0) {
      return [];
    }

    // Use array-contains-any for search (Firestore limitation: max 10 values)
    const snapshot = await collection
      .where('searchTerms', 'array-contains-any', searchTerms.slice(0, 10))
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as CreditCard);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to search cards: ${errorMsg}`), { name });
    throw error;
  }
}

/**
 * Check if a card with the given slug exists
 */
export async function cardExistsBySlug(slug: string): Promise<boolean> {
  const card = await getCardBySlug(slug);
  return card !== null;
}

/**
 * Search for cards by name filtered by country
 */
export async function searchCardsByCountry(
  name: string,
  countryCode: 'US' | 'CA',
  limit = 10
): Promise<CreditCard[]> {
  try {
    // Normalize search terms
    const searchTerms = name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    if (searchTerms.length === 0) {
      // Return cards from the specified country if no search terms
      const snapshot = await collection
        .where('countryCode', '==', countryCode)
        .limit(limit)
        .get();
      return snapshot.docs.map((doc) => doc.data() as CreditCard);
    }

    // Search by terms first, then filter by country
    // Note: Firestore doesn't support combining array-contains-any with other where clauses well
    // So we fetch more and filter in memory
    const snapshot = await collection
      .where('searchTerms', 'array-contains-any', searchTerms.slice(0, 10))
      .limit(limit * 3) // Fetch more to account for filtering
      .get();

    const cards = snapshot.docs
      .map((doc) => doc.data() as CreditCard)
      .filter((card) => card.countryCode === countryCode)
      .slice(0, limit);

    return cards;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to search cards by country: ${errorMsg}`), { name, countryCode });
    throw error;
  }
}

/**
 * Create a new card
 */
export async function createCard(card: CreditCard): Promise<CreditCard> {
  try {
    await collection.doc(card.id).set(card);
    loggers.scraper(card.name, 'card created', { id: card.id });
    return card;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to create card: ${errorMsg}`), { card: card.name });
    throw error;
  }
}

/**
 * Update an existing card
 */
export async function updateCard(
  id: string,
  updates: Partial<CreditCard>
): Promise<CreditCard> {
  try {
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    await collection.doc(id).update(updateData);

    const updated = await getCardById(id);
    if (!updated) {
      throw new Error('Card not found after update');
    }

    loggers.scraper(updated.name, 'card updated', { id });
    return updated;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    loggers.error(new Error(`Failed to update card: ${errorMsg}`), { id });
    throw error;
  }
}

/**
 * Create or update a card based on slug
 */
export async function upsertCard(card: CreditCard): Promise<{
  card: CreditCard;
  isNew: boolean;
}> {
  const existing = await getCardBySlug(card.slug);

  if (existing) {
    // Update existing card, preserving ID and createdAt
    const updated = await updateCard(existing.id, {
      ...card,
      id: existing.id,
      createdAt: existing.createdAt,
    });
    return { card: updated, isNew: false };
  } else {
    // Create new card
    const created = await createCard(card);
    return { card: created, isNew: true };
  }
}

/**
 * Batch create multiple cards
 */
export async function batchCreateCards(
  cards: CreditCard[]
): Promise<{ created: number; updated: number; failed: number }> {
  const results = { created: 0, updated: 0, failed: 0 };

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500;
  for (let i = 0; i < cards.length; i += batchSize) {
    const batch = db.batch();
    const batchCards = cards.slice(i, i + batchSize);

    for (const card of batchCards) {
      try {
        const existing = await getCardBySlug(card.slug);
        if (existing) {
          batch.update(collection.doc(existing.id), {
            ...card,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: Timestamp.now(),
          });
          results.updated++;
        } else {
          batch.set(collection.doc(card.id), card);
          results.created++;
        }
      } catch {
        results.failed++;
      }
    }

    await batch.commit();
    logger.debug(`Batch processed: ${i + batchCards.length}/${cards.length}`);
  }

  return results;
}

/**
 * Get card count
 */
export async function getCardCount(): Promise<number> {
  const snapshot = await collection.count().get();
  return snapshot.data().count;
}

/**
 * Check if exact name match exists
 */
export async function hasExactNameMatch(name: string): Promise<boolean> {
  const normalizedName = name.toLowerCase().trim();
  const snapshot = await collection.get();

  return snapshot.docs.some((doc) => {
    const card = doc.data() as CreditCard;
    return card.name.toLowerCase().trim() === normalizedName;
  });
}
