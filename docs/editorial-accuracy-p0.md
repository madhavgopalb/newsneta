# Editorial Accuracy P0

## Root causes

- Automated provider, archive, and representative images could become public from a numeric relevance score without an explicit editorial approval state.
- Legacy feed rows regenerated broad Unsplash images when exact article media was unavailable.
- The browser accepted archive and representative media based on type and score, so unsafe associations could bypass backend filtering.
- Feed descriptions were flattened into `summary`; paragraph-form authorized excerpts were not stored separately.
- CMS publication validated caption and license text but did not require an explicit rights confirmation or human relevance evidence.

## Remediation

- Automated feed media remains pending and is not persisted or rendered until explicitly approved with publication rights.
- Broad representative and archive fallback generation has been removed from the public news path. A story without approved article-specific media is intentionally text-only.
- `source_description` preserves the complete authorized excerpt separately from the card summary and is rendered with paragraph breaks in article detail.
- CMS media records now persist original URL, image type, relevance evidence, and explicit rights confirmation.
- Reporter, reviewer, and Admin direct-publish paths enforce the same rights and relevance requirements.
- The migration removes only unapproved automated feed associations and retains newsroom uploads.
- Service Worker cache version `v95` invalidates stale article/media responses after release.

## Verification

- Automated tests cover 20 mismatch classes across regional, government, market, weather, sports, cinema, business, technology, education, and election news.
- Tests verify approved newsroom media remains available, unapproved or broad media remains hidden, and multi-paragraph source descriptions survive ingestion and API serialization.
- Production is not changed by this branch. An isolated preview and migration branch must pass smoke testing before approval and merge.
