import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CardForm, type CardFormData } from '../components/admin/CardForm';
import { CardImporter } from '../components/admin/CardImporter';
import { CardTable } from '../components/admin/CardTable';
import { cardApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { CreditCard } from '../types/creditCard';

type TabType = 'cards' | 'scrape' | 'api-keys';

const ITEMS_PER_PAGE = 10;

interface Stats {
  totalCards: number;
  addedToday: number;
  addedThisWeek: number;
  noFeeCards: number;
}

interface ApiKey {
  id: string;
  name: string;
  rateLimit: number;
  active: boolean;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string | null;
  usageCount: number;
}

export function Admin() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalCards: 0,
    addedToday: 0,
    addedThisWeek: 0,
    noFeeCards: 0,
  });

  // API Key state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cardApi.getCards({
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      });
      setCards(result.data);
      setTotalItems(result.pagination.total);
    } catch (err) {
      showNotification('error', 'Failed to load cards');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  const fetchStats = useCallback(async () => {
    try {
      const result = await cardApi.getCards({ limit: 1000 });
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      setStats({
        totalCards: result.pagination.total,
        addedToday: result.data.filter(c => new Date(c.createdAt as unknown as string) >= todayStart).length,
        addedThisWeek: result.data.filter(c => new Date(c.createdAt as unknown as string) >= weekStart).length,
        noFeeCards: result.data.filter(c => c.annualFee === 0).length,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const token = await getToken();
      const result = await cardApi.listApiKeys(token);
      setApiKeys(result.data);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setApiKeysLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchCards();
    fetchStats();
  }, [fetchCards, fetchStats]);

  useEffect(() => {
    if (activeTab === 'api-keys') {
      fetchApiKeys();
    }
  }, [activeTab, fetchApiKeys]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSubmit = async (data: CardFormData) => {
    setIsSubmitting(true);
    try {
      const token = await getToken();
      // Determine country-specific fields
      const isCanadian = data.country === 'CA';
      const cardData = {
        name: data.name,
        slug: data.slug,
        annualFee: data.annualFee,
        annualFeeText: data.annualFee === 0 ? (isCanadian ? 'CA$0' : '$0') : (isCanadian ? `CA$${data.annualFee}` : `$${data.annualFee}`),
        apr: {
          introApr: data.introApr || null,
          regularApr: data.regularApr,
        },
        rewards: {
          rate: data.rewardsRate || null,
          bonus: data.rewardsBonus || null,
          type: data.rewardsType || null,
        },
        ratings: {
          overall: data.overallRating,
          fees: null,
          rewards: null,
          cost: null,
        },
        pros: data.pros.split('\n').filter((p: string) => p.trim()),
        cons: data.cons.split('\n').filter((c: string) => c.trim()),
        creditRequired: data.creditRequired || 'N/A',
        imageData: data.imageData || undefined,
        // Country fields
        country: isCanadian ? 'Canada' : 'USA',
        countryCode: data.country || 'US',
        currency: isCanadian ? 'CAD' : 'USD',
        currencySymbol: isCanadian ? 'CA$' : '$',
      };

      if (editingCard) {
        await cardApi.updateCard(editingCard.id, cardData, token);
        showNotification('success', 'Card updated successfully!');
        setEditingCard(null);
      } else {
        await cardApi.createCard(cardData, token);
        showNotification('success', 'Card added successfully!');
      }
      fetchCards();
      fetchStats();
    } catch (err) {
      showNotification('error', editingCard ? 'Failed to update card' : 'Failed to add card');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportComplete = () => {
    fetchCards();
    fetchStats();
  };

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card);
    setActiveTab('cards');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (card: CreditCard) => {
    try {
      const token = await getToken();
      await cardApi.deleteCard(card.id, token);
      showNotification('success', 'Card deleted successfully!');
      fetchCards();
      fetchStats();
    } catch (err) {
      showNotification('error', 'Failed to delete card');
      console.error(err);
    }
  };

  const handleCancelEdit = () => {
    setEditingCard(null);
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) {
      showNotification('error', 'Please enter a name for the API key');
      return;
    }

    setCreatingKey(true);
    try {
      const token = await getToken();
      const result = await cardApi.createApiKey(newKeyName.trim(), newKeyRateLimit, token);
      setNewlyCreatedKey(result.data.key);
      setNewKeyName('');
      setNewKeyRateLimit(60);
      showNotification('success', 'API key created successfully!');
      fetchApiKeys();
    } catch (err) {
      showNotification('error', 'Failed to create API key');
      console.error(err);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = await getToken();
      await cardApi.revokeApiKey(keyId, token);
      showNotification('success', `API key "${keyName}" revoked successfully`);
      fetchApiKeys();
    } catch (err) {
      showNotification('error', 'Failed to revoke API key');
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('success', 'Copied to clipboard!');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Failed to sign out:', err);
    } finally {
      setSigningOut(false);
    }
  };

  const statsCards = [
    {
      label: 'Total Cards',
      value: stats.totalCards,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Added Today',
      value: stats.addedToday,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'This Week',
      value: stats.addedThisWeek,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-violet-500 to-purple-600',
      bgLight: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
    {
      label: 'No Fee Cards',
      value: stats.noFeeCards,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  const tabs = [
    {
      id: 'cards' as TabType,
      label: editingCard ? 'Edit Card' : 'Add Card',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
    },
    {
      id: 'scrape' as TabType,
      label: 'Import',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      id: 'api-keys' as TabType,
      label: 'API Keys',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                title="Back to home"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
                  <p className="text-xs text-gray-500">Manage cards & API access</p>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-700 truncate max-w-[140px]">
                    {user?.email}
                  </span>
                  <span className="text-xs text-indigo-600 font-semibold">Administrator</span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200 disabled:opacity-50"
                title="Sign out"
              >
                {signingOut ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in backdrop-blur-xl border ${
          notification.type === 'success'
            ? 'bg-emerald-500/95 text-white border-emerald-400/50'
            : 'bg-red-500/95 text-white border-red-400/50'
        }`}>
          {notification.type === 'success' ? (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          <span className="font-medium pr-2">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-gray-200 transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bgLight} group-hover:scale-110 transition-transform duration-300`}>
                    <div className={stat.iconColor}>{stat.icon}</div>
                  </div>
                  <div className={`text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                    {stat.value}
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-100 bg-gray-50/50">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'cards' && editingCard) setEditingCard(null);
                  }}
                  className={`relative flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'text-indigo-600 bg-white'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                  }`}
                >
                  <span className={activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 lg:p-8">
            {/* Cards Tab */}
            {activeTab === 'cards' && (
              <div className="space-y-6">
                {editingCard && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Editing: {editingCard.name}</p>
                        <p className="text-sm text-gray-500">Update the card details below</p>
                      </div>
                    </div>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-xl transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <CardForm
                  initialData={editingCard}
                  onSubmit={handleSubmit}
                  isSubmitting={isSubmitting}
                />
              </div>
            )}

            {/* Import Tab */}
            {activeTab === 'scrape' && (
              <CardImporter onImportComplete={handleImportComplete} />
            )}

            {/* API Keys Tab */}
            {activeTab === 'api-keys' && (
              <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">API Key Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Generate and manage API keys for external applications</p>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create New Key
                  </button>
                </div>

                {/* Create Form */}
                {showCreateForm && (
                  <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-indigo-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h3>

                    {newlyCreatedKey ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                              <p className="font-medium text-amber-800">Save this key now!</p>
                              <p className="text-sm text-amber-700 mt-1">This is the only time you'll see this key. Copy it somewhere safe.</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <code className="flex-1 px-4 py-3 bg-gray-900 text-emerald-400 rounded-xl font-mono text-sm overflow-x-auto">
                            {newlyCreatedKey}
                          </code>
                          <button
                            onClick={() => copyToClipboard(newlyCreatedKey)}
                            className="p-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors"
                            title="Copy to clipboard"
                          >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setNewlyCreatedKey(null);
                            setShowCreateForm(false);
                          }}
                          className="w-full py-2.5 text-gray-600 hover:text-gray-800 hover:bg-white/50 rounded-xl transition-colors font-medium"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Key Name
                            </label>
                            <input
                              type="text"
                              value={newKeyName}
                              onChange={(e) => setNewKeyName(e.target.value)}
                              placeholder="e.g., My Mobile App"
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Rate Limit (requests/min)
                            </label>
                            <input
                              type="number"
                              value={newKeyRateLimit}
                              onChange={(e) => setNewKeyRateLimit(parseInt(e.target.value) || 60)}
                              min={1}
                              max={1000}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={handleCreateApiKey}
                            disabled={creatingKey || !newKeyName.trim()}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            {creatingKey ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Generate Key
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setShowCreateForm(false)}
                            className="px-5 py-3 text-gray-600 hover:text-gray-800 hover:bg-white rounded-xl transition-colors font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* API Keys List */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900">Active API Keys</h3>
                  </div>

                  {apiKeysLoading ? (
                    <div className="p-12 text-center">
                      <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-gray-500">Loading API keys...</p>
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No API keys yet</p>
                      <p className="text-sm text-gray-400 mt-1">Create your first API key to get started</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {apiKeys.map((key) => (
                        <div key={key.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-xl ${key.active ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                                <svg className={`w-5 h-5 ${key.active ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">{key.name}</span>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    key.active
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {key.active ? 'Active' : 'Revoked'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                    {key.id}
                                  </span>
                                  <span>{key.rateLimit} req/min</span>
                                  <span>{key.usageCount.toLocaleString()} requests</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-2">
                                  Created {new Date(key.createdAt).toLocaleDateString()} by {key.createdBy}
                                  {key.lastUsedAt && (
                                    <> · Last used {new Date(key.lastUsedAt).toLocaleDateString()}</>
                                  )}
                                </div>
                              </div>
                            </div>
                            {key.active && (
                              <button
                                onClick={() => handleRevokeApiKey(key.id, key.name)}
                                className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors font-medium text-sm"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* API Usage Instructions */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    API Usage
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Include your API key in the <code className="text-emerald-400 bg-gray-800 px-1.5 py-0.5 rounded">X-API-Key</code> header of your requests.
                  </p>
                  <div className="bg-gray-950 rounded-xl p-4 font-mono text-sm overflow-x-auto">
                    <div className="text-gray-500"># Get card image by slug</div>
                    <div className="text-emerald-400 mt-2">
                      curl -H "X-API-Key: YOUR_API_KEY" \
                    </div>
                    <div className="text-emerald-400 pl-4">
                      https://credit-card-api-app.web.app/api/v1/cards/chase-sapphire-reserve/image
                    </div>
                  </div>
                  <div className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <div className="text-gray-400">Endpoint</div>
                      <div className="font-mono text-indigo-400 mt-1">/api/v1/cards/:slug/image</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <div className="text-gray-400">Rate Limit Header</div>
                      <div className="font-mono text-indigo-400 mt-1">X-RateLimit-Remaining</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <div className="text-gray-400">Redirect Option</div>
                      <div className="font-mono text-indigo-400 mt-1">?redirect=true</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card List Section */}
        {activeTab !== 'api-keys' && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Card Library</h2>
                <p className="text-sm text-gray-500 mt-1">{totalItems} cards in database</p>
              </div>
            </div>
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              <CardTable
                cards={cards}
                loading={loading}
                totalItems={totalItems}
                currentPage={currentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-gray-100 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400">
            Credit Card API · Admin Dashboard
          </p>
        </div>
      </footer>

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
