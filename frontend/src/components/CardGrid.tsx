import type { CreditCard } from '../types/creditCard';
import { CardItem } from './CardItem';

interface CardGridProps {
  cards: CreditCard[];
  loading?: boolean;
}

export function CardGrid({ cards, loading }: CardGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
          >
            <div className="h-48 animate-shimmer" />
            <div className="p-5 space-y-4">
              <div className="h-6 animate-shimmer rounded-lg w-3/4" />
              <div className="h-4 animate-shimmer rounded-lg w-1/2" />
              <div className="space-y-2">
                <div className="h-3 animate-shimmer rounded-lg" />
                <div className="h-3 animate-shimmer rounded-lg" />
                <div className="h-3 animate-shimmer rounded-lg w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No cards found</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div
          key={card.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardItem card={card} />
        </div>
      ))}
    </div>
  );
}
