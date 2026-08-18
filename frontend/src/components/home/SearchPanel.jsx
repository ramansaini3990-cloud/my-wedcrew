import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Camera, Calendar } from 'lucide-react';
import { SEARCH_CATEGORIES, SEARCH_CITIES } from '../../config/homeContent';

/**
 * Premium hero search.
 *
 * Submits to the EXISTING professionals page (`/freelancers`) via query
 * parameters, which that page reads into its own filter state. No duplicate
 * search logic and no new endpoint.
 */
export default function SearchPanel({ cities = [] }) {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('');

  // Live cities from the API, merged with the curated list, de-duplicated.
  const cityOptions = Array.from(new Set([...cities, ...SEARCH_CITIES])).sort();

  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (category) params.set('profession', category);
    if (city) params.set('city', city);
    if (date) params.set('date', date);
    navigate(`/freelancers${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const fieldWrap =
    'flex items-center gap-2.5 px-3 h-12 bg-white border border-brand-border rounded-lg focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-shadow';
  const control =
    'w-full bg-transparent text-[14px] text-brand-navy focus:outline-none appearance-none cursor-pointer';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/95 backdrop-blur-md border border-brand-border rounded-xl shadow-[0_18px_50px_-20px_rgba(11,24,53,0.45)] p-4 sm:p-5"
      aria-label="Find professionals"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-textSec mb-3">
        What are you looking for?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_auto] gap-2.5">
        <div className={fieldWrap}>
          <Camera size={16} className="text-brand-primary shrink-0" aria-hidden="true" />
          <label htmlFor="search-category" className="sr-only">Category</label>
          <select
            id="search-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={control}
          >
            <option value="">All categories</option>
            {SEARCH_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className={fieldWrap}>
          <MapPin size={16} className="text-brand-primary shrink-0" aria-hidden="true" />
          <label htmlFor="search-city" className="sr-only">City</label>
          <select
            id="search-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={control}
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className={fieldWrap}>
          <Calendar size={16} className="text-brand-primary shrink-0" aria-hidden="true" />
          <label htmlFor="search-date" className="sr-only">Event date (optional)</label>
          <input
            id="search-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${control} cursor-pointer`}
          />
        </div>

        <button
          type="submit"
          className="h-12 px-6 rounded-lg bg-brand-navy text-white text-sm font-semibold hover:bg-brand-primary transition-colors inline-flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <Search size={16} aria-hidden="true" />
          <span className="whitespace-nowrap">Find Professionals</span>
        </button>
      </div>
    </form>
  );
}
