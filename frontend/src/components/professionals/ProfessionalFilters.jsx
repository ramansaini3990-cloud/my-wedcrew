import { Plane } from 'lucide-react';

/**
 * The professional-search filter bar, shared by the public /freelancers page
 * and the company dashboard's Find Crew tab.
 *
 * Extracted so the two surfaces offer the SAME filters. They previously would
 * have diverged the moment either gained an option the other lacked - the
 * travel toggle is exactly that case: the API has always supported
 * `include_travel`, but no UI exposed it.
 *
 * Options come from admin-managed master data via useMasterData; nothing here
 * is hardcoded.
 */
const selectClass =
  'bg-brand-surface border border-brand-border rounded-lg px-3 h-11 text-[13px] text-brand-navy focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 disabled:bg-brand-bg disabled:text-brand-muted';

export default function ProfessionalFilters({
  filters,
  master,
  onFilterChange,
  onIncludeTravelChange,
  onClear,
  hasFilters,
  resultSummary = null
}) {
  const handleState = async (e) => {
    const stateId = e.target.value;
    onFilterChange('state_id', stateId);
    await master.loadCities(stateId);
  };

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={filters.profession_id}
          onChange={(e) => onFilterChange('profession_id', e.target.value)}
          aria-label="Profession"
          className={selectClass}
          disabled={master.loadingLists}
        >
          <option value="">{master.loadingLists ? 'Loading…' : 'All professions'}</option>
          {master.professions.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={filters.state_id}
          onChange={handleState}
          aria-label="State"
          className={selectClass}
          disabled={master.loadingLists}
        >
          <option value="">All states</option>
          {master.states.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={filters.city_id}
          onChange={(e) => onFilterChange('city_id', e.target.value)}
          aria-label="City"
          className={selectClass}
          disabled={!filters.state_id || master.loadingCities}
        >
          <option value="">
            {!filters.state_id ? 'Select a state first' : master.loadingCities ? 'Loading cities…' : 'All cities'}
          </option>
          {master.cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.date}
          onChange={(e) => onFilterChange('date', e.target.value)}
          aria-label="Available on date"
          className={selectClass}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-brand-textSec">
          <input
            type="checkbox"
            checked={filters.include_travel}
            onChange={(e) => onIncludeTravelChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand-primary"
          />
          <Plane size={13} aria-hidden="true" />
          Include professionals travelling to the selected city
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[12px] font-semibold text-brand-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {resultSummary && (
        <p className="mt-2 text-[12px] text-brand-textSec">{resultSummary}</p>
      )}
    </div>
  );
}
