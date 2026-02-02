import type { CreditCard, CardListResponse, CardSearchResponse } from '../types/creditCard';

const API_BASE = '/api';

// Admin operation types
export interface WalletHubResult {
  name: string;
  url: string;
  imageUrl: string | null;
}

export interface RateHubCategory {
  key: string;
  name: string;
  url: string;
}

export type ImportSource = 'wallethub' | 'ratehub';

export interface CardFormData {
  name: string;
  slug?: string;
  annualFee: number;
  annualFeeText?: string;
  apr: {
    introApr: string | null;
    regularApr: string;
  };
  rewards: {
    rate: string | null;
    bonus: string | null;
    type: 'cashback' | 'points' | 'miles' | null;
  };
  ratings: {
    overall: number | null;
  };
  pros: string[];
  cons: string[];
  creditRequired: string;
}

export interface GetCardsParams {
  limit?: number;
  offset?: number;
  sort?: 'name' | 'annualFee' | 'rating';
  order?: 'asc' | 'desc';
  noAnnualFee?: boolean;
  creditRequired?: string;
  country?: 'US' | 'CA';
}

// Helper function to create headers with auth token
function getAuthHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export const cardApi = {
  async getCards(params: GetCardsParams = {}): Promise<CardListResponse> {
    const searchParams = new URLSearchParams();

    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.order) searchParams.set('order', params.order);
    if (params.noAnnualFee) searchParams.set('noAnnualFee', 'true');
    if (params.creditRequired) searchParams.set('creditRequired', params.creditRequired);
    if (params.country) searchParams.set('country', params.country);

    const response = await fetch(`${API_BASE}/cards?${searchParams}`);
    if (!response.ok) {
      throw new Error('Failed to fetch cards');
    }
    return response.json();
  },

  async getCard(id: string): Promise<{ data: CreditCard }> {
    const response = await fetch(`${API_BASE}/cards/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch card');
    }
    return response.json();
  },

  async searchCards(query: string, limit = 20): Promise<CardSearchResponse> {
    const searchParams = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    const response = await fetch(`${API_BASE}/cards/search?${searchParams}`);
    if (!response.ok) {
      throw new Error('Failed to search cards');
    }
    return response.json();
  },

  // Admin - Card CRUD
  async createCard(card: Partial<CreditCard>, token: string): Promise<{ data: CreditCard }> {
    const response = await fetch(`${API_BASE}/admin/cards`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(card),
    });
    if (!response.ok) {
      throw new Error('Failed to create card');
    }
    return response.json();
  },

  async updateCard(id: string, card: Partial<CreditCard>, token: string): Promise<{ data: CreditCard }> {
    const response = await fetch(`${API_BASE}/admin/cards/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(card),
    });
    if (!response.ok) {
      throw new Error('Failed to update card');
    }
    return response.json();
  },

  async deleteCard(id: string, token: string): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/cards/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to delete card');
    }
  },

  // Admin - Image upload
  async uploadCardImage(id: string, file: File, token: string): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/admin/cards/${id}/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Failed to upload card image');
    }
    return response.json();
  },

  // Admin - Scraper
  async searchWalletHub(query: string, token: string): Promise<{ results: WalletHubResult[] }> {
    const searchParams = new URLSearchParams({ q: query });
    const response = await fetch(`${API_BASE}/admin/scraper/search?${searchParams}`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to search WalletHub');
    }
    return response.json();
  },

  async importFromWalletHub(url: string, token: string): Promise<{ data: CreditCard }> {
    const response = await fetch(`${API_BASE}/admin/scraper/import`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      throw new Error('Failed to import from WalletHub');
    }
    return response.json();
  },

  // Admin - RateHub Canada scraper (category-based, no search)
  async importFromRateHub(url: string, token: string): Promise<{ data: CreditCard }> {
    const response = await fetch(`${API_BASE}/admin/scraper/ratehub/import`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      throw new Error('Failed to import from RateHub');
    }
    return response.json();
  },

  async bulkImportFromRateHub(categoryUrl: string, limit: number, skipExisting: boolean, token: string): Promise<{
    data: { scraped: number; skipped: number; failed: number; cards: CreditCard[] };
    message: string;
  }> {
    const response = await fetch(`${API_BASE}/admin/scraper/ratehub/bulk`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ categoryUrl, limit, skipExisting }),
    });
    if (!response.ok) {
      throw new Error('Failed to bulk import from RateHub');
    }
    return response.json();
  },

  async getRateHubCategories(token: string): Promise<{
    data: RateHubCategory[];
    count: number;
  }> {
    const response = await fetch(`${API_BASE}/admin/scraper/ratehub/categories`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to get RateHub categories');
    }
    return response.json();
  },

  async importAllFromRateHub(limitPerCategory: number, skipExisting: boolean, token: string): Promise<{
    data: {
      totalScraped: number;
      totalSkipped: number;
      totalFailed: number;
      cards: CreditCard[];
    };
    message: string;
  }> {
    const response = await fetch(`${API_BASE}/admin/scraper/ratehub/import-all`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ limitPerCategory, skipExisting }),
    });
    if (!response.ok) {
      throw new Error('Failed to import all from RateHub');
    }
    return response.json();
  },

  // Admin - Refresh card
  async refreshCard(id: string, token: string): Promise<{ data: CreditCard; changes: string[] }> {
    const response = await fetch(`${API_BASE}/admin/cards/${id}/refresh`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to refresh card');
    }
    return response.json();
  },

  // Admin - API Key Management
  async createApiKey(name: string, rateLimit: number, token: string): Promise<{
    message: string;
    data: { key: string; name: string; rateLimit: number };
    warning: string;
  }> {
    const response = await fetch(`${API_BASE}/admin/api-keys`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ name, rateLimit }),
    });
    if (!response.ok) {
      throw new Error('Failed to create API key');
    }
    return response.json();
  },

  async listApiKeys(token: string): Promise<{
    data: Array<{
      id: string;
      name: string;
      rateLimit: number;
      active: boolean;
      createdAt: string;
      createdBy: string;
      lastUsedAt: string | null;
      usageCount: number;
    }>;
  }> {
    const response = await fetch(`${API_BASE}/admin/api-keys`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to list API keys');
    }
    return response.json();
  },

  async revokeApiKey(keyPrefix: string, token: string): Promise<{ message: string; name: string }> {
    const response = await fetch(`${API_BASE}/admin/api-keys/${keyPrefix}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to revoke API key');
    }
    return response.json();
  },
};

// Admin form data interface (matches CardForm component)
interface AdminCardFormData {
  name: string;
  slug: string;
  annualFee: number;
  introApr: string;
  regularApr: string;
  rewardsRate: string;
  rewardsBonus: string;
  rewardsType: 'cashback' | 'points' | 'miles' | '';
  overallRating: number;
  creditRequired: 'Excellent' | 'Good' | 'Fair' | 'Poor' | '';
  pros: string;
  cons: string;
  imageData: string | null;
}

// Transform form data to API format
function transformFormData(data: AdminCardFormData): Partial<CreditCard> {
  return {
    name: data.name,
    slug: data.slug,
    annualFee: data.annualFee,
    annualFeeText: data.annualFee === 0 ? '$0' : `$${data.annualFee}`,
    apr: {
      introApr: data.introApr || null,
      regularApr: data.regularApr,
    },
    rewards: {
      rate: data.rewardsRate || null,
      bonus: data.rewardsBonus || null,
      type: data.rewardsType || null,
    },
    ratings: {
      overall: data.overallRating,
      fees: null,
      rewards: null,
      cost: null,
    },
    pros: data.pros.split('\n').filter(p => p.trim()),
    cons: data.cons.split('\n').filter(c => c.trim()),
    creditRequired: data.creditRequired || 'N/A',
    imageUrl: data.imageData || '',
  };
}

// Admin API namespace (used by Admin page - no auth required for now)
export const adminApi = {
  async getCards(params: GetCardsParams = {}): Promise<CardListResponse> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.order) searchParams.set('order', params.order);

    const response = await fetch(`${API_BASE}/cards?${searchParams}`);
    if (!response.ok) {
      throw new Error('Failed to fetch cards');
    }
    return response.json();
  },

  async getStats(): Promise<{
    totalCards: number;
    addedToday: number;
    addedThisWeek: number;
    noFeeCards: number;
  }> {
    try {
      const response = await fetch(`${API_BASE}/admin/stats`);
      if (!response.ok) {
        // Fallback to computing from cards list if stats endpoint doesn't exist
        const cardsResponse = await fetch(`${API_BASE}/cards?limit=1000`);
        if (!cardsResponse.ok) throw new Error('Failed to fetch');
        const data: CardListResponse = await cardsResponse.json();

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);

        return {
          totalCards: data.pagination.total,
          addedToday: data.data.filter(c => new Date(c.createdAt) >= todayStart).length,
          addedThisWeek: data.data.filter(c => new Date(c.createdAt) >= weekStart).length,
          noFeeCards: data.data.filter(c => c.annualFee === 0).length,
        };
      }
      return response.json();
    } catch {
      return {
        totalCards: 0,
        addedToday: 0,
        addedThisWeek: 0,
        noFeeCards: 0,
      };
    }
  },

  async createCard(data: AdminCardFormData): Promise<{ data: CreditCard }> {
    const cardData = transformFormData(data);
    const response = await fetch(`${API_BASE}/admin/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData),
    });
    if (!response.ok) {
      throw new Error('Failed to create card');
    }
    return response.json();
  },

  async updateCard(id: string, data: AdminCardFormData): Promise<{ data: CreditCard }> {
    const cardData = transformFormData(data);
    const response = await fetch(`${API_BASE}/admin/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData),
    });
    if (!response.ok) {
      throw new Error('Failed to update card');
    }
    return response.json();
  },

  async deleteCard(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/cards/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete card');
    }
  },

  async scrapeAndSave(url: string): Promise<{ data: CreditCard }> {
    const response = await fetch(`${API_BASE}/admin/scraper/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      throw new Error('Failed to import from WalletHub');
    }
    return response.json();
  },
};
