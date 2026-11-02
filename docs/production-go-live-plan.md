# NewsNeta Production Go-Live Plan

## Scope and release principle

NewsNeta will ship through focused pull requests. Production remains unchanged until the preview database, automated browser suite, backup, rollback and release approval gates pass. RSS excerpts remain News Briefs; only newsroom-owned or explicitly licensed content is published as full text.

## Current root causes

| Area | Root cause | Current action |
| --- | --- | --- |
| Article detail | Brief classification was used to suppress valid descriptions | PR #12 preserves and renders authorized descriptions |
| Images | Most Google News RSS records do not include an approved article image; unsafe archive or stock substitution is intentionally rejected | Keep neutral fallback; require provider image or approved newsroom upload |
| Video | Playback exists, but usable output depends on approved stored media, MIME metadata and poster delivery | Add browser coverage against uploaded MP4/WebM/HLS fixtures |
| Regions | Canonical routes exist, but feed classification and sparse district results can make pages appear empty | Add API/database route integration tests and district fallback messaging |
| Freshness | Network-first Service Worker is present; ingestion freshness depends on scheduled function/database health | Expose signed admin feed import and health status in Studio |
| Studio | Features are split across Article, Video, Manage and Analytics screens | Consolidate into Create, Feeds, Media, Review & Publish |

## Sakshi functional gap matrix

| Capability | NewsNeta status | Delivery decision |
| --- | --- | --- |
| Homepage hierarchy | Working, visually dense | Preserve approved layout; remove prototype-only sections in a separate approved PR |
| Latest and breaking news | Working with freshness risk | Monitor scheduled ingestion and stale-feed alerts |
| Detailed article pages | Defective for some briefs | Fix in PR #12; full text remains rights-gated |
| State and district navigation | Working routes, inconsistent data density | Add integration tests and canonical taxonomy checks |
| Article-specific images | Defective when feeds omit media | Provider media or newsroom upload only; no unrelated stock replacement |
| Video news | Implemented, insufficient production fixtures | Validate uploaded MP4/WebM, HLS and YouTube paths |
| Reels and galleries | Implemented, data-dependent | Keep; add playable fixture tests |
| Mobile responsiveness | Implemented, regression risk | Playwright matrix for 360, 390, 430, tablet and desktop |
| Search/discoverability | Basic working search and SEO metadata | Add article canonical/schema validation later |
| Unified newsroom | Defective information architecture | Phase 1 Studio consolidation |

## Fifteen-working-day target

1. Days 1-2: baseline audit, production health snapshot, preview database binding repair, release checklist.
2. Days 3-4: merge approved brief-description hotfix; article detail and source/image regression suite.
3. Days 5-7: simplified Studio, signed feed import, media library and workflow integration tests.
4. Days 8-9: category/district taxonomy and canonical-route integration repairs.
5. Days 10-11: video upload, MIME/range/poster/HLS playback tests and mobile media QA.
6. Days 12-13: Playwright desktop/mobile/PWA tests, accessibility and security checks.
7. Day 14: isolated Netlify preview, test database migration rehearsal, backup and rollback drill.
8. Day 15: release approval, main merge, production deployment, smoke tests and monitoring.

## Release gates

- All unit and integration tests pass against an isolated PostgreSQL database.
- Netlify preview uses its own database branch and media test namespace.
- Reporter to reviewer to admin publication succeeds without browser-local state dependence.
- Published, edited and unpublished records synchronize across two browser contexts and PWA cache refresh.
- Approved image and video URLs return successful status and correct MIME headers.
- Direct state, district and article URLs survive refresh/back/forward.
- Backup and rollback commands are documented and rehearsed.
- Release approval is recorded before merging to `main`.
