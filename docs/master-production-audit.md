# NewsNeta Master Production Audit

## Current architecture

- Static HTML/CSS/JavaScript application served by Netlify. The repository is
  not a Next.js or React application and has no App Router or Pages Router.
- Public news is read through `/.netlify/functions/news`; `/api/news` redirects
  to the same Netlify Function.
- The function combines a licensed-news provider when configured with Google
  News RSS and rights-aware image lookup/fallback handling.
- The editorial CMS, login state, workflow and uploaded browser media currently
  persist in `localStorage`. They are not shared between devices.
- PWA support consists of `manifest.json`, install icons and `sw.js`.

## Reusable components

- Existing responsive homepage, article modal, category and district filters.
- Reporter, reviewer and admin workflow UI and state transitions.
- Shared client article normalizer and image resolver.
- Existing news Netlify Function and RSS/provider fallback path.
- Network-first News API service-worker strategy introduced in cache version
  `v76`.

## Broken or incomplete components

- There is no canonical production article database.
- CMS authentication is client-side and is not a production identity system.
- CMS articles and uploaded media do not propagate across devices.
- Uploaded browser object/data URLs are not persistent production media URLs.
- There is no authenticated server API for create, review, approve, publish,
  unpublish or delete operations.
- A CMS-published article therefore cannot be proven through the required
  database-to-homepage acceptance path.

## API endpoints

| Endpoint | Current behavior |
| --- | --- |
| `/.netlify/functions/news?cat=latest` | Public provider/RSS feed |
| `/.netlify/functions/news?cat=<category>` | Category feed |
| `/.netlify/functions/news?cat=<state>&district=<district>` | District query feed |
| `/api/news` | Redirect to the News function |

No server-side CMS write endpoint exists yet.

## Database dependencies

- Production `DATABASE_URL`: absent.
- Netlify Database status: `enabled: false`.
- `@netlify/database`, Drizzle ORM and Drizzle Kit are now scaffolded locally.
- A canonical `articles` and `article_workflow` schema and initial SQL migration
  have been prepared, but have not been applied to production.

## Media pipeline

- Feed articles preserve provider-associated image candidates and can use a
  rights-aware reusable-media lookup.
- The client centralizes article image extraction before presentation fallback.
- CMS file selection is browser-local. Persistent object storage remains a
  required dependency before CMS media can be considered production-ready.

## Cache and service-worker architecture

- Static assets use cache-first behavior.
- Dynamic News API requests use network-first behavior.
- Refresh/force/view parameters remain on the network request and are removed
  only from the stable fallback cache key.
- Responses are cloned immediately after fetch and before cache writes.
- Cache version `v76` removes only obsolete NewsNeta caches.

## Proposed change map

1. Connect and enable the Netlify/Neon Postgres database.
2. Apply the prepared schema migration.
3. Add authenticated CMS CRUD and workflow endpoints.
4. Connect persistent object storage and store only durable media URLs.
5. Merge published database articles into the existing public News API, newest
   first, without requiring editorial placement flags.
6. Migrate the CMS from `localStorage` to those endpoints.
7. Run the unique-story and unique-image refresh acceptance test without a
   deployment.
8. Only after the release gate passes, proceed with homepage/mobile redesign.

## Risks

- Deploying CMS endpoints before authentication would expose editorial writes.
- Storing uploaded images in Postgres or serverless filesystem storage would be
  costly or non-durable.
- Replacing the static application with Next.js before fixing the canonical
  data path would add migration risk without solving publishing.
- The Netlify database initializer currently fails before provisioning. The
  first attempt left a partial package tree; dependencies were reinstalled and
  verified, but `netlify database status --json` still reports `enabled: false`.

## Milestone result

- Repository/production architecture audit: PASS.
- Service-worker response lifecycle repair: PASS (deployed previously as v76).
- Public News API and refresh path: PASS for provider/RSS news.
- Canonical CMS publication path: FAIL, blocked by absent production database,
  authentication and persistent media storage.
- Homepage redesign release gate: NOT OPEN.
