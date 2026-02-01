import { Router, Request, Response } from 'express';
import { CardService } from '../services/cardService';
import { CardSearchParams } from '../types/creditCard';

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
    };

    const result = await cardService.getCards(params);
    res.json(result);
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Failed to fetch cards' });
  }
});

// GET /api/cards/search - Search cards
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!query.trim()) {
      const result = await cardService.getCards({ limit });
      return res.json({ data: result.data });
    }

    const cards = await cardService.searchCards(query, limit);
    res.json({ data: cards });
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

export default router;
