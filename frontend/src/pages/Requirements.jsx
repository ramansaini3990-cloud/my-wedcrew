import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ClipboardList, Search } from 'lucide-react';
import api from '../utils/api';
import RequirementCard from '../components/RequirementCard';
import useMasterData from '../hooks/useMasterData';
import { resultGridClass } from '../utils/publicFormat';

// Categories, states and cities come from Admin-managed master data via
// useMasterData() - there is no hardcoded list here.

const controlClass =
  'w-full bg-brand-surface border border-brand-border rounded-lg px-3 h-11 text-[13px] text-brand-navy placeholder-brand-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 transition-shadow disabled:bg-brand-bg disabled:text-brand-muted';

const Requirements = () => {
  const [searchParams] = useSearchParams();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [filters, setFilters] = useState({
    city: searchParams.get('city') || '',
    category: searchParams.get('category') || '',
    date: searchParams.get('date') || '',
    state_id: searchParams.get('state_id') || '',
    city_id: searchParams.get('city_id') || ''
  });

  const master = useMasterData(searchParams.get('state_id') || null);

  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const queryParams = new URLSearchParams();
      // The requirements API filters on the denormalised city/category strings,
      // so the selected master records are sent by name.
      if (filters.city) queryParams.append('city', filters.city);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.date) queryParams.append('date', filters.date);

      const res = await api.get(`/api/requirements?${queryParams.toString()}`);
      setRequirements(res.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch requirements', error);
      setLoadError(true);
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRequirements();
  }, [fetchRequirements]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  /** Changing the state clears a city that no longer belongs to it. */
  const handleStateChange = async (e) => {
    const stateId = e.target.value;
    setFilters((f) => ({ ...f, state_id: stateId, city_id: '', city: '' }));
    await master.loadCities(stateId);
  };

  /** City is selected by master record; its name drives the API filter. */
  const handleCityChange = (e) => {
    const cityId = e.target.value;
    const city = master.cities.find((c) => c.id === cityId);
    setFilters((f) => ({ ...f, city_id: cityId, city: city ? city.name : '' }));
  };

  const hasFilters = filters.city || filters.category || filters.date || filters.state_id;

  const clearFilters = () =>
    setFilters({ city: '', category: '', date: '', state_id: '', city_id: '' });

  return (
    <div className="bg-brand-bg min-h-screen pt-24 pb-16">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary mb-3">
            Open Roles
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-brand-navy leading-tight">
            Hiring <span className="text-brand-primary italic">Requirements</span>
          </h1>
          <p className="mt-3 text-[15px] text-brand-textSec leading-relaxed">
            Jobs posted by production houses and wedding companies. Filter by category, city and date.
          </p>
        </header>

        {/* Filters */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              aria-label="Category"
              className={controlClass}
              disabled={master.loadingLists}
            >
              <option value="">
                {master.loadingLists ? 'Loading categories...' : 'All categories'}
              </option>
              {master.professions.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>

            <select
              name="state_id"
              value={filters.state_id}
              onChange={handleStateChange}
              aria-label="State"
              className={controlClass}
              disabled={master.loadingLists}
            >
              <option value="">All states</option>
              {master.states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              name="city_id"
              value={filters.city_id}
              onChange={handleCityChange}
              aria-label="City"
              className={controlClass}
              disabled={!filters.state_id || master.loadingCities}
            >
              <option value="">
                {!filters.state_id
                  ? 'Select a state first'
                  : master.loadingCities
                    ? 'Loading cities...'
                    : 'All cities'}
              </option>
              {master.cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <input
              type="date"
              name="date"
              value={filters.date}
              onChange={handleFilterChange}
              aria-label="Event date"
              className={controlClass}
            />
          </div>

          {hasFilters && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-brand-textSec">
                Showing requirements matching your filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 text-[12px] font-semibold text-brand-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="rounded-xl border border-brand-border bg-white p-5 animate-pulse">
                <div className="h-3 w-20 rounded bg-brand-bg" />
                <div className="mt-3 h-4 w-2/3 rounded bg-brand-bg" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-brand-bg" />
                  <div className="h-3 w-1/3 rounded bg-brand-bg" />
                </div>
                <div className="mt-5 h-9 w-full rounded bg-brand-bg" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-12 text-center">
            <AlertCircle size={24} className="mx-auto text-brand-danger mb-3" aria-hidden="true" />
            <p className="text-[15px] font-semibold text-brand-navy">Unable to load requirements.</p>
            <p className="mt-1 text-[13px] text-brand-textSec">Please check your connection and try again.</p>
            <button
              onClick={fetchRequirements}
              className="mt-5 px-4 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && requirements.length === 0 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface p-14 text-center">
            <ClipboardList size={26} className="mx-auto text-brand-textSec/40 mb-3" aria-hidden="true" />
            <p className="text-[16px] font-semibold text-brand-navy">No hiring requirements found</p>
            <p className="mt-1.5 text-[13px] text-brand-textSec max-w-sm mx-auto">
              Try changing your filters or check back later.
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-brand-border text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors"
              >
                <Search size={14} aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {!loading && !loadError && requirements.length > 0 && (
          <div className={resultGridClass(requirements.length)}>
            {requirements.map((req) => (
              <RequirementCard key={req.id || req._id} req={req} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Requirements;
