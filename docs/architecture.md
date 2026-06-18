# NewsNeta Production Architecture

NewsNeta is a Telugu-first AI news ecosystem designed for a mobile-first web app, PWA, Android/iOS wrappers, high-throughput news ingestion, real-time publishing, and AI-assisted newsroom workflows.

## 0. Required Publishing And Delivery Flow

```text
NewsNeta CMS
     |
Editorial Workflow
     |
Review & Approval
     |
Publish Content
     |
-------------------
|                 |
REST/GraphQL API  Mobile API
|                 |
Next.js Website   Android / iOS
|
Desktop + Mobile Browser
```

| Platform | Codebase Contract | UI Contract |
| --- | --- | --- |
| Desktop Web | Shared public website code consuming published content APIs | Desktop newsroom layout |
| Mobile Browser (Chrome/Safari) | Same public website code with responsive/adaptive components and the same published feed data | Mobile layout with the same content freshness |
| Android App | Native/hybrid wrapper consuming the Mobile API and web deep links | Native mobile UI |
| iOS App | Native/hybrid wrapper consuming the Mobile API and web deep links | Native mobile UI |

### Current Implementation Notes

- The current repository is a Netlify-hosted static/PWA implementation with a Netlify `news` function standing in for the public REST API.
- Desktop and mobile browser share the same `index.html`, service worker, CMS workflow UI, category feeds, district feeds, and article renderer.
- The CMS workflow exists in the browser prototype. For production, reporter/reviewer/admin articles must be persisted through the REST/GraphQL API and database so a story published on desktop is visible on mobile browser and app clients.
- Android/iOS readiness is represented by the PWA manifest, app icons, and `android/twa-manifest.json`; store deployment still requires the wrapper build/signing/release process.

## 1. UI/UX Architecture

### Reader App
- Mobile-first SSR homepage with sticky header, category rail, breaking ticker, top-story hero, reels feed, AI recommendations, most-viewed stories, polls, election dashboard, cricket widget, and live TV embed.
- Article page template: headline, Telugu AI summary, source/fact-check panel, voice-read controls, ad slots, related articles, comments/polls, JSON-LD, OpenGraph, AMP variant.
- Shorts/Reels page: vertical snap feed, muted autoplay video/image cards, save/share/voice controls, infinite pagination.
- District news page: Telangana and Andhra Pradesh district selectors, district-specific feeds, local reporter attribution, district alerts, and auto-refresh status.
- Search page: AI semantic search, exact keyword search, filters by region/category/date/source.
- User page: saved stories, offline reading, interests, notification settings, subscription plan.

### Visual System
- Telugu typography: `Noto Sans Telugu` for body/headlines, Inter for metrics and UI labels.
- Color roles: News red for urgency, teal for AI/trust, gold for premium/sponsored, neutral surfaces for newsroom clarity.
- Motion: page fades, card elevation, ticker movement, counter animation, reels swipe transitions, notification micro-interactions.
- Accessibility: `lang="te-IN"`, visible focus states, 44px tap targets, reduced-motion support, contrast-tested dark/light modes.

## 2. Recommended Tech Stack

### Frontend
- Next.js App Router with React Server Components.
- Tailwind CSS with design tokens.
- Framer Motion for transitions and reels interactions.
- TanStack Query for client cache.
- next-pwa or custom service worker for offline reading.
- AMP article routes for Google Discover and mobile speed.

### Backend
- Node.js API layer with Express/NestJS or Next.js route handlers.
- MongoDB Atlas for flexible article/content data.
- Redis for hot feeds, ticker, rate limits, dedupe cache.
- BullMQ/SQS workers for RSS ingestion, AI jobs, scheduled publishing, sitemap refresh.
- Firebase Cloud Messaging or OneSignal for push notifications.
- Cloudflare CDN, WAF, image resizing, bot protection.

## 3. API Architecture

### Public APIs
- `GET /api/home`: hero, ticker, trending, recommendations, sections.
- `GET /api/articles?category=&district=&cursor=`: paginated/infinite category or district article feed.
- `GET /api/articles/:slug`: article detail with SEO metadata and related stories.
- `GET /api/reels?cursor=`: short news feed.
- `GET /api/search?q=&filters=`: keyword + vector search.
- `GET /api/live`: breaking ticker, live TV, cricket/election widgets.
- `POST /api/voice`: generate Telugu narration audio.
- `POST /api/summarize`: AI summary for editor/user text.
- `POST /api/events`: analytics, impressions, reads, shares.

### Admin APIs
- `POST /api/admin/articles`: create article as reporter/admin.
- `PATCH /api/admin/articles/:id`: edit, review, schedule, publish, or request changes depending on role.
- `POST /api/admin/ingest/rss`: add RSS source.
- `POST /api/admin/ai/headline`: generate headline variants.
- `POST /api/admin/ai/fact-check`: run claim/risk checks.
- `GET /api/admin/analytics`: traffic, revenue, category performance.
- `POST /api/admin/ads`: create sponsorship/ad placement.

## 4. Database Schema

### Collections
- `users`: auth profile, role, language, state, district, interests, subscription, notification tokens.
- `roles`: admin, reporter, reviewer.
- `districts`: state, district name, slug, priority, assigned reporters, active status.
- `articles`: title, slug, summary, body, category, state, district, tags, status, author, reviewer, sources, media, SEO, publish schedule.
- `reels`: articleId, videoUrl/imageUrl, caption, duration, rank, status.
- `sources`: RSS/API details, trust score, fetch cadence, last fetch, parser rules.
- `ingestionJobs`: sourceId, status, item count, dedupe results, errors.
- `aiArtifacts`: articleId, summaries, headline variants, tags, sentiment, translation, fake-news score, embeddings.
- `recommendationEvents`: userId/sessionId, articleId, event type, dwell time, share/save.
- `ads`: slot, campaign, sponsor, targeting, start/end, impression/click metrics.
- `polls`: question, options, votes, region/category, active window.
- `analyticsDaily`: date, pageviews, CTR, revenue, category metrics.

### Article Shape
```json
{
  "title": "తెలంగాణలో కొత్త విధానంపై కీలక నిర్ణయం",
  "slug": "telangana-policy-decision",
  "category": "telangana",
  "state": "Telangana",
  "district": "Hyderabad",
  "status": "review_pending",
  "summary": "AI generated Telugu summary...",
  "body": "Full story...",
  "tags": ["telangana", "policy"],
  "seo": {
    "title": "Telangana latest Telugu news",
    "description": "Short Telugu meta description",
    "canonical": "https://newsneta.in/news/telangana-policy-decision"
  },
  "ai": {
    "sentiment": "neutral",
    "trustScore": 91,
    "fakeNewsRisk": "low",
    "embeddingId": "vec_123"
  },
  "publishedAt": "2026-05-21T10:00:00.000Z"
}
```

## 5. Admin Dashboard Wireframes

### Main Navigation
- Dashboard
- Articles
- District Desk
- Reels
- Breaking Ticker
- Sources/RSS
- AI Studio
- Ads & Sponsors
- Polls
- Push Notifications
- Analytics
- Users & Roles

### Role Permissions

| Permission | Admin | Reporter | Reviewer |
| --- | --- | --- | --- |
| Create drafts | Yes | Yes | Yes |
| Assign category/state/district | Yes | Yes | Yes |
| Upload media and sources | Yes | Yes | Yes |
| Use AI headline/summary/translation | Yes | Yes | Yes |
| Submit for review | Yes | Yes | Yes |
| Approve or reject story | Yes | No | Yes |
| Publish/unpublish story | Yes | No | Publish queue only |
| Delete story | Yes | Own draft only | No |
| Manage users and roles | Yes | No | No |
| Manage RSS sources | Yes | No | No |
| Manage ads/subscriptions | Yes | No | No |
| View full analytics/audit logs | Yes | Limited own stories | Review metrics only |

### Editorial Workflow
- Reporter creates district story as `draft`.
- Reporter submits story as `review_pending`.
- Reviewer checks sourcing, spelling, AI summary, fake-news score, SEO, district/category tags.
- Reviewer either returns `changes_requested` or marks `approved`.
- Admin publishes immediately or schedules publication.
- Breaking stories can bypass scheduling only by Admin.

### Dashboard Widgets
- Live pageviews
- Breaking stories queue
- Top categories
- Google Discover traffic
- Ad revenue today
- AI moderation warnings
- Scheduled articles
- RSS ingestion health
- District feed freshness

### Article Editor
- Left: Telugu rich-text editor, media picker, live preview.
- Right: category, tags, region, publish schedule, SEO fields, ad settings.
- AI panel: headline generator, short summary, voice preview, fake-news checks, related article suggestions.

## 6. AI Workflow Integrations

1. Ingest: RSS/API/manual article enters draft queue.
2. Normalize: parse title, body, source, media, date, canonical link.
3. Deduplicate: compare canonical URL, title similarity, and embeddings.
4. Classify: category, region, topic, urgency.
5. Generate: Telugu summary, headline variants, reels caption, meta description.
6. Verify: source trust, claim risk, sentiment, toxic language, duplicate rumors.
7. Recommend: embed article, update candidate pools, rank per user/session.
8. Narrate: generate Telugu TTS audio and cache in object storage.
9. Publish: SSR cache revalidation, sitemap update, push notification if breaking.

## 7. Refresh And District Feed Strategy

- Reader app refreshes active category and selected district every 5 minutes.
- Breaking ticker can refresh every 60 seconds in production through a lightweight `/api/live` endpoint.
- RSS workers fetch category feeds every 3-5 minutes and district feeds every 5-10 minutes based on traffic priority.
- Redis stores hot category/district feeds with `stale-while-revalidate`.
- District slugs:
  - Telangana: Adilabad, Hyderabad, Karimnagar, Khammam, Nalgonda, Nizamabad, Rangareddy, Warangal, and all current Telangana districts.
  - Andhra Pradesh: Srikakulam, Visakhapatnam, East Godavari, Krishna, Guntur, Kurnool, Tirupati, YSR Kadapa, and all current AP districts.
- Admin can pin district stories, assign reporters to districts, and override RSS ranking for emergency alerts.

## 8. Recommendation Engine

### Signals
- Explicit: followed categories, region, language, saved stories.
- Implicit: clicks, dwell time, scroll depth, shares, voice plays, hides.
- Contextual: freshness, breaking priority, location, device, time of day.
- Editorial: pinned stories, source trust, sponsored exclusions, diversity rules.

### Ranking Pipeline
- Candidate generation: trending, latest, regional, similar embeddings, collaborative reads.
- Scoring: `0.35 interest + 0.25 freshness + 0.15 quality + 0.10 region + 0.10 popularity + 0.05 diversity`.
- Guardrails: cap same category/source, downrank low-trust or duplicate content, label sponsored content.
- Feedback loop: event stream updates user/session vectors in near real time.

## 9. SEO And Discover Strategy

- SSR all public pages.
- Clean canonical URLs: `/news/:category/:slug`.
- Article, NewsArticle, BreadcrumbList, VideoObject, LiveBlogPosting JSON-LD.
- Dynamic OpenGraph/Twitter images.
- News sitemap updated every 5 minutes for fresh articles.
- Standard sitemap generated daily.
- RSS feeds per category.
- RSS feeds and sitemap sections per state and district.
- AMP pages for top/evergreen stories.
- Google Discover: large 1200px images, clear headlines, no clickbait, author/source metadata, fast LCP.
- Telugu keyword clusters for politics, cinema, sports, Telangana, Andhra Pradesh, business, viral.

## 10. Performance And Scale

- Edge SSR with CDN cache and stale-while-revalidate.
- Lazy load images/video/embeds below the fold.
- Responsive image sizes and AVIF/WebP.
- API response caching with Redis.
- District feed caching keyed by `state:district:cursor`.
- Queue-based ingestion and AI jobs.
- Incremental static regeneration for article pages.
- Critical CSS for first viewport.
- Bundle splitting for admin, reels, analytics, editor.
- Observability: logs, traces, SLO dashboards, Core Web Vitals, API latency alerts.

## 11. Monetization

- Google AdSense slots: homepage feed, article inline, sticky mobile, related stories.
- Sponsored sections: labeled category cards and brand-safe native articles.
- Premium subscription: ad-light mode, offline archive, early analysis, custom briefings.
- Push notification ads: frequency-capped, opt-in only.
- Video ads: pre-roll/mid-roll for live TV and reels.
- Ad management dashboard with campaign targeting, impression caps, CTR, revenue.

## 12. Mobile App Wrapper

- Capacitor or React Native WebView wrapper around PWA.
- Native push notifications via FCM/APNs.
- Offline reading backed by service worker/IndexedDB.
- Native share sheet for WhatsApp, Instagram, X.
- Background audio for Telugu voice playback.
- Deep links: `newsneta://news/:slug`.

## 13. Deployment

- Frontend: Vercel or Netlify edge deployment.
- Backend: Render/AWS ECS/Lambda for APIs and workers.
- Database: MongoDB Atlas.
- Object storage: S3/R2 for media and generated audio.
- CDN/WAF: Cloudflare.
- CI/CD: lint, test, Lighthouse CI, Playwright smoke tests, schema migration checks.
