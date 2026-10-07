# NewsNeta P0 Media Pipeline Audit

## Production evidence

The production News API was sampled on 2026-10-07 across Latest, Telangana,
Andhra Pradesh, Politics, Sports, Cinema, Technology and Business.

- More than 20 sampled articles had `originalUrl: ""`.
- Those articles were returned as `imageType: "branded_fallback"` with the
  NewsNeta logo as both `image` and `media.url`.
- The first four current Latest records all followed this path.
- Several other records were assigned technically loadable Wikimedia archive
  images that did not depict the reported event.
- The raw Google News RSS records contain a title, Google redirect, timestamp
  and publisher name, but no image or direct publisher media URL.
- No real video records are supplied by the public News API. The existing
  Shorts section is an image-card and speech-synthesis experience, not a video
  feed. Five or ten production videos therefore cannot be truthfully tested.

## Image failure

### Root cause

Missing upstream media was converted into a successful-looking branded image
inside the Netlify Function. The browser normalizer then had two more fallback
layers: category-based hardcoded stock images and the NewsNeta logo. This made
`MEDIA_URL_MISSING` indistinguishable from a valid article image.

### Affected code

- `netlify/functions/news.js`: `mediaDecision`, `brandedFallbackDecision`,
  `commonsImage` and `articleImage`.
- `index.html`: `extractSourceImage`, `chooseRelevantImage`, `normalizeItems`
  and `imageFallback`.

### Repair

- Canonical media remains `null` when the provider/feed has no associated
  image.
- The live-feed path no longer substitutes unrelated stock or archive images.
- RSS enclosure/media images are retained when supplied by the same article.
- Missing and failed media are rendered as explicit UI states only at the
  presentation layer.
- Headline and media are normalized on the same article object.

## Video failure

### Root cause

CMS fields existed for hosted and YouTube URLs, but public feed records did not
carry video data and article rendering did not have a canonical video model.
The Shorts play control invoked speech synthesis rather than video playback.

### Repair

- Article normalization now distinguishes uploaded MP4/WebM, YouTube, HLS and
  external video URLs.
- Article detail renders YouTube with a privacy-enhanced embed, direct video
  with native controls and `playsinline`, and external video as a safe link.
- The service worker bypasses video and Range requests.

### Remaining dependency

There are no current production video records or persistent uploaded video
storage, so playback, seek, Range and PWA-video acceptance tests remain blocked.

## Service worker

- News API remains network-first.
- Cache version is `v77`.
- Images use stale-while-revalidate only when the response is successful and
  has an `image/*` content type.
- Failed images are not cached.
- Video and Range requests are not cached or intercepted.
- Only obsolete NewsNeta caches are cleaned.

## Refresh

The refreshed API response is normalized as a complete article object, so a
new headline cannot retain the preceding story's image through separate state.

## Acceptance status

- Missing media is no longer disguised as a successful logo/stock image: PASS.
- Service-worker response lifecycle and cache policy: PASS in static analysis.
- Real provider-associated images: PASS only when the API/feed supplies one.
- New CMS image without redeployment: BLOCKED by absent canonical production
  CMS database and persistent object storage.
- Ten real videos: BLOCKED because production supplies no video records.
