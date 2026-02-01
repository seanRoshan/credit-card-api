import { useState, useEffect, useCallback } from 'react';
import { SearchBar } from '../components/SearchBar';
import { CardGrid } from '../components/CardGrid';
import { FilterSidebar } from '../components/FilterSidebar';
import { Pagination } from '../components/Pagination';
import { cardApi } from '../services/api';
import type { GetCardsParams } from '../services/api';
import type { CreditCard } from '../types/creditCard';

const ITEMS_PER_PAGE = 20;

export function Home() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState<{
    noAnnualFee: boolean;
    sort: 'name' | 'annualFee' | 'rating';
    order: 'asc' | 'desc';
  }>({
    noAnnualFee: false,
    sort: 'name',
    order: 'asc',
  });

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (searchQuery.trim()) {
        // Use search endpoint
        const result = await cardApi.searchCards(searchQuery);
        setCards(result.data);
        setTotalItems(result.data.length);
      } else {
        // Use list endpoint with filters
        const params: GetCardsParams = {
          limit: ITEMS_PER_PAGE,
          offset: (currentPage - 1) * ITEMS_PER_PAGE,
          sort: filters.sort,
          order: filters.order,
          noAnnualFee: filters.noAnnualFee || undefined,
        };

        const result = await cardApi.getCards(params);
        setCards(result.data);
        setTotalItems(result.pagination.total);
      }
    } catch (err) {
      setError('Failed to load credit cards. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage, filters]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback(
    (newFilters: typeof filters) => {
      setFilters(newFilters);
      setCurrentPage(1);
    },
    []
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Credit Card Finder
            </h1>
            <span className="text-sm text-gray-500">
              {totalItems} cards available
            </span>
          </div>
          <div className="mt-4">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />
          </aside>

          {/* Card Grid */}
          <div className="flex-1">
            <CardGrid cards={cards} loading={loading} />

            {!loading && !searchQuery && totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
