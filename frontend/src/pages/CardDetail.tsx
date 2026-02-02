import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cardApi } from '../services/api';
import type { CreditCard } from '../types/creditCard';
import { RatingStars } from '../components/RatingStars';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Theme Toggle Button Component
function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-300"
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="relative w-5 h-5">
        <svg
          className={`absolute inset-0 w-5 h-5 text-amber-500 transition-all duration-300 ${
            resolvedTheme === 'dark' ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <svg
          className={`absolute inset-0 w-5 h-5 text-indigo-400 transition-all duration-300 ${
            resolvedTheme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </div>
    </button>
  );
}

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400">Loading card details...</p>
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="text-center px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {error || 'Card not found'}
          </h2>
          <Link to="/" className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to all cards
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="glass-strong border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
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

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isAdmin && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 gradient-bg hover:opacity-90 text-white font-medium rounded-xl shadow-lg glow-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Refresh Result Toast */}
        {refreshResult && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium animate-fade-in-up ${
                refreshResult.success
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
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
        <div className="bg-white dark:bg-slate-800/50 rounded-3xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          {/* Hero Section */}
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 p-8">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Card Image */}
              <div className="w-full md:w-1/3 flex justify-center">
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="max-w-full h-auto max-h-48 object-contain drop-shadow-xl"
                  />
                ) : (
                  <div className="w-48 h-32 gradient-bg-animated rounded-xl flex items-center justify-center shadow-xl">
                    <span className="text-white font-bold text-center px-4">
                      {card.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Title & Rating */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                  {card.name}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-4">
                  <RatingStars rating={card.ratings.overall} size="lg" />
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
                  {card.annualFee === 0 && (
                    <span className="px-3 py-1 bg-emerald-500/90 text-white text-sm font-bold rounded-lg shadow-lg">
                      No Annual Fee
                    </span>
                  )}
                  {card.countryCode && (
                    <span className="px-3 py-1 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg shadow-sm">
                      {card.countryCode === 'US' ? '🇺🇸 USA' : '🇨🇦 Canada'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Annual Fee</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {card.annualFeeText}
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Regular APR</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {card.apr.regularApr}
                </div>
              </div>

              {card.apr.introApr && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Intro APR</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {card.apr.introApr}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Credit Required</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {card.creditRequired}
                </div>
              </div>
            </div>

            {/* Rewards Section */}
            {(card.rewards.rate || card.rewards.bonus) && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Rewards
                </h2>
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-amber-200/50 dark:border-amber-800/50">
                  {card.rewards.rate && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Earn Rate: </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {card.rewards.rate}
                      </span>
                    </div>
                  )}
                  {card.rewards.bonus && (
                    <div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Bonus: </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                  Ratings Breakdown
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {card.ratings.fees !== null && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {card.ratings.fees.toFixed(1)}
                      </div>
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Fees</div>
                    </div>
                  )}
                  {card.ratings.rewards !== null && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {card.ratings.rewards.toFixed(1)}
                      </div>
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Rewards</div>
                    </div>
                  )}
                  {card.ratings.cost !== null && (
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {card.ratings.cost.toFixed(1)}
                      </div>
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pros & Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {card.pros.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                    <span className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center mr-2">
                      <svg
                        className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
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
                  <ul className="space-y-3">
                    {card.pros.map((pro, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-slate-700 dark:text-slate-300"
                      >
                        <span className="text-emerald-500 dark:text-emerald-400 font-bold mt-0.5">+</span>
                        {pro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {card.cons.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                    <span className="w-7 h-7 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mr-2">
                      <svg
                        className="w-4 h-4 text-red-600 dark:text-red-400"
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
                  <ul className="space-y-3">
                    {card.cons.map((con, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 text-slate-700 dark:text-slate-300"
                      >
                        <span className="text-red-500 dark:text-red-400 font-bold mt-0.5">-</span>
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

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Credit Card API &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
