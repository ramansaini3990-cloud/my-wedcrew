import { useState } from 'react';
import { MapPin, LocateFixed, Loader2, AlertCircle } from 'lucide-react';
import { selectClass, inputClass } from './formStyles';
import Field from './FormField';

/**
 * Cascading State -> City selector with an optional manual location and
 * browser geolocation capture.
 *
 * Controlled component: the parent owns `value` and receives `onChange`.
 * Changing the state clears a city that no longer belongs to it, so an invalid
 * state/city pair can never be submitted (the backend re-validates regardless).
 */
export default function LocationSelect({
  value,
  onChange,
  states = [],
  cities = [],
  loadCities,
  loadingLists,
  loadingCities,
  cityError,
  showManual = true,
  showGeolocation = true
}) {
  const [geoStatus, setGeoStatus] = useState({ loading: false, error: null, ok: false });

  const handleStateChange = async (stateId) => {
    // Reset the city whenever the state changes - it may not belong any more.
    onChange({ ...value, state_id: stateId, city_id: '' });
    await loadCities(stateId);
  };

  const handleManual = (field, fieldValue) => {
    onChange({
      ...value,
      manual_location: { ...(value.manual_location || {}), [field]: fieldValue }
    });
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus({ loading: false, ok: false, error: 'Your browser does not support location sharing.' });
      return;
    }
    setGeoStatus({ loading: true, ok: false, error: null });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange({
          ...value,
          manual_location: {
            ...(value.manual_location || {}),
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
            shared_from_device: true
          }
        });
        setGeoStatus({ loading: false, ok: true, error: null });
      },
      (err) => {
        const messages = {
          1: 'Location permission denied. You can still enter your location manually.',
          2: 'Your location is unavailable right now. Please enter it manually.',
          3: 'Location request timed out. Please enter it manually.'
        };
        setGeoStatus({ loading: false, ok: false, error: messages[err.code] || 'Could not read your location.' });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const clearCoordinates = () => {
    onChange({
      ...value,
      manual_location: {
        ...(value.manual_location || {}),
        latitude: null,
        longitude: null,
        shared_from_device: false
      }
    });
    setGeoStatus({ loading: false, ok: false, error: null });
  };

  const coords = value.manual_location || {};
  const hasCoords = coords.latitude != null && coords.longitude != null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="State" required>
          <select
            value={value.state_id || ''}
            onChange={(e) => handleStateChange(e.target.value)}
            className={selectClass}
            disabled={loadingLists}
          >
            <option value="">{loadingLists ? 'Loading states...' : 'Select state'}</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>

        <Field label="City" required>
          <select
            value={value.city_id || ''}
            onChange={(e) => onChange({ ...value, city_id: e.target.value })}
            className={selectClass}
            disabled={!value.state_id || loadingCities}
          >
            <option value="">
              {!value.state_id
                ? 'Select a state first'
                : loadingCities
                  ? 'Loading cities...'
                  : cities.length === 0
                    ? 'No cities found for this state'
                    : 'Select city'}
            </option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {cityError && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-brand-danger">
              <AlertCircle size={12} /> {cityError}
            </p>
          )}
        </Field>
      </div>

      {showManual && (
        <>
          <Field
            label="Exact / manual location"
            hint="Optional. Useful when your city does not describe where you actually work."
          >
            <input
              type="text"
              value={coords.address || ''}
              onChange={(e) => handleManual('address', e.target.value)}
              placeholder="e.g. 25 km outside Udaipur, near Nathdwara"
              className={inputClass}
            />
          </Field>

          <Field label="Landmark">
            <input
              type="text"
              value={coords.landmark || ''}
              onChange={(e) => handleManual('landmark', e.target.value)}
              placeholder="Optional landmark"
              className={inputClass}
            />
          </Field>
        </>
      )}

      {showGeolocation && (
        <div className="rounded-lg border border-brand-border bg-brand-bg p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <MapPin size={15} className="mt-0.5 shrink-0 text-brand-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-brand-navy">Pin your location</p>
                <p className="text-[11px] text-brand-textSec mt-0.5">
                  {hasCoords
                    ? `Saved: ${coords.latitude}, ${coords.longitude}`
                    : 'Optional. Only your city and state are shown publicly.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasCoords && (
                <button
                  type="button"
                  onClick={clearCoordinates}
                  className="px-2.5 py-1.5 text-[12px] font-medium text-brand-textSec hover:text-brand-danger transition-colors rounded-md"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={geoStatus.loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-primary/40 text-brand-primary text-[12px] font-semibold hover:bg-brand-primary/10 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {geoStatus.loading ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
                {geoStatus.loading ? 'Locating...' : hasCoords ? 'Update' : 'Use current location'}
              </button>
            </div>
          </div>

          {geoStatus.error && (
            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-brand-danger">
              <AlertCircle size={12} className="mt-0.5 shrink-0" /> {geoStatus.error}
            </p>
          )}
          {geoStatus.ok && (
            <p className="mt-2.5 text-[11px] text-green-700">Location captured. Save the form to store it.</p>
          )}
        </div>
      )}
    </div>
  );
}
