interface RatingStarsProps {
  rating: number | null;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RatingStars({ rating, maxRating = 5, size = 'md' }: RatingStarsProps) {
  if (rating === null) {
    return (
      <span className="text-slate-400 dark:text-slate-500 text-sm flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        No rating
      </span>
    );
  }

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const stars = [];
  for (let i = 1; i <= maxRating; i++) {
    const filled = i <= Math.floor(rating);
    const partial = !filled && i === Math.ceil(rating) && rating % 1 !== 0;

    stars.push(
      <span key={i} className="relative">
        {/* Empty star */}
        <svg
          className={`${sizeClasses[size]} text-slate-200 dark:text-slate-700`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        {/* Filled star overlay */}
        {(filled || partial) && (
          <svg
            className={`${sizeClasses[size]} text-amber-400 absolute top-0 left-0 drop-shadow-sm`}
            fill="currentColor"
            viewBox="0 0 20 20"
            style={{
              clipPath: partial ? `inset(0 ${100 - (rating % 1) * 100}% 0 0)` : undefined,
            }}
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {stars}
      <span className="ml-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-lg">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}
