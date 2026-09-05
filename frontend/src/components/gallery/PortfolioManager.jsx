import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Trash2, Pencil, Star, ArrowUp, ArrowDown, ExternalLink, Upload, Link2,
  Loader2, X, EyeOff, AlertCircle, Image as ImageIcon, Film
} from 'lucide-react';
import api from '../../utils/api';
import { mediaUrl, sourceMeta, detectSource, validateMediaUrl } from '../../utils/mediaEmbed';
import MediaModal from './MediaModal';

/**
 * Freelancer portfolio management: gallery CRUD plus public social links.
 *
 * Reuses the existing profile API (`/api/profile/me`) for social links rather
 * than adding a parallel profile system, and the existing `api` axios client
 * for auth. Reordering uses explicit up/down controls: keyboard-accessible,
 * reliable on touch, and no drag-and-drop dependency.
 */

const CATEGORIES = ['Wedding', 'Pre-Wedding', 'Engagement', 'Reception', 'Destination', 'Drone', 'Portrait', 'Other'];

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstudio' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourstudio' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstudio' },
  { key: 'linkedin', label: 'LinkedIn (optional)', placeholder: 'https://linkedin.com/in/you' },
  { key: 'website', label: 'Website (optional)', placeholder: 'https://yourstudio.in' }
];

const emptyForm = { title: '', description: '', category: '', mode: 'url', url: '', file: null };

/* ================================================================== */
/* Add / edit form                                                     */
/* ================================================================== */
function ItemForm({ initial, onCancel, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(
    isEdit
      ? { ...emptyForm, title: initial.title, description: initial.description || '', category: initial.category || '', mode: 'keep' }
      : emptyForm
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [urlHint, setUrlHint] = useState(null);
  const fileRef = useRef(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const detected = form.url ? detectSource(form.url) : null;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) return setError('Give this work a title.');

    // Validate the URL before spending an upload/request round-trip.
    if (form.mode === 'url') {
      const problem = validateMediaUrl(form.url);
      if (problem) return setUrlHint(problem);
    }
    if (form.mode === 'file' && !form.file && !isEdit) return setError('Choose a file to upload.');

    setBusy(true);
    try {
      if (isEdit) {
        const body = { title: form.title, description: form.description, category: form.category };
        if (form.mode === 'url' && form.url.trim()) body.url = form.url.trim();
        const { data } = await api.put(`/api/gallery/${initial.id}`, body);
        onSaved(data.data, 'updated');
      } else if (form.mode === 'file') {
        // Two steps by design: the file is stored first, then the item row is
        // created referencing it, so a failed upload leaves no orphan record.
        const fd = new FormData();
        fd.append('file', form.file);
        const up = await api.post('/api/gallery/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const { data } = await api.post('/api/gallery', {
          title: form.title,
          description: form.description,
          category: form.category,
          media_url: up.data.data.url,
          media_type: up.data.data.media_type
        });
        onSaved(data.data, 'added');
      } else {
        const { data } = await api.post('/api/gallery', {
          title: form.title,
          description: form.description,
          category: form.category,
          url: form.url.trim()
        });
        onSaved(data.data, 'added');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this item.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-navy placeholder-brand-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20';

  return (
    <form onSubmit={submit} className="rounded-xl border border-brand-primary/30 bg-brand-surface p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-bold text-brand-navy">{isEdit ? 'Edit item' : 'Add to gallery'}</h4>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="text-brand-textSec hover:text-brand-primary">
          <X size={16} />
        </button>
      </div>

      {/* Source mode */}
      {!isEdit && (
        <div className="flex gap-2">
          {[
            { id: 'url', label: 'Video link', icon: Link2 },
            { id: 'file', label: 'Upload file', icon: Upload }
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => set('mode', opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                form.mode === opt.id
                  ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                  : 'border-brand-border text-brand-textSec hover:border-brand-primary/40'
              }`}
            >
              <opt.icon size={13} aria-hidden="true" /> {opt.label}
            </button>
          ))}
        </div>
      )}

      {(form.mode === 'url' || (isEdit && form.mode !== 'file')) && (
        <div>
          <label htmlFor="gallery-url" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
            {isEdit ? 'Replace video link (optional)' : 'YouTube, Instagram or Vimeo link'}
          </label>
          <input
            id="gallery-url"
            type="url"
            value={form.url}
            onChange={(e) => { set('url', e.target.value); setUrlHint(null); }}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputCls}
          />
          <div className="mt-1 flex items-center gap-2 min-h-[16px]">
            {urlHint && <span className="text-[11.5px] text-brand-danger">{urlHint}</span>}
            {!urlHint && detected && (
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${sourceMeta(detected).className}`}>
                {sourceMeta(detected).label} detected
              </span>
            )}
          </div>
        </div>
      )}

      {form.mode === 'file' && !isEdit && (
        <div>
          <label htmlFor="gallery-file" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">
            Image or video file
          </label>
          <input
            id="gallery-file"
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime"
            onChange={(e) => set('file', e.target.files?.[0] || null)}
            className="block w-full text-[12.5px] text-brand-textSec file:mr-3 file:rounded-lg file:border-0 file:bg-brand-primary/10 file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-brand-primary hover:file:bg-brand-primary/15"
          />
          <p className="mt-1 text-[11px] text-brand-textSec">Images up to 8 MB, videos up to 100 MB.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="gallery-title" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Title</label>
          <input id="gallery-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} className={inputCls} placeholder="Sharma Wedding Highlights" />
        </div>
        <div>
          <label htmlFor="gallery-category" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Category</label>
          <select id="gallery-category" value={form.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="gallery-desc" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">Description (optional)</label>
        <textarea id="gallery-desc" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} className={inputCls} />
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-brand-danger">
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark disabled:opacity-60"
        >
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add to gallery'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-navy hover:border-brand-primary hover:text-brand-primary transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ================================================================== */
/* Social links                                                        */
/* ================================================================== */
function SocialLinks({ value, onSaved }) {
  const [links, setLinks] = useState(value || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => setLinks(value || {}), [value]);

  const save = async () => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const { data } = await api.put('/api/profile/me', { social_links: links });
      setMsg('Social links saved.');
      onSaved?.(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save social links.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">Public social links</h3>
      <p className="mt-1 text-[12px] text-brand-textSec">
        Public profile URLs only — never your password.
      </p>

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SOCIAL_FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`social-${f.key}`} className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-brand-textSec">{f.label}</label>
            <input
              id={`social-${f.key}`}
              type="url"
              value={links[f.key] || ''}
              onChange={(e) => setLinks((l) => ({ ...l, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[13px] text-brand-navy placeholder-brand-muted focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-primaryDark transition-colors disabled:opacity-60">
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Save links
        </button>
        {msg && <span className="text-[12px] font-medium text-green-700">{msg}</span>}
        {error && <span className="text-[12px] text-brand-danger">{error}</span>}
      </div>
    </section>
  );
}

/* ================================================================== */
/* Main                                                                */
/* ================================================================== */
export default function PortfolioManager({ profile, onProfileChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/gallery/me');
      setItems(data.data || []);
      setError(null);
    } catch {
      setError('Could not load your gallery.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(null), 2500); };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/gallery/${item.id}`);
      setItems((list) => list.filter((i) => i.id !== item.id));
      flash('Item deleted.');
    } catch {
      flash('Could not delete that item.');
    }
  };

  const toggleFeature = async (item) => {
    try {
      const { data } = await api.patch(`/api/gallery/${item.id}/feature`, { featured: !item.featured });
      setItems((list) => list.map((i) => (i.id === item.id ? data.data : i)));
    } catch {
      flash('Could not update that item.');
    }
  };

  /** Optimistic move, then persist the whole order. */
  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    try {
      await api.patch('/api/gallery/reorder', { order: next.map((i) => i.id) });
    } catch {
      flash('Could not save the new order.');
      load();
    }
  };

  const freelancerId = profile?.id || profile?._id;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-brand-navy">Portfolio</h2>
          <p className="mt-0.5 text-[12.5px] text-brand-textSec">
            Showcase your work. This is what companies see on your public profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {freelancerId && (
            <Link
              to={`/professionals/${freelancerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border px-3.5 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary"
            >
              <ExternalLink size={14} aria-hidden="true" /> Preview public profile
            </Link>
          )}
          {!adding && !editing && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-primaryDark"
            >
              <Plus size={15} aria-hidden="true" /> Add work
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-[12.5px] text-brand-navy">{notice}</p>
      )}

      {adding && (
        <ItemForm
          onCancel={() => setAdding(false)}
          onSaved={(item) => { setItems((l) => [...l, item]); setAdding(false); flash('Added to your gallery.'); }}
        />
      )}
      {editing && (
        <ItemForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={(item) => { setItems((l) => l.map((i) => (i.id === item.id ? item : i))); setEditing(null); flash('Item updated.'); }}
        />
      )}

      {/* Gallery list */}
      <section className="rounded-xl border border-brand-border bg-brand-surface p-4 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-textSec">
          My gallery {items.length > 0 && <span className="tabular-nums">({items.length})</span>}
        </h3>

        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-brand-textSec">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading…
          </p>
        ) : error ? (
          <p className="mt-3 text-[13px] text-brand-danger">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-[13px] text-brand-textSec">
            Nothing here yet. Add photos, upload a showreel, or paste a YouTube/Instagram link.
          </p>
        ) : (
          <ul className="mt-3.5 space-y-2.5">
            {items.map((item, index) => {
              const meta = sourceMeta(item.source_type);
              const thumb =
                item.thumbnail_url || (item.source_type === 'upload' && item.media_type === 'image' ? item.media_url : null);

              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-2.5 sm:flex-nowrap ${
                    item.is_hidden ? 'border-brand-danger/30 bg-brand-danger/5' : 'border-brand-border bg-brand-bg'
                  }`}
                >
                  {/* Thumb */}
                  <button
                    type="button"
                    onClick={() => setPreview(item)}
                    className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    aria-label={`Preview ${item.title}`}
                  >
                    {thumb ? (
                      <img src={mediaUrl(thumb)} alt="" aria-hidden="true" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        {item.media_type === 'video'
                          ? <Film size={16} className="text-white/50" aria-hidden="true" />
                          : <ImageIcon size={16} className="text-white/50" aria-hidden="true" />}
                      </span>
                    )}
                  </button>

                  {/* Meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-brand-navy">{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-brand-textSec">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-semibold ${meta.className}`}>{meta.label}</span>
                      {item.category && <span className="truncate">{item.category}</span>}
                      {item.featured && <span className="font-semibold text-brand-primary">Featured</span>}
                      {item.is_hidden && (
                        <span className="inline-flex items-center gap-1 font-semibold text-brand-danger">
                          <EyeOff size={10} aria-hidden="true" /> Hidden by admin
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" title="Move up"
                      className="rounded-md p-1.5 text-brand-textSec transition-colors hover:bg-brand-primary/10 hover:text-brand-primary disabled:opacity-30 disabled:hover:bg-transparent">
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down" title="Move down"
                      className="rounded-md p-1.5 text-brand-textSec transition-colors hover:bg-brand-primary/10 hover:text-brand-primary disabled:opacity-30 disabled:hover:bg-transparent">
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => toggleFeature(item)} aria-label={item.featured ? 'Unfeature' : 'Feature'} title={item.featured ? 'Unfeature' : 'Mark as featured'} aria-pressed={item.featured}
                      className={`rounded-md p-1.5 transition-colors hover:bg-brand-primary/10 ${item.featured ? 'text-brand-primary' : 'text-brand-textSec hover:text-brand-primary'}`}>
                      <Star size={14} className={item.featured ? 'fill-current' : ''} />
                    </button>
                    <button onClick={() => setEditing(item)} aria-label="Edit" title="Edit"
                      className="rounded-md p-1.5 text-brand-textSec transition-colors hover:bg-brand-primary/10 hover:text-brand-primary">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => remove(item)} aria-label="Delete" title="Delete"
                      className="rounded-md p-1.5 text-brand-textSec transition-colors hover:bg-brand-danger/10 hover:text-brand-danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SocialLinks value={profile?.social_links} onSaved={onProfileChange} />

      <MediaModal item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
