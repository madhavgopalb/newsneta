# NewsNeta Professional Portal Transformation: Phase 0 Audit

Audit date: 23 October 2026

Repository: `madhavgopalb/newsneta`

Production baseline: `main` at `81d52a2`

## Executive decision

NewsNeta should be transformed through focused releases, not a single redesign branch. Production currently mixes a working Telugu news feed with prototype dashboard modules, browser-local behavior, synthetic engagement signals and incomplete newsroom infrastructure. Two draft P0 pull requests contain important repairs, but neither should be merged until the Netlify preview database binding is corrected and its end-to-end gates pass.

No production deployment is authorized by this audit.

## Current release inventory

| Workstream | Branch / PR | Status | Decision |
| --- | --- | --- | --- |
| Production baseline | `main` / `81d52a2` | Live baseline | Preserve for rollback |
| Unified CMS security | `fix/unified-news-sync-p0` / PR #2 | Draft; code checks pass; preview database unavailable | Do not merge |
| Video and media recovery | `fix/video-playback-p0` / PR #3 | Draft; local real playback and 19 tests pass; review CMS/media blocked by database binding | Release A candidate only |
| Professional portal audit | `audit/professional-portal-phase0` | Documentation-only | Safe for review |

## Architecture observed

- One large static `index.html` contains the public homepage, article modal, CMS login/editor, polls, assistant, weather, cricket, districts and most client state.
- Netlify Functions provide news, scheduled ingestion, CMS, media and ingestion-health APIs.
- PostgreSQL migrations define articles, ingestion runs, workflow audit and media assets.
- Netlify Blobs stores uploaded media.
- A custom Service Worker provides shell caching, network-first news and image caching.
- The Android deliverable is a TWA manifest and Digital Asset Links configuration; a signed, tested store artifact is not present in this repository.
- Public articles are modal/hash views in the homepage rather than independent crawlable article documents.

## Verified baseline checks

Run against production `main` on 23 October 2026:

- `npm run check`: PASS.
- `npm test`: PASS, 15/15.
- `npm run check:playstore`: PASS as a configuration check.
- The Play Store check does not prove a signed APK/AAB, installed TWA, notification delivery or device behavior.

## External product benchmark

The benchmark is behavioral and structural only. No third-party code, branding, content or protected assets should be copied.

- Disha presents a compact category taxonomy, explicit AP/Telangana district navigation, top stories, latest stories, most-read and section-led editorial blocks.
- Sakshi presents searchable topic navigation, timestamped updates, breaking news, prominent lead coverage and fuller article copy with context.
- NewsNeta currently presents the masthead and category rail, but the homepage continues into numerous prototype panels and simulated indicators that weaken editorial credibility.

Reference pages:

- <https://www.dishadaily.com/>
- <https://www.sakshi.com/>
- <https://newsneta.com/>

## Defect register

### P0: release and trust blockers

| ID | Defect | Evidence | Required resolution | Owner / dependency |
| --- | --- | --- | --- | --- |
| P0-01 | Netlify preview database is not attached to Functions | PR #2 and #3 deploy metadata report `database_branch_id: null`; CMS/media integration cannot run safely | Provision an isolated preview DB binding, apply migrations, and prove no production DB access | DevOps / Netlify Database |
| P0-02 | Production CMS update target is slug-based | `cms.mjs` on `main` uses `INSERT ... ON CONFLICT (slug) DO UPDATE` | Merge only the reviewed immutable UUID, ownership, provider and optimistic concurrency implementation after integration tests | Backend / PR #2 |
| P0-03 | Production editorial transition is not atomic | Media approval, article transition and workflow audit are separate pool operations on `main` | Use one transaction with row lock, rollback test and audit verification | Backend / PR #2 |
| P0-04 | Video UI in production is not real playback | Production reels are image/narration behavior; MIME, HLS and range delivery are incomplete | Complete Release A gates from PR #3, including review CMS publication and protected media playback | Media / PR #3 / P0-01 |
| P0-05 | Review media cannot be safely validated | Protected media depends on the missing preview DB; preview returns controlled 503 after PR #3 | Test approved/published 200/206, pending/rejected 404, unpublish revocation and two-browser visibility | QA / P0-01 |
| P0-06 | Homepage presents simulated editorial signals as live | Production page exposes fixed trust score, poll percentages, election sentiment, reader reactions and “live” labels without authoritative data | Remove or connect each signal to a real audited data source before Release B | Product + Editorial + Analytics |
| P0-07 | Thin source material is expanded with generic prose | Current article renderer contains reusable background, impact and verification paragraphs | Preserve verified body; label briefs; prohibit unsupported expansion and quotations | Editorial + Backend |

### P1: professional portal requirements

| ID | Defect | Required resolution | Release |
| --- | --- | --- | --- |
| P1-01 | Homepage is dashboard-heavy and excessively long | Replace with masthead, breaking strip, lead grid, latest/most-read tabs, state/district desks, videos, galleries and compact section bands | B |
| P1-02 | No independent crawlable article route | Add unique article URLs, canonical metadata, NewsArticle JSON-LD, OG data and server/crawler-readable content | C/E |
| P1-03 | Image selection can fall back by broad category | Require exact article-media association, rights metadata and neutral labeled fallback; remove unrelated stock substitution | C |
| P1-04 | Most-read and engagement are not analytics-backed | Record qualified reads and aggregate ranking; never synthesize counts | B/D |
| P1-05 | Archive and search are incomplete | Add server-side search/date/category/district filters with pagination | C/D |
| P1-06 | Ingestion lacks durable retry/dead-letter behavior | Add bounded retry/backoff, error classification, dead-letter state and admin alerts | D |
| P1-07 | Ingestion updates may replace editorial fields | Enforce field ownership and never overwrite CMS-owned/manual revisions | D / PR #2 |
| P1-08 | Media lifecycle metadata is incomplete | Persist duration when available, source URL, rights, relevance decision, approval and publication/revocation history | C/D |
| P1-09 | Article history is not reader-visible | Add correction/update notes backed by immutable revision records | C/D |
| P1-10 | PWA/TWA device behavior is unverified | Test install/update/offline/deep links/media/auth on supported Android devices and TWA | E |

### P2: enhancements after credibility gates

- Personalized recommendations based on consented real interaction data.
- Push subscriptions and alerts with topic/district controls.
- Real live blogs and event timelines.
- Verified photo galleries and explainers.
- Advertising inventory clearly separated from editorial content.
- Subscription and saved/offline reading workflows.
- Telugu voice narration with accessible pause/resume controls.

## Functional inventory

### Preserve

- NewsNeta masthead and identity.
- Telugu-first typography and language switching.
- AP/Telangana category and district navigation.
- Scheduled ingestion foundation and health endpoint.
- PostgreSQL article/media/workflow model.
- PWA manifest, cache-version upgrade pattern and TWA configuration.
- CMS roles and intended reporter-reviewer-admin separation.
- Existing responsive category rail and article sharing controls.

### Replace or remove from Release B homepage

- Fixed trust percentages.
- Synthetic views and most-read counts.
- Static election sentiment.
- Fake live-reader indicators.
- Prototype “Future Ready Newsroom” marketing grid.
- News Brief Tool exposed as a homepage product demo.
- Generic explainers and photo counts without real records.
- Duplicate district/state promotional cards.
- Any “Live” label not supported by recent server data.

### Keep behind the newsroom login

- Ingestion health and last successful run.
- Feed failures and stale categories.
- Media approval and rights decisions.
- AI-assisted headline, summary and translation tools.
- Editorial quality and fact-check notes.
- Workflow audit and revision history.

## Target public information architecture

1. Masthead: logo, search, edition/language, login and accessibility controls.
2. Sticky category rail: Home, Latest, Telangana, Andhra Pradesh, National, Politics, World, Cinema, Sports, Business, Technology, Health, Districts and Videos.
3. Verified breaking strip, shown only when `is_breaking` and freshness conditions pass.
4. Lead package: one primary story and four secondary stories with editorially associated media.
5. Latest / Most Read panel: timestamped server data; no fabricated counters.
6. Telangana and Andhra Pradesh desks with district selectors.
7. Category bands with one lead and compact supporting stories.
8. Playable video rail containing video stories only.
9. Approved photo gallery rail.
10. Opinion/explainers, clearly labeled by content type.
11. Footer with corrections, editorial policy, privacy, terms and contact.

## Editorial article contract

Every published article should expose only available, verified fields:

- Immutable article ID and unique slug.
- Telugu headline and meaningful summary.
- Content type: brief, report, explainer, opinion, live update or gallery.
- Location, source publication time, NewsNeta publication time and update time.
- Verified body and attributed official statements.
- Author/byline, desk, source references and licensing basis.
- Category, state, district and tags.
- Approved featured media and caption/alt text.
- Correction/update history.
- Related articles selected by category/entities and editorial rules.

Missing evidence must produce a labeled brief or review task, not invented paragraphs.

## Release plan and gates

### Release A: video and critical media

Candidate: PR #3. Before merge, require isolated preview DB, CMS upload/review/publish, real protected 200/206 playback, unpublish revocation, desktop Edge/Chrome, Android Chrome, installed PWA and TWA evidence. Safari/WebKit must be tested when available. Roll back to `81d52a2` if production playback or news delivery regresses.

### Release B: professional homepage

Create from the approved production baseline after Release A disposition. No CMS schema dependency. Remove simulated widgets, implement the editorial hierarchy, and use only existing real API fields. Test desktop 1440/1024, tablet 768 and mobile 360/390/430 widths. Do not advertise missing videos, galleries, analytics or live data.

### Release C: article pages and media relevance

Add crawlable article routes, structured metadata, exact media association, captions, neutral fallback and revision/correction UI. Requires the secured CMS model and clear licensing rules.

### Release D: ingestion and newsroom synchronization

Merge the validated security architecture from PR #2 or rebase it after Release A. Add retries, dead-letter handling, stale-feed alerts, manual-field ownership and multi-client synchronization tests.

### Release E: SEO, performance and production hardening

Add sitemap/news sitemap, performance budgets, offline fallback, PWA/TWA device matrix, monitoring, backup and rollback rehearsal.

## Immediate next actions

1. Resolve Netlify preview database binding without exposing production credentials.
2. Complete PR #3 Release A review-media and device gates.
3. Rebase PR #2 after Release A disposition and rerun transactional/security integration tests.
4. Create Release B from the then-current production baseline.
5. Have editorial owners approve taxonomy, homepage modules, article contract, attribution and image-rights policy.
6. Add GitHub checks for `npm run check`, `npm test`, Play Store configuration and preview smoke tests.

## Release governance

A visible component is not accepted as functional. Each release requires actual data, automated checks, a review URL, security validation, rollback instructions and explicit approval. Production claims require a verified deploy and post-release smoke evidence.