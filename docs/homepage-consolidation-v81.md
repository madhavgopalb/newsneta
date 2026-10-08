# NewsNeta v81 Homepage Consolidation

## Root cause

The standalone-looking Andhra Pradesh module was not a separate application, CMS widget, or database table. `#andhraPradeshNews` and `#telanganaNews` were populated by `loadHomepageFeeds()` and rendered through the same `editorialSectionMarkup()` function. That function always produced a large lead image, lead article, supporting image list, and category heading. Combined with internal `max-height` scrolling on homepage feeds, the state section appeared as an oversized independent live-feed application.

## Repair

- State previews now use a compact shared renderer with at most five canonical stories and a View All action.
- Andhra Pradesh and Telangana feeds, navigation, districts, CMS category placement, and full category loading remain available.
- Homepage lists use natural document scrolling; internal Latest and headline-feed scroll containers were removed.
- CMS-published articles are merged before RSS items and deduplicated using stable article identity.
- Generic promotional fallback stories were removed from the reader homepage and assistant corpus.
- Missing or rejected media produces a text-only card. Editor media, provider media, RSS-associated media, and sufficiently relevant licensed archive media remain supported.
- Telugu mixed-prefix cleanup removes short arbitrary English prefixes before a Telugu headline.
- Feed publisher and original publication time are retained for attribution.
- Generated filler summaries are no longer substituted when verified source text is unavailable.
- The live news API remains network-first in the v81 service worker with cache fallback only after network failure.
