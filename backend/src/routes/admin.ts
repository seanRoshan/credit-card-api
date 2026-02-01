import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middlewares/auth';
import { scraperService } from '../services/scraperService';

const router = Router();

// Apply admin auth to all routes in this router
router.use(requireAdminAuth);

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

export default router;
