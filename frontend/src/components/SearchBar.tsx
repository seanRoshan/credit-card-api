import { useState, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export function SearchBar({ onSearch, initialQuery = '' }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, onSearch]);

  return (
    <div className={`relative group transition-all duration-300 ${isFocused ? 'scale-[1.01]' : ''}`}>
      {/* Glow Effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 blur transition-all duration-300 ${
        isFocused ? 'opacity-30' : 'group-hover:opacity-20'
      }`} />

      {/* Input Container */}
      <div className="relative glass rounded-xl overflow-hidden">
        <input
          type="text"
          placeholder="Search credit cards by name, rewards, or issuer..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full px-5 py-4 pl-14 text-base bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
        />

        {/* Search Icon */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          <svg
            className={`w-5 h-5 transition-colors duration-200 ${
              isFocused ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Clear Button */}
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Keyboard Shortcut Hint */}
        {!query && !isFocused && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md font-mono">⌘</kbd>
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md font-mono">K</kbd>
          </div>
        )}
      </div>
    </div>
  );
}
