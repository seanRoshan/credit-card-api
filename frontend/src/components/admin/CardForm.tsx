import { useState, useEffect, useCallback, useRef } from 'react';
import { ImageUpload } from './ImageUpload';
import type { CreditCard } from '../../types/creditCard';

// Custom dropdown component with improved UX
interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}

function CustomDropdown({ options, value, onChange, placeholder, label, className = '' }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'ArrowDown' && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex(opt => opt.value === value);
      const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
      onChange(options[nextIndex].value);
    } else if (e.key === 'ArrowUp' && isOpen) {
      e.preventDefault();
      const currentIndex = options.findIndex(opt => opt.value === value);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
      onChange(options[prevIndex].value);
    }
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full px-4 py-3 text-left border rounded-xl transition-all duration-200 flex items-center justify-between gap-3 ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white'
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedOption?.icon && (
            <span className="flex-shrink-0 text-gray-500">{selectedOption.icon}</span>
          )}
          <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden animate-dropdown">
          <ul className="py-2 max-h-64 overflow-auto" role="listbox">
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                    value === option.value
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  role="option"
                  aria-selected={value === option.value}
                >
                  {option.icon && (
                    <span className={`flex-shrink-0 ${value === option.value ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {option.icon}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${value === option.value ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                    )}
                  </div>
                  {value === option.value && (
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes dropdown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-dropdown {
          animation: dropdown 0.15s ease-out;
        }
      `}</style>
    </div>
  );
}

interface CardFormData {
  name: string;
  slug: string;
  annualFee: number;
  introApr: string;
  regularApr: string;
  rewardsRate: string;
  rewardsBonus: string;
  rewardsType: 'cashback' | 'points' | 'miles' | '';
  overallRating: number;
  creditRequired: 'Excellent' | 'Good' | 'Fair' | 'Poor' | '';
  pros: string;
  cons: string;
  imageData: string | null;
  country: 'US' | 'CA';
}

interface CardFormProps {
  initialData?: CreditCard | null;
  onSubmit: (data: CardFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

export function CardForm({ initialData, onSubmit, isSubmitting = false }: CardFormProps) {
  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    slug: '',
    annualFee: 0,
    introApr: '',
    regularApr: '',
    rewardsRate: '',
    rewardsBonus: '',
    rewardsType: '',
    overallRating: 3,
    creditRequired: '',
    pros: '',
    cons: '',
    imageData: null,
    country: 'US',
  });

  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CardFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        slug: initialData.slug,
        annualFee: initialData.annualFee,
        introApr: initialData.apr.introApr || '',
        regularApr: initialData.apr.regularApr,
        rewardsRate: initialData.rewards.rate || '',
        rewardsBonus: initialData.rewards.bonus || '',
        rewardsType: (initialData.rewards.type as CardFormData['rewardsType']) || '',
        overallRating: initialData.ratings.overall || 3,
        creditRequired: (initialData.creditRequired as CardFormData['creditRequired']) || '',
        pros: initialData.pros.join('\n'),
        cons: initialData.cons.join('\n'),
        imageData: initialData.imageUrl || null,
        country: (initialData.countryCode as 'US' | 'CA') || 'US',
      });
      setSlugEdited(true);
    }
  }, [initialData]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: slugEdited ? prev.slug : generateSlug(name),
    }));
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }));
    }
  }, [slugEdited, errors.name]);

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true);
    setFormData(prev => ({ ...prev, slug: e.target.value }));
  }, []);

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof CardFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleAnnualFeeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setFormData(prev => ({ ...prev, annualFee: value }));
  }, []);

  const handleRatingChange = useCallback((rating: number) => {
    setFormData(prev => ({ ...prev, overallRating: rating }));
  }, []);

  const handleImageChange = useCallback((imageData: string | null) => {
    setFormData(prev => ({ ...prev, imageData }));
  }, []);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CardFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Card name is required';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'Slug is required';
    }

    if (!formData.regularApr.trim()) {
      newErrors.regularApr = 'Regular APR is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formData);
  };

  const renderStarPicker = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRatingChange(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <svg
              className={`w-8 h-8 transition-colors ${
                star <= formData.overallRating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 fill-gray-300'
              }`}
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
        <span className="ml-3 text-lg font-semibold text-gray-700">
          {formData.overallRating}/5
        </span>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Country Selection */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Country / Region
        </h3>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, country: 'US' }))}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
              formData.country === 'US'
                ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-lg shadow-sky-500/20'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">🇺🇸</span>
            <div className="text-left">
              <div className="font-semibold">United States</div>
              <div className="text-xs opacity-75">USD ($)</div>
            </div>
            {formData.country === 'US' && (
              <svg className="w-5 h-5 ml-auto text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, country: 'CA' }))}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
              formData.country === 'CA'
                ? 'border-red-500 bg-red-50 text-red-700 shadow-lg shadow-red-500/20'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">🇨🇦</span>
            <div className="text-left">
              <div className="font-semibold">Canada</div>
              <div className="text-xs opacity-75">CAD ($)</div>
            </div>
            {formData.country === 'CA' && (
              <svg className="w-5 h-5 ml-auto text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Card Name & Slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleNameChange}
            placeholder="e.g., Chase Sapphire Preferred"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="slug"
            value={formData.slug}
            onChange={handleSlugChange}
            placeholder="chase-sapphire-preferred"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.slug ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.slug && (
            <p className="mt-1 text-sm text-red-600">{errors.slug}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Auto-generated from name, or edit manually
          </p>
        </div>
      </div>

      {/* Annual Fee & APR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Annual Fee
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
              $
            </span>
            <input
              type="number"
              name="annualFee"
              value={formData.annualFee}
              onChange={handleAnnualFeeChange}
              min="0"
              step="0.01"
              className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Intro APR
          </label>
          <input
            type="text"
            name="introApr"
            value={formData.introApr}
            onChange={handleInputChange}
            placeholder="e.g., 0% for 15 months"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Regular APR <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="regularApr"
            value={formData.regularApr}
            onChange={handleInputChange}
            placeholder="e.g., 21.49% - 28.49%"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
              errors.regularApr ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.regularApr && (
            <p className="mt-1 text-sm text-red-600">{errors.regularApr}</p>
          )}
        </div>
      </div>

      {/* Rewards Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Rewards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rewards Rate
            </label>
            <input
              type="text"
              name="rewardsRate"
              value={formData.rewardsRate}
              onChange={handleInputChange}
              placeholder="e.g., 3% on dining, 2% on travel"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rewards Bonus
            </label>
            <input
              type="text"
              name="rewardsBonus"
              value={formData.rewardsBonus}
              onChange={handleInputChange}
              placeholder="e.g., 60,000 points after $4k spend"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            />
          </div>

          <CustomDropdown
            label="Rewards Type"
            placeholder="Select type..."
            value={formData.rewardsType}
            onChange={(value) => setFormData(prev => ({ ...prev, rewardsType: value as CardFormData['rewardsType'] }))}
            options={[
              {
                value: 'cashback',
                label: 'Cash Back',
                description: 'Earn money back on purchases',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                value: 'points',
                label: 'Points',
                description: 'Flexible rewards points',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ),
              },
              {
                value: 'miles',
                label: 'Miles',
                description: 'Travel rewards & airline miles',
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Rating & Credit Required */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Rating
          </label>
          {renderStarPicker()}
        </div>

        <CustomDropdown
          label="Credit Required"
          placeholder="Select credit level..."
          value={formData.creditRequired}
          onChange={(value) => setFormData(prev => ({ ...prev, creditRequired: value as CardFormData['creditRequired'] }))}
          options={[
            {
              value: 'Excellent',
              label: 'Excellent',
              description: 'Credit score 720+',
              icon: (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ),
            },
            {
              value: 'Good',
              label: 'Good',
              description: 'Credit score 670-719',
              icon: (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ),
            },
            {
              value: 'Fair',
              label: 'Fair',
              description: 'Credit score 580-669',
              icon: (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">~</span>
                </div>
              ),
            },
            {
              value: 'Poor',
              label: 'Poor',
              description: 'Credit score 300-579',
              icon: (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Pros & Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pros
            <span className="font-normal text-gray-500 ml-2">(one per line)</span>
          </label>
          <textarea
            name="pros"
            value={formData.pros}
            onChange={handleInputChange}
            rows={5}
            placeholder="No annual fee first year&#10;Great welcome bonus&#10;Flexible redemption options"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cons
            <span className="font-normal text-gray-500 ml-2">(one per line)</span>
          </label>
          <textarea
            name="cons"
            value={formData.cons}
            onChange={handleInputChange}
            rows={5}
            placeholder="High annual fee&#10;Foreign transaction fees&#10;Limited transfer partners"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Image
        </label>
        <ImageUpload
          value={formData.imageData}
          onChange={handleImageChange}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`
            px-8 py-3 rounded-xl font-semibold text-white transition-all
            ${isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : initialData ? (
            'Update Card'
          ) : (
            'Add Card'
          )}
        </button>
      </div>
    </form>
  );
}

export type { CardFormData };
