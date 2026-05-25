# NewsNeta

Modern Telugu-first AI news platform prototype with a premium mobile-first UI, PWA support, RSS-backed serverless news API, AI-style summaries, reels, ticker, recommendations, polls, live widgets, dark mode, and a floating assistant.

## What is included

- `index.html` - responsive NewsNeta reader experience.
- `netlify/functions/news.js` - RSS ingestion API with category and district support, caching headers, trust/sentiment metadata, and fallback handling.
- `sw.js` - PWA app shell and API cache.
- `manifest.json` - installable app manifest.
- `docs/architecture.md` - production-ready UI, API, database, AI, SEO, recommendation, admin CMS, and deployment blueprint.

## New newsroom features

- District news for both Telangana and Andhra Pradesh using state + district selectors.
- Auto refresh every 5 minutes for active category and selected district feeds.
- Three newsroom roles: Admin, Reporter, Reviewer, with RBAC permissions documented in the architecture blueprint.

## Run locally

```bash
npm install
netlify dev
```

Open the local Netlify URL and browse the homepage. The UI also works as a static page, but live RSS requires Netlify Functions.

## Production path

1. Move the reader app to Next.js App Router for SSR, article routes, AMP, and Google Discover optimization.
2. Replace the demo RSS function with a worker-backed ingestion service.
3. Add MongoDB Atlas, Redis, object storage, authentication, and role-based CMS.
4. Connect AI services for Telugu summaries, voice narration, embeddings, recommendations, translation, and fake-news risk scoring.
5. Add analytics, ad management, sitemap automation, and push notification campaigns.
