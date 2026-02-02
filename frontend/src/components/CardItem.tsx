import { Link } from 'react-router-dom';
import type { CreditCard } from '../types/creditCard';
import { RatingStars } from './RatingStars';

interface CardItemProps {
  card: CreditCard;
}

export function CardItem({ card }: CardItemProps) {
  return (
    <Link
      to={`/cards/${card.id}`}
      className="group block bg-white dark:bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 card-interactive"
    >
      {/* Card Image */}
      <div className="relative h-48 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center p-6 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="relative max-h-full max-w-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="relative w-36 h-24 gradient-bg-animated rounded-xl flex items-center justify-center shadow-xl">
            <span className="text-white text-xs font-bold text-center px-3 drop-shadow-sm">
              {card.name}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
          {/* Country Badge - Left */}
          <div>
            {card.countryCode && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg shadow-md border border-slate-200/50 dark:border-slate-600/50">
                <span className="text-sm leading-none">{card.countryCode === 'US' ? '🇺🇸' : '🇨🇦'}</span>
                <span>{card.countryCode === 'US' ? 'USA' : 'CA'}</span>
              </span>
            )}
          </div>
          {/* Fee Badge - Right */}
          <div>
            {card.annualFee === 0 && (
              <span className="inline-block px-2.5 py-1 bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg">
                No Fee
              </span>
            )}
          </div>
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Card Info */}
      <div className="p-5">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:gradient-text transition-all duration-300">
          {card.name}
        </h3>

        <div className="mb-4">
          <RatingStars rating={card.ratings.overall} size="sm" />
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">Annual Fee</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-lg">
              {card.annualFeeText}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400">APR</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[60%] truncate text-right">
              {card.apr.regularApr}
            </span>
          </div>

          {card.rewards.rate && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Rewards</span>
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 max-w-[60%] truncate text-right">
                {card.rewards.rate}
              </span>
            </div>
          )}
        </div>

        {/* Credit Required Badge */}
        {card.creditRequired && card.creditRequired !== 'N/A' && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span className="text-xs text-slate-600 dark:text-slate-400">Credit Required:</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {card.creditRequired}
              </span>
            </div>
          </div>
        )}

        {/* View Details CTA */}
        <div className="mt-4 flex items-center justify-end text-sm font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          View Details
          <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
