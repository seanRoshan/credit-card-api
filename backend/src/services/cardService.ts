import { db } from '../config/firebase';
import { CreditCard, CardSearchParams, CardListResponse } from '../types/creditCard';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'credit_cards';

export class CardService {
  private collection = db.collection(COLLECTION_NAME);

  async createCard(card: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = this.collection.doc();
    const now = Timestamp.now();

    const cardWithMeta: CreditCard = {
      ...card,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(cardWithMeta);
    return docRef.id;
  }

  async createCardWithId(id: string, card: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const docRef = this.collection.doc(id);
    const now = Timestamp.now();

    const cardWithMeta: CreditCard = {
      ...card,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(cardWithMeta);
  }

  async batchCreateCards(cards: Array<Omit<CreditCard, 'createdAt' | 'updatedAt'>>): Promise<void> {
    const batchSize = 500; // Firestore limit
    const now = Timestamp.now();

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = db.batch();
      const batchCards = cards.slice(i, i + batchSize);

      for (const card of batchCards) {
        const docRef = this.collection.doc(card.id);
        const cardWithMeta: CreditCard = {
          ...card,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(docRef, cardWithMeta);
      }

      await batch.commit();
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: Saved ${batchCards.length} cards`);
    }
  }

  async getCardById(id: string): Promise<CreditCard | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as CreditCard;
  }

  async getCardBySlug(slug: string): Promise<CreditCard | null> {
    const snapshot = await this.collection
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as CreditCard;
  }

  async getCards(params: CardSearchParams = {}): Promise<CardListResponse> {
    const {
      limit = 20,
      offset = 0,
      sort = 'name',
      order = 'asc',
      noAnnualFee,
      creditRequired,
      country,
    } = params;

    let query: FirebaseFirestore.Query = this.collection;
    let countQuery: FirebaseFirestore.Query = this.collection;

    // Apply filters
    if (noAnnualFee === true) {
      query = query.where('annualFee', '==', 0);
      countQuery = countQuery.where('annualFee', '==', 0);
    }

    if (creditRequired) {
      query = query.where('creditRequired', '==', creditRequired);
      countQuery = countQuery.where('creditRequired', '==', creditRequired);
    }

    if (country) {
      query = query.where('countryCode', '==', country);
      countQuery = countQuery.where('countryCode', '==', country);
    }

    // Apply sorting
    const sortField = this.getSortField(sort);
    query = query.orderBy(sortField, order);

    // Get total count with filters applied
    const totalSnapshot = await countQuery.count().get();
    const total = totalSnapshot.data().count;

    // Apply pagination
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (offsetSnapshot.docs.length > 0) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit);

    const snapshot = await query.get();
    const cards = snapshot.docs.map(doc => doc.data() as CreditCard);

    return {
      data: cards,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + cards.length < total,
      },
    };
  }

  async searchCards(searchQuery: string, limit = 20): Promise<CreditCard[]> {
    // Normalize search query
    const normalizedQuery = searchQuery.toLowerCase().trim();
    const searchTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

    if (searchTerms.length === 0) {
      const result = await this.getCards({ limit });
      return result.data;
    }

    // Use array-contains-any for searchTerms (limited to 10 values)
    const query = this.collection
      .where('searchTerms', 'array-contains-any', searchTerms.slice(0, 10))
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as CreditCard);
  }

  async deleteAllCards(): Promise<void> {
    const snapshot = await this.collection.get();
    const batchSize = 500;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        batch.delete(doc.ref);
      }

      await batch.commit();
    }

    console.log(`🗑️ Deleted ${snapshot.docs.length} cards`);
  }

  async getCardCount(): Promise<number> {
    const snapshot = await this.collection.count().get();
    return snapshot.data().count;
  }

  private getSortField(sort: string): string {
    switch (sort) {
      case 'rating':
        return 'ratings.overall';
      case 'annualFee':
        return 'annualFee';
      case 'name':
      default:
        return 'name';
    }
  }
}
