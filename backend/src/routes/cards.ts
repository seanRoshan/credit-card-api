import { Router, Request, Response } from 'express';
import { CardService } from '../services/cardService';
import { scraperService } from '../services/scraperService';
import { CardSearchParams, CreditCard } from '../types/creditCard';

const router = Router();
const cardService = new CardService();

/**
 * Check if any card in the results is an exact match for the query
 */
function hasExactMatch(cards: CreditCard[], query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  return cards.some(
    (card) => card.name.toLowerCase().trim() === normalizedQuery
  );
}

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
    };

    const result = await cardService.getCards(params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// GET /api/cards/search - Search cards with auto-scrape fallback
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const autoScrape = req.query.autoScrape !== 'false'; // Default: enabled

    if (!query.trim()) {
      const result = await cardService.getCards({ limit });
      return res.json({ data: result.data, source: 'database' });
    }

    // Search existing database first
    const cards = await cardService.searchCards(query, limit);

    // If exact match found, return immediately
    if (cards.length > 0 && hasExactMatch(cards, query)) {
      return res.json({ data: cards, source: 'database' });
    }

    // No exact match - trigger scraper search if enabled and query is meaningful
    if (autoScrape && query.trim().length >= 3) {
      try {
        const wallethubResults = await scraperService.searchWalletHub(query, 5);

        return res.json({
          data: cards,
          scraperResults: wallethubResults,
          source: cards.length > 0 ? 'database+scraper' : 'scraper',
        });
      } catch (scraperError) {
        // Log but don't fail if scraper is unavailable
        console.warn('Scraper search failed:', scraperError);
        return res.json({ data: cards, source: 'database' });
      }
    }

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

export default router;
