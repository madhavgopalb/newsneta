# NewsNeta P0 Production Repair

## Actual architecture

NewsNeta is currently a static HTML/JavaScript site on Netlify. It is not a
Next.js or React application. Public news is supplied by the Netlify Function
`/.netlify/functions/news`; `/api/news` redirects to the same function.

The newsroom CMS currently persists articles in browser `localStorage`. The
production Netlify site has no `DATABASE_URL`; only `GEMINI_API_KEY` is
configured. Consequently there is no production articles table to query and a
CMS-published article cannot propagate between devices. This is an identified
architecture gap, not a feed-filter bug.

## Endpoint diagnostics

| Endpoint | Purpose | Expected response |
| --- | --- | --- |
| `/.netlify/functions/news?cat=latest` | Lead, Latest, Today's Edition | HTTP 200, `{ status, items[] }` |
| `/.netlify/functions/news?cat=telangana` | Telangana section | HTTP 200, newest first |
| `/.netlify/functions/news?cat=ap` | Andhra Pradesh section | HTTP 200, newest first |
| `/.netlify/functions/news?cat=<category>` | Category blocks | HTTP 200, newest first |
| `/.netlify/functions/news?cat=<state>&district=<district>` | District feed | HTTP 200, newest first |

## Root causes and repairs

1. A stalled browser fetch had no timeout, so initial loading text could remain
   indefinitely. All news calls now use a shared, abortable, validated fetch.
2. Refresh previously fanned out forced requests for the active feed and every
   category simultaneously. The active feed is now refreshed first and category
   blocks update in a bounded background queue.
3. Transient errors replaced existing stories with empty arrays. Current content
   is now retained and the user receives a non-blocking freshness message.
4. Timestamped refresh URLs prevented useful PWA API fallback. The service worker
   now uses a stable network-first API cache key while retaining cache busting for
   successful manual refreshes.
5. Image fields varied between feed and CMS-shaped records. One normalizer now
   resolves source media, absolute/HTTPS URLs, and the local NewsNeta fallback.

## Remaining production dependency

Cross-device reporter publishing requires a real database, object storage, and
server-side authenticated CMS endpoints. Until those exist, the public RSS/GNews
pipeline can be verified end to end, but the browser-local CMS cannot satisfy a
database-to-homepage publication acceptance test.
