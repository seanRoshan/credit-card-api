import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cardApi } from '../services/api';
import type { CreditCard } from '../types/creditCard';
import { RatingStars } from '../components/RatingStars';
import { useAuth } from '../contexts/AuthContext';

export function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [card, setCard] = useState<CreditCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    async function fetchCard() {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const result = await cardApi.getCard(id);
        setCard(result.data);
      } catch (err) {
        setError('Failed to load card details. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchCard();
  }, [id]);

  const handleRefresh = async () => {
    if (!id || !user) return;

    setRefreshing(true);
    setRefreshResult(null);

    try {
      const token = await user.getIdToken();
      const result = await cardApi.refreshCard(id, token);
      setCard(result.data);
      setRefreshResult({
        success: true,
        message: result.changes.length > 0
          ? `Updated: ${result.changes.join(', ')}`
          : 'Card is already up to date',
      });
    } catch (err) {
      setRefreshResult({
        success: false,
        message: 'Failed to refresh card data',
      });
      console.error(err);
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshResult(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Card not found'}
          </h2>
          <Link to="/" className="text-blue-600 hover:underline">
            Back to all cards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to all cards
          </Link>

          {isAdmin && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <svg
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh from WalletHub'}
            </button>
          )}
        </div>

        {/* Refresh Result Toast */}
        {refreshResult && (
          <div
            className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-4 transition-all ${
              refreshResult.success ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                refreshResult.success ? 'bg-green-50' : 'bg-red-50'
              }`}
            >
              {refreshResult.success ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {refreshResult.message}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Hero Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Card Image */}
              <div className="w-full md:w-1/3 flex justify-center">
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="max-w-full h-auto max-h-48 object-contain drop-shadow-lg"
                  />
                ) : (
                  <div className="w-48 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-medium text-center px-4">
                      {card.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Title & Rating */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900 mb-3">
                  {card.name}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <RatingStars rating={card.ratings.overall} size="lg" />
                </div>
                {card.annualFee === 0 && (
                  <span className="inline-block mt-3 bg-green-500 text-white text-sm font-semibold px-3 py-1 rounded-full">
                    No Annual Fee
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">Annual Fee</div>
                <div className="text-xl font-semibold text-gray-900">
                  {card.annualFeeText}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">Regular APR</div>
                <div className="text-xl font-semibold text-gray-900">
                  {card.apr.regularApr}
                </div>
              </div>

              {card.apr.introApr && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500 mb-1">Intro APR</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {card.apr.introApr}
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500 mb-1">Credit Required</div>
                <div className="text-lg font-semibold text-gray-900">
                  {card.creditRequired}
                </div>
              </div>
            </div>

            {/* Rewards Section */}
            {(card.rewards.rate || card.rewards.bonus) && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Rewards
                </h2>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6">
                  {card.rewards.rate && (
                    <div className="mb-3">
                      <span className="text-sm text-gray-500">Earn Rate: </span>
                      <span className="font-semibold text-gray-900">
                        {card.rewards.rate}
                      </span>
                    </div>
                  )}
                  {card.rewards.bonus && (
                    <div>
                      <span className="text-sm text-gray-500">Bonus: </span>
                      <span className="font-semibold text-gray-900">
                        {card.rewards.bonus}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ratings Breakdown */}
            {(card.ratings.fees || card.ratings.rewards || card.ratings.cost) && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Ratings Breakdown
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {card.ratings.fees !== null && (
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {card.ratings.fees.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-500">Fees</div>
                    </div>
                  )}
                  {card.ratings.rewards !== null && (
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {card.ratings.rewards.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-500">Rewards</div>
                    </div>
                  )}
                  {card.ratings.cost !== null && (
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {card.ratings.cost.toFixed(1)}
                      </div>
                      <div className="text-sm text-gray-500">Cost</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pros & Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {card.pros.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </span>
                    Pros
                  </h2>
                  <ul className="space-y-2">
                    {card.pros.map((pro, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-gray-700"
                      >
                        <span className="text-green-500 mt-1">+</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {card.cons.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-2">
                      <svg
                        className="w-4 h-4 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </span>
                    Cons
                  </h2>
                  <ul className="space-y-2">
                    {card.cons.map((con, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-gray-700"
                      >
                        <span className="text-red-500 mt-1">-</span>
                        {con}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
