import type { CreditCard, CardListResponse, CardSearchResponse } from '../types/creditCard';

const API_BASE = '/api';

export interface GetCardsParams {
  limit?: number;
  offset?: number;
  sort?: 'name' | 'annualFee' | 'rating';
  order?: 'asc' | 'desc';
  noAnnualFee?: boolean;
  creditRequired?: string;
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
};
