import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CardForm, type CardFormData } from '../components/admin/CardForm';
import { WalletHubScraper } from '../components/admin/WalletHubScraper';
import { CardTable } from '../components/admin/CardTable';
import { adminApi } from '../services/api';
import type { CreditCard } from '../types/creditCard';

type TabType = 'add' | 'scrape';

const ITEMS_PER_PAGE = 10;

interface Stats {
  totalCards: number;
  addedToday: number;
  addedThisWeek: number;
  noFeeCards: number;
}

export function Admin() {
  const [activeTab, setActiveTab] = useState<TabType>('add');
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalCards: 0,
    addedToday: 0,
    addedThisWeek: 0,
    noFeeCards: 0,
  });

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const result = await adminApi.getCards({
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
      const result = await adminApi.getStats();
      setStats(result);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchCards();
    fetchStats();
  }, [fetchCards, fetchStats]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSubmit = async (data: CardFormData) => {
    setIsSubmitting(true);
    try {
      if (editingCard) {
        await adminApi.updateCard(editingCard.id, data);
        showNotification('success', 'Card updated successfully!');
        setEditingCard(null);
      } else {
        await adminApi.createCard(data);
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

  const handleImport = async (url: string) => {
    setIsImporting(true);
    try {
      await adminApi.scrapeAndSave(url);
      showNotification('success', 'Card imported successfully!');
      fetchCards();
      fetchStats();
    } catch (err) {
      showNotification('error', 'Failed to import card');
      console.error(err);
      throw err;
    } finally {
      setIsImporting(false);
    }
  };

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card);
    setActiveTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (card: CreditCard) => {
    try {
      await adminApi.deleteCard(card.id);
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

  const statsCards = [
    {
      label: 'Total Cards',
      value: stats.totalCards,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Added Today',
      value: stats.addedToday,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      label: 'This Week',
      value: stats.addedThisWeek,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      label: 'No Fee Cards',
      value: stats.noFeeCards,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to home"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Card Management</h1>
                <p className="text-sm text-gray-500 mt-0.5">Add, edit, and manage credit cards</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Admin Portal</span>
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-semibold">
                A
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <div className={stat.textColor}>{stat.icon}</div>
                </div>
                <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          {/* Tab Headers */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => {
                setActiveTab('add');
                if (editingCard) setEditingCard(null);
              }}
              className={`relative px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'add'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {editingCard ? 'Edit Card' : 'Add New Card'}
              </span>
              {activeTab === 'add' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('scrape')}
              className={`relative px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'scrape'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Scrape from WalletHub
              </span>
              {activeTab === 'scrape' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'add' && (
            <div>
              {editingCard && (
                <div className="mb-6 flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Editing: {editingCard.name}</p>
                      <p className="text-sm text-gray-500">Make changes and click Update to save</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
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

          {activeTab === 'scrape' && (
            <WalletHubScraper
              onImport={handleImport}
              isImporting={isImporting}
            />
          )}
        </div>

        {/* Card List Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Existing Cards</h2>
            <span className="text-sm text-gray-500">{totalItems} total cards</span>
          </div>
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
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            Credit Card API Admin Panel
          </p>
        </div>
      </footer>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
