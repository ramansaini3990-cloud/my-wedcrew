import { useState } from 'react';
import { Play, Image as ImageIcon, Star, Film } from 'lucide-react';
import { mediaUrl, sourceMeta } from '../../utils/mediaEmbed';
import MediaModal from './MediaModal';

/**
 * Public portfolio gallery.
 *
 * Performance: a card renders a thumbnail only. No iframe, no <video> and no
 * player of any kind exists until an item is opened, so a large portfolio
 * costs a handful of lazily-loaded images. `loading="lazy"` defers off-screen
 * thumbnails, and "Show more" caps the initial DOM size.
 */

/** Branded placeholder for sources that publish no usable thumbnail. */
function Placeholder({ item }) {
  const meta = sourceMeta(item.source_type);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-brand-navy to-brand-navy/85">
      {item.media_type === 'video' ? (
        <Film size={22} className="text-white/45" aria-hidden="true" />
      ) : (
        <ImageIcon size={22} className="text-white/45" aria-hidden="true" />
      )}
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-white/55">{meta.label}</span>
    </div>
  );
}

function GalleryCard({ item, onOpen }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const meta = sourceMeta(item.source_type);
  const isVideo = item.media_type === 'video';

  // Uploaded images are their own thumbnail; everything else needs one supplied.
  const thumb =
    item.thumbnail_url || (item.source_type === 'upload' && item.media_type === 'image' ? item.media_url : null);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative block w-full overflow-hidden rounded-xl border border-brand-border bg-brand-surface text-left transition-all hover:border-brand-primary/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      aria-label={`Open ${item.title}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-bg">
        {thumb && !thumbFailed ? (
          <img
            src={mediaUrl(thumb)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            onError={() => setThumbFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <Placeholder item={item} />
        )}

        {/* Play affordance for anything playable */}
        {isVideo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform duration-300 group-hover:scale-110">
              <Play size={17} className="ml-0.5 text-brand-navy" aria-hidden="true" />
            </span>
          </span>
        )}

        {/* Source badge */}
        <span
          className={`absolute left-2 top-2 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}
        >
          {meta.label}
        </span>

        {item.featured && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-brand-primary/30 bg-brand-primary/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Star size={9} className="fill-current" aria-hidden="true" /> Featured
          </span>
        )}
      </div>

      <div className="px-3 py-2.5">
        <p className="truncate text-[13px] font-semibold text-brand-navy">{item.title}</p>
        {item.category && <p className="mt-0.5 truncate text-[11.5px] text-brand-textSec">{item.category}</p>}
      </div>
    </button>
  );
}

export default function GalleryGrid({ items = [], initialCount = 9, emptyMessage }) {
  const [active, setActive] = useState(null);
  const [visible, setVisible] = useState(initialCount);

  if (!items.length) {
    return (
      <p className="text-[13px] text-brand-textSec">
        {emptyMessage || 'No portfolio work has been published yet.'}
      </p>
    );
  }

  const shown = items.slice(0, visible);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((item) => (
          <GalleryCard key={item.id} item={item} onOpen={setActive} />
        ))}
      </div>

      {visible < items.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + initialCount)}
            className="rounded-lg border border-brand-border px-4 py-2 text-[13px] font-semibold text-brand-navy transition-colors hover:border-brand-primary hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Show more ({items.length - visible})
          </button>
        </div>
      )}

      <MediaModal item={active} onClose={() => setActive(null)} />
    </>
  );
}
