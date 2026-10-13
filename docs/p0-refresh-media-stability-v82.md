# NewsNeta P0 Refresh and Media Stability Report

Date: 2026-10-13
Release: v82

## Root causes

1. Public news was fetched directly from providers for each visitor. A database schema existed, but no scheduled ingestion function persisted feed articles or health records.
2. The News function accepted `cat` only. Requests using the documented `category` parameter silently fell back to Telangana, producing repeated category content and misleading image/category associations.
3. Refresh used one five-minute browser timer for active and background sections. Hidden and offline tabs continued entering the refresh coordinator.
4. RSS/provider normalization did not deduplicate equivalent headlines before serialization.
5. When an RSS/provider item lacked same-article media, the runtime could select a Wikimedia archive candidate. Even labelled file photos are not acceptable when semantic article ownership cannot be proven.
6. The CMS and uploaded media remain browser-local prototype state. Cross-device CMS publication and durable uploads are not production-complete until the CMS uses the database API and object storage.

## Implemented repair

- Added a five-minute Netlify scheduled ingestion function.
- Added PostgreSQL advisory locking to prevent overlapping runs.
- Added bounded retry and bounded provider concurrency.
- Added stable provider identity, canonical source URL, source timestamp, featured-media metadata and idempotent upserts.
- Added ingestion run status, duration, fetched/inserted/updated/rejected counts and provider errors.
- Added database-first public API reads with live provider fallback.
- Added `cat` and `category` compatibility plus category aliases.
- Added feed deduplication before API serialization.
- Limited automatic images to CMS/persisted media, licensed provider media on the same record, or RSS media on the same item.
- Missing and failed media now persist as `featuredMedia: null` and render text-first.
- Added HTTP/MIME validation before media persistence.
- Added two-minute active-news refresh, five-minute category refresh, hidden/offline pause and manual cache bypass.
- Bumped the PWA cache to v82; dynamic news remains network-first and unsuccessful responses are not cached as valid content.
- Added a token-protected Admin production-health endpoint and CMS health viewer.

## Automated evidence

- `npm test`: 7/7 passed.
- News function, ingestion function, health function and service worker syntax checks passed.
- Inline application script parsing passed.
- Play Store readiness check passed.
- Netlify production-context build bundled all three functions and loaded both migrations.
- Review API returned current October 13 content for AP, Telangana, Sports and Technology.
- `cat=ap` and `category=ap` returned the same category and item count.
- Review API duplicate headline count was zero for audited categories.
- Desktop 1440x1000 and mobile 390x844 Chrome checks loaded 102 story targets with zero console/page errors.

## Environment

Required production variables:

- `NETLIFY_DB_URL` (managed by Netlify Database; configured)
- `GNEWS_API_KEY` (configured; RSS remains the observed fallback provider)
- `NEWS_INGEST_CATEGORIES`
- `NEWS_INGEST_CONCURRENCY=2`
- `ADMIN_HEALTH_TOKEN`

## Known limitations

- RSS fallback currently exposes no article-associated media in the audited categories, so those records are deliberately text-only.
- The existing browser CMS still uses localStorage and blob/data previews. A server-authenticated CMS persistence API and durable object storage are a separate production dependency and are not falsely represented as complete here.
- Semantic image relevance cannot be proven automatically. High-impact CMS images still require reviewer approval.
- The feed pipeline does not copy external publisher media; it stores URLs only when the provider/feed explicitly associates them with the same article.

## Rollback

1. Redeploy the previous production deploy from Netlify.
2. Disable the `ingest-news` schedule in `netlify.toml` if ingestion must be stopped immediately.
3. Revert the v82 commit. The database migration is additive and may remain safely; dropping columns/tables is not required for application rollback.
4. The v82 service worker removes obsolete NewsNeta caches during activation. Rolling back should use a new cache version rather than reusing v81.
