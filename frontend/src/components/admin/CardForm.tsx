import { useState, useEffect, useCallback } from 'react';
import { ImageUpload } from './ImageUpload';
import type { CreditCard } from '../../types/creditCard';

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rewards Type
            </label>
            <select
              name="rewardsType"
              value={formData.rewardsType}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
            >
              <option value="">Select type...</option>
              <option value="cashback">Cash Back</option>
              <option value="points">Points</option>
              <option value="miles">Miles</option>
            </select>
          </div>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Credit Required
          </label>
          <select
            name="creditRequired"
            value={formData.creditRequired}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">Select credit level...</option>
            <option value="Excellent">Excellent (720+)</option>
            <option value="Good">Good (670-719)</option>
            <option value="Fair">Fair (580-669)</option>
            <option value="Poor">Poor (300-579)</option>
          </select>
        </div>
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
