type CountryFilter = 'all' | 'US' | 'CA';

interface FilterSidebarProps {
  filters: {
    noAnnualFee: boolean;
    sort: 'name' | 'annualFee' | 'rating';
    order: 'asc' | 'desc';
    country: CountryFilter;
  };
  onFilterChange: (filters: FilterSidebarProps['filters']) => void;
}

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
      {/* Country Filter */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Country</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onFilterChange({ ...filters, country: 'all' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.country === 'all'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, country: 'US' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              filters.country === 'US'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>🇺🇸</span> USA
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, country: 'CA' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
              filters.country === 'CA'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>🇨🇦</span> Canada
          </button>
        </div>
      </div>

      {/* Other Filters */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Filters</h3>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.noAnnualFee}
            onChange={(e) =>
              onFilterChange({ ...filters, noAnnualFee: e.target.checked })
            }
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-gray-700">No Annual Fee</span>
        </label>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Sort By</h3>
        <select
          value={filters.sort}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              sort: e.target.value as FilterSidebarProps['filters']['sort'],
            })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Name</option>
          <option value="rating">Rating</option>
          <option value="annualFee">Annual Fee</option>
        </select>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Order</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onFilterChange({ ...filters, order: 'asc' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.order === 'asc'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ascending
          </button>
          <button
            onClick={() => onFilterChange({ ...filters, order: 'desc' })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filters.order === 'desc'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Descending
          </button>
        </div>
      </div>
    </div>
  );
}
