import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middlewares/auth';
import { generateApiKey, hashApiKey } from '../middlewares/apiKey';
import { scraperService } from '../services/scraperService';
import { CardService } from '../services/cardService';
import { bucket, db } from '../config/firebase';
import { CreditCard } from '../types/creditCard';
import { Timestamp } from 'firebase-admin/firestore';

const router = Router();
const cardService = new CardService();

// Apply admin auth to all routes in this router
router.use(requireAdminAuth);

// ==================== HELPER FUNCTIONS ====================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateSearchTerms(name: string): string[] {
  const normalized = name.toLowerCase().trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  const terms = new Set<string>();
  words.forEach(word => terms.add(word));
  terms.add(normalized.replace(/\s+/g, ' '));
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      terms.add(words.slice(i, i + 2).join(' '));
    }
  }
  return Array.from(terms);
}

async function uploadImageFromBase64(base64Data: string, filename: string): Promise<string> {
  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  const storagePath = `credit-cards/images/${filename}`;
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: { cacheControl: 'public, max-age=31536000', contentType: 'image/png' },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('storage.googleapis.com')) return;
  try {
    const urlParts = imageUrl.split('/');
    const bucketIndex = urlParts.findIndex(p => p === bucket.name);
    if (bucketIndex !== -1) {
      const storagePath = urlParts.slice(bucketIndex + 1).join('/');
      await bucket.file(storagePath).delete();
    }
  } catch (error) {
    console.warn('Failed to delete image from storage:', error);
  }
}

// ==================== CARD CRUD ENDPOINTS ====================

// POST /api/admin/cards - Create a new card
router.post('/cards', async (req: Request, res: Response) => {
  try {
    const cardData = req.body;
    if (!cardData.name) {
      return res.status(400).json({ error: 'Card name is required' });
    }

    const slug = cardData.slug || generateSlug(cardData.name);
    const searchTerms = generateSearchTerms(cardData.name);

    let imageUrl = cardData.imageUrl || '';
    let imageFilename = cardData.imageFilename || '';

    if (cardData.imageBase64 || cardData.imageData) {
      const base64 = cardData.imageBase64 || cardData.imageData;
      const filename = `${slug}-${Date.now()}.png`;
      imageUrl = await uploadImageFromBase64(base64, filename);
      imageFilename = filename;
    }

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

    res.status(201).json({ data: createdCard, message: 'Card created successfully' });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// PUT /api/admin/cards/:id - Update a card
router.put('/cards/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (updates.imageBase64 || updates.imageData) {
      const base64 = updates.imageBase64 || updates.imageData;
      const slug = updates.slug || existingCard.slug;
      const filename = `${slug}-${Date.now()}.png`;
      updates.imageUrl = await uploadImageFromBase64(base64, filename);
      updates.imageFilename = filename;
      delete updates.imageBase64;
      delete updates.imageData;
    }

    if (updates.name && updates.name !== existingCard.name) {
      updates.searchTerms = generateSearchTerms(updates.name);
      if (!updates.slug) updates.slug = generateSlug(updates.name);
    }

    const updatedData = {
      ...existingCard,
      ...updates,
      apr: { ...existingCard.apr, ...(updates.apr || {}) },
      rewards: { ...existingCard.rewards, ...(updates.rewards || {}) },
      ratings: { ...existingCard.ratings, ...(updates.ratings || {}) },
      updatedAt: Timestamp.now(),
    };

    delete updatedData.id;
    delete updatedData.createdAt;

    await cardService.createCardWithId(id, updatedData);
    const updatedCard = await cardService.getCardById(id);

    res.json({ data: updatedCard, message: 'Card updated successfully' });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE /api/admin/cards/:id - Delete a card
router.delete('/cards/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (existingCard.imageUrl) {
      await deleteImageFromStorage(existingCard.imageUrl);
    }

    await db.collection('credit_cards').doc(id).delete();

    res.json({ message: 'Card deleted successfully', deletedId: id });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

// POST /api/admin/cards/:id/refresh - Refresh card from WalletHub
router.post('/cards/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingCard = await cardService.getCardById(id);
    if (!existingCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const result = await scraperService.refreshCard(id);
    if (!result) {
      return res.status(502).json({
        error: 'Refresh failed',
        message: 'Could not refresh card data from WalletHub',
      });
    }

    res.json({
      data: result.card,
      changes: result.changes,
      message: result.changes.length > 0
        ? `Updated ${result.changes.length} field(s): ${result.changes.join(', ')}`
        : 'No changes detected',
    });
  } catch (error) {
    console.error('Error refreshing card:', error);
    res.status(500).json({ error: 'Failed to refresh card' });
  }
});

// ==================== SCRAPER INTEGRATION ENDPOINTS ====================

// GET /api/admin/scraper/search - Search WalletHub via scraper
router.get('/scraper/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (!query.trim()) {
      return res.status(400).json({
        error: 'Search query is required',
        message: 'Provide a search query via the q parameter',
      });
    }

    if (query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query too short',
        message: 'Search query must be at least 2 characters',
      });
    }

    // Check if scraper is available
    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const results = await scraperService.searchWalletHub(query, limit);

    res.json({
      data: results,
      query,
      count: results.length,
      message: results.length > 0
        ? `Found ${results.length} result(s) from WalletHub`
        : 'No results found on WalletHub',
    });
  } catch (error) {
    console.error('Error searching WalletHub:', error);
    res.status(500).json({ error: 'Failed to search WalletHub' });
  }
});

// POST /api/admin/scraper/import - Import card from WalletHub URL
router.post('/scraper/import', async (req: Request, res: Response) => {
  try {
    const { url, forceUpdate = false } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Provide a WalletHub card URL to import',
      });
    }

    if (!url.includes('wallethub.com')) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'URL must be a WalletHub credit card page',
      });
    }

    // Check if scraper is available
    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const card = await scraperService.scrapeCard(url, forceUpdate);

    if (!card) {
      return res.status(502).json({
        error: 'Import failed',
        message: 'Could not extract card data from the provided URL. The page structure may have changed.',
      });
    }

    res.status(201).json({
      data: card,
      message: 'Card imported successfully from WalletHub',
    });
  } catch (error) {
    console.error('Error importing card from WalletHub:', error);
    res.status(500).json({ error: 'Failed to import card' });
  }
});

// GET /api/admin/scraper/health - Check scraper service health
router.get('/scraper/health', async (req: Request, res: Response) => {
  try {
    const isAvailable = await scraperService.isAvailable();

    res.json({
      status: isAvailable ? 'healthy' : 'unavailable',
      scraperUrl: process.env.SCRAPER_URL || 'http://localhost:8002',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking scraper health:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to check scraper health',
    });
  }
});

// POST /api/admin/scraper/refresh/:id - Refresh an existing card from WalletHub
router.post('/scraper/refresh/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Card ID is required',
      });
    }

    // Check if scraper is available
    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const result = await scraperService.refreshCard(id);

    if (!result) {
      return res.status(502).json({
        error: 'Refresh failed',
        message: 'Could not refresh card data from WalletHub',
      });
    }

    res.json({
      data: result.card,
      changes: result.changes,
      message: result.changes.length > 0
        ? `Updated ${result.changes.length} field(s): ${result.changes.join(', ')}`
        : 'No changes detected',
    });
  } catch (error) {
    console.error('Error refreshing card:', error);
    res.status(500).json({ error: 'Failed to refresh card' });
  }
});

// POST /api/admin/scraper/import-by-slug - Import card by slug
router.post('/scraper/import-by-slug', async (req: Request, res: Response) => {
  try {
    const { slug, forceUpdate = false } = req.body;

    if (!slug) {
      return res.status(400).json({
        error: 'Slug is required',
        message: 'Provide a card slug to import',
      });
    }

    // Check if scraper is available
    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const card = await scraperService.scrapeBySlug(slug, forceUpdate);

    if (!card) {
      return res.status(502).json({
        error: 'Import failed',
        message: `Could not find or import card with slug: ${slug}`,
      });
    }

    res.status(201).json({
      data: card,
      message: 'Card imported successfully from WalletHub',
    });
  } catch (error) {
    console.error('Error importing card by slug:', error);
    res.status(500).json({ error: 'Failed to import card' });
  }
});

// ==================== RATEHUB (CANADA) SCRAPER ENDPOINTS ====================
// Note: RateHub uses blog-style category pages. No search feature available.

// POST /api/admin/scraper/ratehub/import - Import card(s) from RateHub URL
router.post('/scraper/ratehub/import', async (req: Request, res: Response) => {
  try {
    const { url, forceUpdate = false } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Provide a RateHub card URL to import',
      });
    }

    if (!url.includes('ratehub.ca')) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'URL must be a RateHub credit card page',
      });
    }

    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const card = await scraperService.scrapeRateHubCard(url, forceUpdate);

    if (!card) {
      return res.status(502).json({
        error: 'Import failed',
        message: 'Could not extract card data from the provided URL. The page structure may have changed.',
      });
    }

    res.status(201).json({
      data: card,
      message: 'Card imported successfully from RateHub',
    });
  } catch (error) {
    console.error('Error importing card from RateHub:', error);
    res.status(500).json({ error: 'Failed to import card' });
  }
});

// POST /api/admin/scraper/ratehub/bulk - Bulk import from RateHub category
router.post('/scraper/ratehub/bulk', async (req: Request, res: Response) => {
  try {
    const { categoryUrl, limit = 50, skipExisting = true } = req.body;

    if (!categoryUrl) {
      return res.status(400).json({
        error: 'Category URL is required',
        message: 'Provide a RateHub category URL to bulk import',
      });
    }

    if (!categoryUrl.includes('ratehub.ca')) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'URL must be a RateHub category page',
      });
    }

    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const result = await scraperService.bulkScrapeRateHub(categoryUrl, limit, skipExisting);

    if (!result) {
      return res.status(502).json({
        error: 'Bulk import failed',
        message: 'Could not import cards from the category page.',
      });
    }

    res.json({
      data: result,
      message: `Imported ${result.scraped} cards, skipped ${result.skipped}, failed ${result.failed}`,
    });
  } catch (error) {
    console.error('Error bulk importing from RateHub:', error);
    res.status(500).json({ error: 'Failed to bulk import' });
  }
});

// GET /api/admin/scraper/ratehub/categories - Get all RateHub category URLs
router.get('/scraper/ratehub/categories', async (req: Request, res: Response) => {
  try {
    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const categories = await scraperService.getRateHubCategories();

    if (!categories) {
      return res.status(502).json({
        error: 'Failed to get categories',
        message: 'Could not retrieve RateHub category list.',
      });
    }

    res.json({
      data: categories,
      count: Object.keys(categories).length,
    });
  } catch (error) {
    console.error('Error getting RateHub categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// POST /api/admin/scraper/ratehub/import-all - Import all cards from all RateHub categories
router.post('/scraper/ratehub/import-all', async (req: Request, res: Response) => {
  try {
    const { limitPerCategory = 30, skipExisting = true } = req.body;

    const isAvailable = await scraperService.isAvailable();
    if (!isAvailable) {
      return res.status(503).json({
        error: 'Scraper service unavailable',
        message: 'The scraper service is not responding. Please try again later.',
      });
    }

    const result = await scraperService.importAllRateHub(limitPerCategory, skipExisting);

    if (!result) {
      return res.status(502).json({
        error: 'Import all failed',
        message: 'Could not complete the full import from RateHub.',
      });
    }

    res.json({
      data: result,
      message: `Total: ${result.totalScraped} imported, ${result.totalSkipped} skipped, ${result.totalFailed} failed`,
    });
  } catch (error) {
    console.error('Error importing all from RateHub:', error);
    res.status(500).json({ error: 'Failed to import all' });
  }
});

// ==================== API KEY MANAGEMENT ENDPOINTS ====================

// POST /api/admin/api-keys - Create a new API key
router.post('/api-keys', async (req: Request, res: Response) => {
  try {
    const { name, rateLimit = 60 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const hashedKey = hashApiKey(apiKey);

    // Store hashed key in Firestore
    await db.collection('api_keys').doc(hashedKey).set({
      name,
      rateLimit,
      active: true,
      createdAt: Timestamp.now(),
      createdBy: req.user?.email || 'admin',
      lastUsedAt: null,
      usageCount: 0,
    });

    // Return the plain key (only shown once!)
    res.status(201).json({
      message: 'API key created successfully',
      data: {
        key: apiKey,
        name,
        rateLimit,
      },
      warning: 'Save this key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET /api/admin/api-keys - List all API keys (without revealing the actual keys)
router.get('/api-keys', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('api_keys').get();

    const keys = snapshot.docs.map(doc => ({
      id: doc.id.substring(0, 8) + '...', // Show partial hash for identification
      name: doc.data().name,
      rateLimit: doc.data().rateLimit,
      active: doc.data().active,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      createdBy: doc.data().createdBy,
      lastUsedAt: doc.data().lastUsedAt?.toDate?.() || doc.data().lastUsedAt,
      usageCount: doc.data().usageCount || 0,
    }));

    res.json({ data: keys });
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api/admin/api-keys/:keyPrefix - Revoke an API key by partial hash
router.delete('/api-keys/:keyPrefix', async (req: Request, res: Response) => {
  try {
    const { keyPrefix } = req.params;

    if (!keyPrefix || keyPrefix.length < 8) {
      return res.status(400).json({ error: 'Key prefix must be at least 8 characters' });
    }

    // Find the key by prefix
    const snapshot = await db.collection('api_keys').get();
    const matchingDoc = snapshot.docs.find(doc => doc.id.startsWith(keyPrefix));

    if (!matchingDoc) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Soft delete by setting active to false
    await db.collection('api_keys').doc(matchingDoc.id).update({
      active: false,
      revokedAt: Timestamp.now(),
      revokedBy: req.user?.email || 'admin',
    });

    res.json({
      message: 'API key revoked successfully',
      name: matchingDoc.data().name,
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
