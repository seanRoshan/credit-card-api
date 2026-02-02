import { useState, useCallback, useEffect } from 'react';
import { cardApi } from '../../services/api';
import type { RateHubCategory } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Country = 'US' | 'CA';

interface SearchResult {
  name: string;
  url: string;
  imageUrl: string | null;
  annualFee?: string;
  rewardsRate?: string;
}

interface CardImporterProps {
  onImportComplete: () => void;
}

interface ProgressState {
  current: number;
  total: number;
  currentCategory?: string;
  scraped: number;
  skipped: number;
  failed: number;
}

// Confirmation Modal Component
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  variant = 'primary',
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'primary' | 'danger';
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onCancel}
        />
        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
              {variant === 'danger' ? (
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
            </div>
          </div>
          <div className="mt-6 flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast Component
function Toast({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }[type];

  const icon = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  }[type];

  return (
    <div
      className={`fixed top-20 right-4 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white ${bgColor} animate-slide-in`}
    >
      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
        {icon}
      </div>
      <span className="font-medium pr-2 max-w-xs">{message}</span>
      <button
        onClick={onClose}
        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// Progress Bar Component
function ProgressBar({
  progress,
  label,
  stats,
}: {
  progress: number;
  label?: string;
  stats?: { scraped: number; skipped: number; failed: number };
}) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-400 font-medium">{label}</span>
          <span className="text-slate-500 dark:text-slate-400">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      {stats && (
        <div className="flex gap-4 text-xs mt-2">
          <span className="text-emerald-600 font-medium">✓ {stats.scraped} imported</span>
          <span className="text-slate-500 dark:text-slate-400">⏭ {stats.skipped} skipped</span>
          {stats.failed > 0 && (
            <span className="text-red-500">✗ {stats.failed} failed</span>
          )}
        </div>
      )}
    </div>
  );
}

export function CardImporter({ onImportComplete }: CardImporterProps) {
  const { user } = useAuth();
  const [activeCountry, setActiveCountry] = useState<Country>('US');

  // US (WalletHub) state
  const [searchQuery, setSearchQuery] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Canada (RateHub) state - category based
  const [categories, setCategories] = useState<RateHubCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [bulkLimit, setBulkLimit] = useState(30);
  const [skipExisting, setSkipExisting] = useState(true);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<ProgressState | null>(null);
  const [customUrl, setCustomUrl] = useState('');

  // Import all state
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [importAllProgress, setImportAllProgress] = useState<ProgressState | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  };

  // Load RateHub categories when switching to Canada tab
  useEffect(() => {
    if (activeCountry === 'CA' && categories.length === 0) {
      loadCategories();
    }
  }, [activeCountry]);

  const loadCategories = async () => {
    try {
      const token = await getToken();
      const response = await cardApi.getRateHubCategories(token);
      if (response.data && Array.isArray(response.data)) {
        setCategories(response.data);
        if (response.data.length > 0) {
          setSelectedCategory(response.data[0].key);
        }
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
      showToast('error', 'Failed to load categories');
    }
  };

  // US (WalletHub) handlers
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const token = await getToken();
      const response = await cardApi.searchWalletHub(searchQuery, token);
      setSearchResults(response.results || []);
    } catch (err) {
      setError('Failed to search WalletHub. Please try again.');
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, getToken]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleImportFromUrl = useCallback(async () => {
    if (!pasteUrl.trim()) return;

    const expectedDomain = activeCountry === 'US' ? 'wallethub.com' : 'ratehub.ca';
    if (!pasteUrl.includes(expectedDomain)) {
      setError(`Please enter a valid ${activeCountry === 'US' ? 'WalletHub' : 'RateHub'} URL`);
      return;
    }

    setImportingUrl(pasteUrl);
    setError(null);

    try {
      const token = await getToken();
      if (activeCountry === 'US') {
        await cardApi.importFromWalletHub(pasteUrl, token);
        showToast('success', 'Card imported successfully!');
      } else {
        // For RateHub, import from URL (could be blog page with multiple cards)
        await cardApi.importFromRateHub(pasteUrl, token);
        showToast('success', 'Card(s) imported successfully!');
      }
      setPasteUrl('');
      onImportComplete();
    } catch (err) {
      showToast('error', 'Failed to import. Please check the URL and try again.');
    } finally {
      setImportingUrl(null);
    }
  }, [pasteUrl, activeCountry, getToken, onImportComplete]);

  const handleImportResult = useCallback(async (result: SearchResult) => {
    setImportingUrl(result.url);
    setError(null);

    try {
      const token = await getToken();
      await cardApi.importFromWalletHub(result.url, token);
      showToast('success', `Imported: ${result.name}`);
      onImportComplete();
    } catch (err) {
      showToast('error', 'Failed to import card. Please try again.');
    } finally {
      setImportingUrl(null);
    }
  }, [getToken, onImportComplete]);

  // Canada (RateHub) handlers
  const handleBulkImport = useCallback(async () => {
    const category = categories.find(c => c.key === selectedCategory);
    if (!category) return;

    setIsBulkImporting(true);
    setBulkProgress({ current: 0, total: 100, scraped: 0, skipped: 0, failed: 0, currentCategory: category.name });
    setError(null);

    try {
      const token = await getToken();

      // Show progress simulation while waiting for response
      const progressInterval = setInterval(() => {
        setBulkProgress(prev => prev ? {
          ...prev,
          current: Math.min(prev.current + 5, 90),
        } : null);
      }, 1000);

      const result = await cardApi.bulkImportFromRateHub(category.url, bulkLimit, skipExisting, token);

      clearInterval(progressInterval);

      setBulkProgress({
        current: 100,
        total: 100,
        currentCategory: category.name,
        scraped: result.data.scraped,
        skipped: result.data.skipped,
        failed: result.data.failed,
      });

      showToast('success', `Imported ${result.data.scraped} cards from ${category.name}`);
      onImportComplete();
    } catch (err) {
      showToast('error', 'Bulk import failed. Please try again.');
      console.error(err);
      setBulkProgress(null);
    } finally {
      setIsBulkImporting(false);
    }
  }, [categories, selectedCategory, bulkLimit, skipExisting, getToken, onImportComplete]);

  const handleCustomUrlImport = useCallback(async () => {
    if (!customUrl.trim() || !customUrl.includes('ratehub.ca')) {
      setError('Please enter a valid RateHub URL');
      return;
    }

    setIsBulkImporting(true);
    setBulkProgress({ current: 0, total: 100, scraped: 0, skipped: 0, failed: 0, currentCategory: 'Custom URL' });
    setError(null);

    try {
      const token = await getToken();

      const progressInterval = setInterval(() => {
        setBulkProgress(prev => prev ? {
          ...prev,
          current: Math.min(prev.current + 5, 90),
        } : null);
      }, 1000);

      const result = await cardApi.bulkImportFromRateHub(customUrl, bulkLimit, skipExisting, token);

      clearInterval(progressInterval);

      setBulkProgress({
        current: 100,
        total: 100,
        currentCategory: 'Custom URL',
        scraped: result.data.scraped,
        skipped: result.data.skipped,
        failed: result.data.failed,
      });

      showToast('success', `Imported ${result.data.scraped} cards`);
      setCustomUrl('');
      onImportComplete();
    } catch (err) {
      showToast('error', 'Import failed. Please try again.');
      console.error(err);
      setBulkProgress(null);
    } finally {
      setIsBulkImporting(false);
    }
  }, [customUrl, bulkLimit, skipExisting, getToken, onImportComplete]);

  const handleImportAllConfirm = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: 'Import All Canadian Cards',
      message: `This will import cards from all ${categories.length} RateHub categories. This may take several minutes. Do you want to continue?`,
      onConfirm: async () => {
        setConfirmModal(null);
        await executeImportAll();
      },
    });
  }, [categories.length]);

  const executeImportAll = useCallback(async () => {
    setIsImportingAll(true);
    const totalCategories = categories.length;
    setImportAllProgress({
      current: 0,
      total: totalCategories,
      currentCategory: 'Starting...',
      scraped: 0,
      skipped: 0,
      failed: 0,
    });
    setError(null);

    try {
      const token = await getToken();

      // Show progress simulation
      let currentCategoryIndex = 0;
      const progressInterval = setInterval(() => {
        if (currentCategoryIndex < totalCategories) {
          setImportAllProgress(prev => prev ? {
            ...prev,
            current: currentCategoryIndex + 1,
            currentCategory: categories[currentCategoryIndex]?.name || 'Processing...',
          } : null);
          currentCategoryIndex++;
        }
      }, 3000);

      const result = await cardApi.importAllFromRateHub(30, skipExisting, token);

      clearInterval(progressInterval);

      setImportAllProgress({
        current: totalCategories,
        total: totalCategories,
        currentCategory: 'Complete!',
        scraped: result.data.totalScraped,
        skipped: result.data.totalSkipped,
        failed: result.data.totalFailed,
      });

      showToast('success', `Imported ${result.data.totalScraped} cards from all categories!`);
      onImportComplete();
    } catch (err) {
      showToast('error', 'Import all failed. Please try again.');
      console.error(err);
      setImportAllProgress(null);
    } finally {
      setIsImportingAll(false);
    }
  }, [categories, skipExisting, getToken, onImportComplete]);

  const countryTabs = [
    { id: 'US' as Country, label: 'USA', flag: '🇺🇸', source: 'WalletHub', color: 'from-blue-600 to-indigo-600' },
    { id: 'CA' as Country, label: 'Canada', flag: '🇨🇦', source: 'RateHub', color: 'from-red-600 to-rose-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText="Import All"
          cancelText="Cancel"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          variant="primary"
        />
      )}

      {/* Country Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {countryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveCountry(tab.id);
              setSearchResults([]);
              setSearchQuery('');
              setPasteUrl('');
              setCustomUrl('');
              setError(null);
              setBulkProgress(null);
              setImportAllProgress(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeCountry === tab.id
                ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="text-xl">{tab.flag}</span>
            <div className="text-left">
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className={`text-xs ${activeCountry === tab.id ? 'text-white/80' : 'text-gray-400'}`}>
                {tab.source}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* USA (WalletHub) Section */}
      {activeCountry === 'US' && (
        <>
          {/* Search Section */}
          <div className="rounded-xl p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search WalletHub
            </h3>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Search for US credit cards..."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-12 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  isSearching || !searchQuery.trim()
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                Search
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Found {searchResults.length} results:
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all"
                    >
                      {result.imageUrl ? (
                        <img
                          src={result.imageUrl}
                          alt={result.name}
                          className="w-16 h-10 object-contain rounded"
                        />
                      ) : (
                        <div className="w-16 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 dark:text-white truncate">{result.name}</h4>
                        <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {result.annualFee && <span>{result.annualFee}</span>}
                          {result.rewardsRate && <span>{result.rewardsRate}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleImportResult(result)}
                        disabled={importingUrl === result.url}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                          importingUrl === result.url
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                            : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md'
                        }`}
                      >
                        {importingUrl === result.url ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Importing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Paste URL Section */}
          <div className="rounded-xl p-6 bg-gradient-to-r from-purple-50 to-violet-50">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Paste WalletHub URL
            </h3>

            <div className="flex gap-3">
              <input
                type="url"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="https://wallethub.com/credit-cards/..."
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleImportFromUrl}
                disabled={!pasteUrl.trim() || importingUrl === pasteUrl}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  !pasteUrl.trim()
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                {importingUrl === pasteUrl ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Card
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Canada (RateHub) Section */}
      {activeCountry === 'CA' && (
        <>
          {/* Category Import Section */}
          <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Import by Category
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              RateHub lists credit cards on category pages. Select a category to import all cards from that page.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={isBulkImporting || categories.length === 0}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white disabled:opacity-50"
                >
                  {categories.map((cat) => (
                    <option key={cat.key} value={cat.key}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Limit per Category</label>
                <input
                  type="number"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(parseInt(e.target.value) || 30)}
                  min={1}
                  max={100}
                  disabled={isBulkImporting}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white disabled:opacity-50"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipExisting}
                    onChange={(e) => setSkipExisting(e.target.checked)}
                    disabled={isBulkImporting}
                    className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-red-600 dark:text-red-400 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Skip existing cards</span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleBulkImport}
                  disabled={isBulkImporting || !selectedCategory}
                  className={`w-full px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    isBulkImporting || !selectedCategory
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:shadow-lg hover:scale-[1.02]'
                  }`}
                >
                  {isBulkImporting ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import Category
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bulk Progress */}
            {bulkProgress && (
              <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-red-200">
                <ProgressBar
                  progress={bulkProgress.current}
                  label={`Importing ${bulkProgress.currentCategory}...`}
                  stats={{
                    scraped: bulkProgress.scraped,
                    skipped: bulkProgress.skipped,
                    failed: bulkProgress.failed,
                  }}
                />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Custom URL Import */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Import from Custom URL
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Paste any RateHub blog/category page URL to import all cards listed on that page.
            </p>

            <div className="flex gap-3">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://www.ratehub.ca/blog/best-..."
                className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={handleCustomUrlImport}
                disabled={!customUrl.trim() || isBulkImporting}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  !customUrl.trim() || isBulkImporting
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import from URL
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">IMPORT ALL</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Import All Section */}
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  Import All Categories
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Import cards from all {categories.length} RateHub categories at once
                </p>
              </div>
              <button
                onClick={handleImportAllConfirm}
                disabled={isImportingAll || categories.length === 0}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  isImportingAll || categories.length === 0
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:shadow-lg hover:scale-[1.02]'
                }`}
              >
                {isImportingAll ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Importing All...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Import All
                  </>
                )}
              </button>
            </div>

            {/* Import All Progress */}
            {importAllProgress && (
              <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-violet-200">
                <ProgressBar
                  progress={(importAllProgress.current / importAllProgress.total) * 100}
                  label={`Processing: ${importAllProgress.currentCategory} (${importAllProgress.current}/${importAllProgress.total} categories)`}
                  stats={{
                    scraped: importAllProgress.scraped,
                    skipped: importAllProgress.skipped,
                    failed: importAllProgress.failed,
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <p className="font-medium text-gray-700 mb-1">
            {activeCountry === 'US' ? 'Importing from WalletHub (USA)' : 'Importing from RateHub (Canada)'}
          </p>
          <ul className="list-disc list-inside space-y-1">
            {activeCountry === 'US' ? (
              <>
                <li>Search for cards or paste a direct URL</li>
                <li>Click Import to automatically fetch card details</li>
              </>
            ) : (
              <>
                <li>Select a category to import all cards from that page</li>
                <li>Or paste any RateHub blog/category URL</li>
                <li>Use "Import All" to import from all categories at once</li>
              </>
            )}
            <li>Card images are downloaded and stored in Firebase Storage</li>
          </ul>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
