# Homepage video assets

Drop your `.mp4` files in **this folder**, then point the config at them. No
component changes are needed.

## 1. Add the file

```
frontend/public/videos/hero-network.mp4
```

Anything in `public/` is served from the site root, so that file is available at
`/videos/hero-network.mp4`.

## 2. Point the config at it

Edit `frontend/src/config/homeContent.js` and set the `video` field on the slide:

```js
export const HERO_SLIDES = [
  {
    id: 'network',
    ...
    video: '/videos/hero-network.mp4',   // <- was null
    poster: 'https://.../still.jpg',     // keep a poster: it is the fallback
  },
  ...
];
```

The same applies to `SHOWCASE_VIDEOS` (the "Stories Worth Remembering" section)
and `FINAL_CTA`.

## 3. Tune the behaviour (optional)

All timing and overlay settings live in `HERO_MEDIA` in the same file:

| Setting | Meaning |
|---|---|
| `rotationMs` | how long each slide holds before advancing |
| `fadeMs` | crossfade duration between slides |
| `overlaySide` / `overlayBottom` | gradient strength over the media |
| `preloadNext` | warm the next slide's video while the current plays |
| `showMuteControl` | offer an unmute button once a video is playing |
| `showProgress` | thin progress bar on the active slide indicator |

## Encoding guidance

Hero loops should be small — they load before anything else on the page.

```bash
ffmpeg -i source.mov \
  -vf "scale=1920:-2,fps=25" \
  -c:v libx264 -crf 26 -preset slow -profile:v high -pix_fmt yuv420p \
  -movflags +faststart \
  -an \
  hero-network.mp4
```

- **`-movflags +faststart`** matters: it moves the index to the front so playback
  can begin before the whole file arrives.
- **`-an`** strips audio. The hero is muted by default; dropping the track saves
  bandwidth. Keep audio only if you want the unmute button to be useful.
- Aim for **6–12 seconds** and **under ~3 MB** per hero loop.
- The video is `object-fit: cover`, so keep the subject near the centre — the
  edges get cropped at narrow viewport ratios.

## Fallback behaviour

A poster image is always painted underneath the video. If a file is missing,
fails to decode, or autoplay is blocked (common on mobile / low-power mode), the
still simply remains and the homepage works normally. `video: null` is a valid,
supported state — that is how the site ships today.
