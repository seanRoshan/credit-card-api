import { Router, Request, Response } from 'express';
import { CardService } from '../services/cardService';
import { scraperService } from '../services/scraperService';
import { bucket } from '../config/firebase';
import { CardSearchParams, CreditCard } from '../types/creditCard';
import { requireAdminAuth } from '../middlewares/auth';
import { Timestamp } from 'firebase-admin/firestore';

const router = Router();
const cardService = new CardService();

// GET /api/cards - List cards with pagination and filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const params: CardSearchParams = {
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
      offset: parseInt(req.query.offset as string) || 0,
      sort: (req.query.sort as 'name' | 'annualFee' | 'rating') || 'name',
      order: (req.query.order as 'asc' | 'desc') || 'asc',
      noAnnualFee: req.query.noAnnualFee === 'true',
      creditRequired: req.query.creditRequired as string,
      country: req.query.country as 'US' | 'CA' | undefined,
    };

    const result = await cardService.getCards(params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// GET /api/cards/search - Search cards in local database only
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!query.trim()) {
      const result = await cardService.getCards({ limit });
      return res.json({ data: result.data, source: 'database' });
    }

    // Search local database only - admin will manually trigger scrapes
    const cards = await cardService.searchCards(query, limit);

    res.json({ data: cards, source: 'database' });
  } catch (error) {
    console.error('Error searching cards:', error);
    res.status(500).json({ error: 'Failed to search cards' });
  }
});

// GET /api/cards/:id - Get single card
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const card = await cardService.getCardById(id);

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ data: card });
  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

// POST /api/cards/:id/refresh - Refresh card data from WalletHub
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify card exists
    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Call scraper to refresh
    const result = await scraperService.refreshCard(id);

    if (!result) {
      return res.status(502).json({
        error: 'Failed to refresh card from WalletHub',
        message: 'Scraper service unavailable or card not found on WalletHub',
      });
    }

    res.json({
      data: result.card,
      changes: result.changes,
      message:
        result.changes.length > 0
          ? `Updated ${result.changes.length} field(s)`
          : 'No changes detected',
    });
  } catch (error) {
    console.error('Error refreshing card:', error);
    res.status(500).json({ error: 'Failed to refresh card' });
  }
});

// POST /api/cards/scrape - Scrape a card from WalletHub URL
router.post('/scrape', async (req: Request, res: Response) => {
  try {
    const { url, forceUpdate } = req.body;

    if (!url || !url.includes('wallethub.com')) {
      return res.status(400).json({ error: 'Valid WalletHub URL is required' });
    }

    const card = await scraperService.scrapeCard(url, forceUpdate || false);

    if (!card) {
      return res.status(502).json({
        error: 'Failed to scrape card',
        message: 'Could not extract card data from the provided URL',
      });
    }

    res.status(201).json({ data: card });
  } catch (error) {
    console.error('Error scraping card:', error);
    res.status(500).json({ error: 'Failed to scrape card' });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * Generate a URL-friendly slug from card name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate search terms from card name
 */
function generateSearchTerms(name: string): string[] {
  const normalized = name.toLowerCase().trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 0);

  // Include individual words and some combinations
  const terms = new Set<string>();
  words.forEach(word => terms.add(word));

  // Add the full name normalized
  terms.add(normalized.replace(/\s+/g, ' '));

  // Add partial combinations (for 2+ word names)
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      terms.add(words.slice(i, i + 2).join(' '));
    }
  }

  return Array.from(terms);
}

/**
 * Upload image from base64 string to Firebase Storage
 */
async function uploadImageFromBase64(
  base64Data: string,
  filename: string
): Promise<string> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');

  const storagePath = `credit-cards/images/${filename}`;
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      cacheControl: 'public, max-age=31536000',
      contentType: 'image/png', // Default to PNG, could be detected
    },
  });

  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

/**
 * Delete image from Firebase Storage
 */
async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('storage.googleapis.com')) {
    return;
  }

  try {
    // Extract path from URL
    const urlParts = imageUrl.split('/');
    const bucketIndex = urlParts.findIndex(p => p === bucket.name);
    if (bucketIndex !== -1) {
      const storagePath = urlParts.slice(bucketIndex + 1).join('/');
      const file = bucket.file(storagePath);
      await file.delete();
    }
  } catch (error) {
    console.warn('Failed to delete image from storage:', error);
  }
}

// POST /api/admin/cards - Create a new card (admin only)
router.post('/admin/cards', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const cardData = req.body;

    // Validate required fields
    if (!cardData.name) {
      return res.status(400).json({ error: 'Card name is required' });
    }

    // Generate slug if not provided
    const slug = cardData.slug || generateSlug(cardData.name);

    // Generate search terms
    const searchTerms = generateSearchTerms(cardData.name);

    // Handle image upload if base64 provided
    let imageUrl = cardData.imageUrl || '';
    let imageFilename = cardData.imageFilename || '';

    if (cardData.imageBase64) {
      const filename = `${slug}-${Date.now()}.png`;
      imageUrl = await uploadImageFromBase64(cardData.imageBase64, filename);
      imageFilename = filename;
    }

    // Build card object with defaults
    const card: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt'> = {
      name: cardData.name,
      slug,
      annualFee: cardData.annualFee ?? 0,
      annualFeeText: cardData.annualFeeText || (cardData.annualFee === 0 ? '$0' : `$${cardData.annualFee}`),
      apr: {
        introApr: cardData.apr?.introApr ?? null,
        regularApr: cardData.apr?.regularApr ?? 'Variable',
      },
      rewards: {
        rate: cardData.rewards?.rate ?? null,
        bonus: cardData.rewards?.bonus ?? null,
        type: cardData.rewards?.type ?? null,
      },
      ratings: {
        overall: cardData.ratings?.overall ?? null,
        fees: cardData.ratings?.fees ?? null,
        rewards: cardData.ratings?.rewards ?? null,
        cost: cardData.ratings?.cost ?? null,
      },
      pros: cardData.pros || [],
      cons: cardData.cons || [],
      creditRequired: cardData.creditRequired || 'Not specified',
      country: cardData.country || 'USA',
      countryCode: cardData.countryCode || 'US',
      currency: cardData.currency || 'USD',
      currencySymbol: cardData.currencySymbol || '$',
      imageUrl,
      imageFilename,
      searchTerms,
    };

    const cardId = await cardService.createCard(card);
    const createdCard = await cardService.getCardById(cardId);

    res.status(201).json({
      data: createdCard,
      message: 'Card created successfully',
    });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// PUT /api/admin/cards/:id - Update a card (admin only)
router.put('/admin/cards/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Verify card exists
    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Handle image upload if base64 provided
    if (updates.imageBase64) {
      const slug = updates.slug || existingCard.slug;
      const filename = `${slug}-${Date.now()}.png`;
      updates.imageUrl = await uploadImageFromBase64(updates.imageBase64, filename);
      updates.imageFilename = filename;
      delete updates.imageBase64;
    }

    // Update search terms if name changed
    if (updates.name && updates.name !== existingCard.name) {
      updates.searchTerms = generateSearchTerms(updates.name);
      // Update slug if not explicitly provided
      if (!updates.slug) {
        updates.slug = generateSlug(updates.name);
      }
    }

    // Merge updates with existing card data
    const updatedData = {
      ...existingCard,
      ...updates,
      // Handle nested objects
      apr: { ...existingCard.apr, ...(updates.apr || {}) },
      rewards: { ...existingCard.rewards, ...(updates.rewards || {}) },
      ratings: { ...existingCard.ratings, ...(updates.ratings || {}) },
      updatedAt: Timestamp.now(),
    };

    // Remove id, createdAt from updates (these shouldn't change)
    delete updatedData.id;
    delete updatedData.createdAt;

    await cardService.createCardWithId(id, updatedData);
    const updatedCard = await cardService.getCardById(id);

    res.json({
      data: updatedCard,
      message: 'Card updated successfully',
    });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE /api/admin/cards/:id - Delete a card (admin only)
router.delete('/admin/cards/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify card exists and get image URL
    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Delete image from storage if exists
    if (existingCard.imageUrl) {
      await deleteImageFromStorage(existingCard.imageUrl);
    }

    // Delete card from Firestore
    const { db } = require('../config/firebase');
    await db.collection('credit_cards').doc(id).delete();

    res.json({
      message: 'Card deleted successfully',
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// POST /api/admin/cards/:id/upload-image - Upload card image (admin only)
router.post('/admin/cards/:id/upload-image', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { imageBase64, imageUrl: providedUrl } = req.body;

    // Verify card exists
    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    let newImageUrl: string;
    let newImageFilename: string;

    if (imageBase64) {
      // Upload from base64
      const filename = `${existingCard.slug}-${Date.now()}.png`;
      newImageUrl = await uploadImageFromBase64(imageBase64, filename);
      newImageFilename = filename;
    } else if (providedUrl) {
      // Use provided URL directly
      newImageUrl = providedUrl;
      newImageFilename = providedUrl.split('/').pop() || '';
    } else {
      return res.status(400).json({
        error: 'Either imageBase64 or imageUrl is required'
      });
    }

    // Delete old image if exists
    if (existingCard.imageUrl) {
      await deleteImageFromStorage(existingCard.imageUrl);
    }

    // Update card with new image
    const { db } = require('../config/firebase');
    await db.collection('credit_cards').doc(id).update({
      imageUrl: newImageUrl,
      imageFilename: newImageFilename,
      updatedAt: Timestamp.now(),
    });

    const updatedCard = await cardService.getCardById(id);

    res.json({
      data: updatedCard,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading card image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;
