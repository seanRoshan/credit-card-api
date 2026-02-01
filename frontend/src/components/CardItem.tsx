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
      className="block bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden border border-gray-100"
    >
      {/* Card Image */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="w-32 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-medium text-center px-2">
              {card.name}
            </span>
          </div>
        )}
        {card.annualFee === 0 && (
          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
            No Annual Fee
          </span>
        )}
      </div>

      {/* Card Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
          {card.name}
        </h3>

        <div className="mb-3">
          <RatingStars rating={card.ratings.overall} size="sm" />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Annual Fee</span>
            <span className="font-medium text-gray-900">{card.annualFeeText}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">Regular APR</span>
            <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">
              {card.apr.regularApr}
            </span>
          </div>

          {card.rewards.rate && (
            <div className="flex justify-between">
              <span className="text-gray-500">Rewards</span>
              <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">
                {card.rewards.rate}
              </span>
            </div>
          )}
        </div>

        {/* Credit Required Badge */}
        {card.creditRequired && card.creditRequired !== 'N/A' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Credit: </span>
            <span className="text-xs font-medium text-gray-700">
              {card.creditRequired}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
