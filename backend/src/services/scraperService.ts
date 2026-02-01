import axios, { AxiosInstance } from 'axios';
import { CreditCard } from '../types/creditCard';

interface ScraperSearchResponse {
  success: boolean;
  data?: {
    existingCards: CreditCard[];
    wallethubResults: WalletHubSearchResult[];
  };
  error?: string;
  timestamp: string;
}

interface WalletHubSearchResult {
  name: string;
  url: string;
  imageUrl: string | null;
  annualFeeText: string;
  rating: number | null;
}

interface ScrapeCardResponse {
  success: boolean;
  data?: {
    card: CreditCard;
    isNew: boolean;
    imageUploaded: boolean;
  };
  error?: string;
  timestamp: string;
}

interface UpdateCardResponse {
  success: boolean;
  data?: {
    card: CreditCard;
    changes: string[];
  };
  error?: string;
  timestamp: string;
}

/**
 * Service for communicating with the Scraper Firebase Function
 */
export class ScraperService {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    // Get scraper URL from environment (will be set in production)
    const scraperUrl = process.env.SCRAPER_URL || 'http://localhost:8002';
    this.apiKey = process.env.SCRAPER_API_KEY || 'dev-scraper-key-change-in-production';

    this.client = axios.create({
      baseURL: scraperUrl,
      timeout: 60000, // 60 seconds for scraping operations
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });
  }

  /**
   * Search WalletHub for credit cards
   */
  async searchWalletHub(
    query: string,
    limit = 10
  ): Promise<WalletHubSearchResult[]> {
    try {
      const response = await this.client.get<ScraperSearchResponse>(
        '/v1/scrape/search',
        {
          params: { q: query, limit },
        }
      );

      if (response.data.success && response.data.data) {
        return response.data.data.wallethubResults;
      }

      return [];
    } catch (error) {
      console.error('Error searching WalletHub:', error);
      return [];
    }
  }

  /**
   * Scrape a single card from WalletHub URL
   */
  async scrapeCard(url: string, forceUpdate = false): Promise<CreditCard | null> {
    try {
      const response = await this.client.post<ScrapeCardResponse>(
        '/v1/scrape/card',
        { url, forceUpdate }
      );

      if (response.data.success && response.data.data) {
        return response.data.data.card;
      }

      return null;
    } catch (error) {
      console.error('Error scraping card:', error);
      return null;
    }
  }

  /**
   * Scrape a card by its slug
   */
  async scrapeBySlug(
    slug: string,
    forceUpdate = false
  ): Promise<CreditCard | null> {
    try {
      const response = await this.client.get<ScrapeCardResponse>(
        `/v1/scrape/card/${slug}`,
        {
          params: { forceUpdate: forceUpdate.toString() },
        }
      );

      if (response.data.success && response.data.data) {
        return response.data.data.card;
      }

      return null;
    } catch (error) {
      console.error('Error scraping card by slug:', error);
      return null;
    }
  }

  /**
   * Refresh/update an existing card
   */
  async refreshCard(cardId: string): Promise<{
    card: CreditCard;
    changes: string[];
  } | null> {
    try {
      const response = await this.client.post<UpdateCardResponse>(
        `/v1/scrape/update/${cardId}`
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing card:', error);
      return null;
    }
  }

  /**
   * Check if scraper service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/health', { timeout: 5000 });
      return response.data?.success === true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const scraperService = new ScraperService();
