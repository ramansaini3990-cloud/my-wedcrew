import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import api from '../../utils/api';
import useMasterData from '../../hooks/useMasterData';
import Avatar from '../ui/Avatar';
import LocationSelect from './LocationSelect';
import { selectClass, inputClass } from './formStyles';
import Field from './FormField';

/**
 * Profile editor shared by the Freelancer and Company dashboards.
 *
 * Profession / state / city are chosen from Admin-managed master data - they
 * are never free text. Everything is re-validated by the backend on save.
 */
export default function ProfileForm({ role = 'freelancer', onSaved }) {
  const isCompany = role === 'company';

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type, message }

  const master = useMasterData(form?.state_id || null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get('/api/profile/me');
        if (cancelled) return;
        const data = res.data?.data || {};
        setForm({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          profession_id: data.profession_id || '',
          state_id: data.state_id || '',
          city_id: data.city_id || '',
          profile_picture: data.profile_picture || '',
          bio: data.bio || '',
          experience_years: data.experience_years ?? '',
          equipment: (data.equipment || []).join(', '),
          manual_location: data.manual_location || {},
          legacy: {
            profession: data.profession || '',
            state: data.state || '',
            city: data.city || ''
          },
          needs_master_review: Boolean(data.needs_master_review)
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load profile', err);
        setLoadError('Unable to load your profile. Please refresh and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        bio: form.bio,
        profile_picture: form.profile_picture,
        manual_location: form.manual_location,
        profession_id: form.profession_id || null,
        state_id: form.state_id || null,
        city_id: form.city_id || null
      };

      if (!isCompany) {
        payload.experience_years = form.experience_years === '' ? null : form.experience_years;
        payload.equipment = form.equipment
          ? form.equipment.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
      }

      const res = await api.put('/api/profile/me', payload);
      const data = res.data?.data;

      setFeedback({ type: 'success', message: res.data?.message || 'Profile updated successfully.' });
      if (data) {
        update({
          needs_master_review: Boolean(data.needs_master_review),
          legacy: { profession: data.profession, state: data.state, city: data.city }
        });
      }
      if (onSaved) onSaved(data);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Could not save your profile. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="bg-brand-surface rounded-xl border border-brand-border p-6 animate-pulse space-y-4">
        <div className="h-4 w-40 bg-brand-bg rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 bg-brand-bg rounded" />)}
        </div>
        <div className="h-24 bg-brand-bg rounded" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-brand-surface rounded-xl border border-brand-border p-8 text-center">
        <AlertCircle size={22} className="mx-auto text-brand-danger mb-2" />
        <p className="text-[14px] font-semibold text-brand-navy">{loadError}</p>
      </div>
    );
  }

  const selectedProfessionMissing =
    form.profession_id && !master.professions.some((p) => p.id === form.profession_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Migration notice - a legacy value could not be matched */}
      {form.needs_master_review && (
        <div className="flex items-start gap-2.5 rounded-lg border border-yellow-200 bg-yellow-50 p-3.5">
          <Info size={15} className="mt-0.5 shrink-0 text-yellow-700" aria-hidden="true" />
          <div className="text-[13px] text-yellow-800">
            <p className="font-semibold">Please confirm your details</p>
            <p className="mt-0.5">
              Some of your saved values{form.legacy.profession ? ` (e.g. "${form.legacy.profession}")` : ''} predate our
              updated lists. Pick the closest options below and save - nothing has been lost.
            </p>
          </div>
        </div>
      )}

      {master.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-brand-danger">
          <AlertCircle size={15} /> {master.error}
        </div>
      )}

      {/* Identity */}
      <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-brand-textSec mb-4">
          {isCompany ? 'Company details' : 'Personal details'}
        </h3>

        <div className="flex items-start gap-4 mb-5">
          <Avatar user={{ name: form.name, profile_picture: form.profile_picture }} size="xl" fallback={isCompany ? 'C' : 'F'} />
          <div className="flex-1 min-w-0">
            <Field label={isCompany ? 'Logo image URL' : 'Profile photo URL'} hint="Paste an image link. Leave empty to show your initials.">
              <input
                type="url"
                value={form.profile_picture}
                onChange={(e) => update({ profile_picture: e.target.value })}
                placeholder="https://..."
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={isCompany ? 'Company / production house name' : 'Full name'} required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Email" hint="Contact support to change your sign-in email.">
            <input type="email" value={form.email} className={`${inputClass} bg-brand-bg text-brand-muted`} disabled readOnly />
          </Field>

          <Field label="Phone" required>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
              className={inputClass}
              required
            />
          </Field>

          <Field label={isCompany ? 'Business category' : 'Profession'} required>
            <select
              value={form.profession_id || ''}
              onChange={(e) => update({ profession_id: e.target.value })}
              className={selectClass}
              disabled={master.loadingLists}
            >
              <option value="">
                {master.loadingLists
                  ? 'Loading professions...'
                  : master.professions.length === 0
                    ? 'No professions available'
                    : 'Select from the list'}
              </option>
              {/* Keep an existing selection visible even if it was deactivated */}
              {selectedProfessionMissing && form.legacy.profession && (
                <option value={form.profession_id}>{form.legacy.profession} (current)</option>
              )}
              {master.professions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Location */}
      <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-brand-textSec mb-4">
          Base location
        </h3>
        <LocationSelect
          value={form}
          onChange={(next) => update(next)}
          states={master.states}
          cities={master.cities}
          loadCities={master.loadCities}
          loadingLists={master.loadingLists}
          loadingCities={master.loadingCities}
          cityError={master.cityError}
        />
      </section>

      {/* About */}
      <section className="bg-brand-surface rounded-xl border border-brand-border p-5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-brand-textSec mb-4">
          {isCompany ? 'About the company' : 'About you'}
        </h3>

        <div className="space-y-4">
          <Field label={isCompany ? 'Company description' : 'Professional bio'}>
            <textarea
              value={form.bio}
              onChange={(e) => update({ bio: e.target.value })}
              rows="4"
              maxLength={2000}
              placeholder={isCompany ? 'Tell crew about your production house...' : 'Tell companies about your work...'}
              className={`${inputClass} h-auto py-2.5 resize-none custom-scrollbar`}
            />
          </Field>

          {!isCompany && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Experience (years)">
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={form.experience_years}
                  onChange={(e) => update({ experience_years: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Equipment" hint="Comma separated.">
                <input
                  type="text"
                  value={form.equipment}
                  onChange={(e) => update({ equipment: e.target.value })}
                  placeholder="Sony FX3, DJI Ronin, Mavic 3"
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </div>
      </section>

      {/* Feedback + submit */}
      {feedback && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-[13px] ${
            feedback.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-brand-danger'
          }`}
          role="status"
        >
          {feedback.type === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-white text-[13px] font-semibold hover:bg-brand-primaryDark transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
