import { Router, Request, Response } from 'express';
import { requireApiKeyWithRateLimit } from '../middlewares/apiKey';
import { CardService } from '../services/cardService';

const router = Router();
const cardService = new CardService();

// Apply API key auth + rate limiting to all routes
router.use(requireApiKeyWithRateLimit);

/**
 * GET /api/v1/cards/:slug
 * Get card details by slug
 */
router.get('/cards/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    const card = await cardService.getCardBySlug(slug);

    if (!card) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No card found with slug: ${slug}`,
      });
    }

    res.json({ data: card });
  } catch (error) {
    console.error('Error fetching card by slug:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

/**
 * GET /api/v1/cards/:slug/image
 * Get card image URL by slug
 * Returns the image URL or redirects to it
 */
router.get('/cards/:slug/image', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const redirect = req.query.redirect === 'true';

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    const card = await cardService.getCardBySlug(slug);

    if (!card) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No card found with slug: ${slug}`,
      });
    }

    if (!card.imageUrl) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Card "${card.name}" does not have an image`,
      });
    }

    if (redirect) {
      // Redirect to the actual image URL
      return res.redirect(302, card.imageUrl);
    }

    // Return JSON with image details
    res.json({
      data: {
        slug: card.slug,
        name: card.name,
        imageUrl: card.imageUrl,
        imageFilename: card.imageFilename,
      },
    });
  } catch (error) {
    console.error('Error fetching card image:', error);
    res.status(500).json({ error: 'Failed to fetch card image' });
  }
});

/**
 * GET /api/v1/cards
 * List cards with pagination (limited fields for performance)
 */
router.get('/cards', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await cardService.getCards({ limit, offset });

    // Return only essential fields for listing
    const simplifiedCards = result.data.map(card => ({
      id: card.id,
      name: card.name,
      slug: card.slug,
      imageUrl: card.imageUrl,
      annualFee: card.annualFee,
    }));

    res.json({
      data: simplifiedCards,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error listing cards:', error);
    res.status(500).json({ error: 'Failed to list cards' });
  }
});

export default router;
