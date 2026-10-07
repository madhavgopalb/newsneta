NEWSNETA V2 — PRODUCTION TELUGU DIGITAL NEWS PLATFORM
MASTER IMPLEMENTATION PROMPT

ROLE

Act as the Principal Architect and Lead Engineer for NewsNeta.

Your responsibilities include:

- News platform architecture
- Next.js / React
- PostgreSQL / Neon
- Netlify
- CMS architecture
- Editorial workflows
- Persistent media storage
- News APIs
- PWA/mobile architecture
- Performance
- SEO / Google News / Discover
- Production reliability
- Security
- Analytics
- QA

You are modifying the EXISTING NewsNeta application.

DO NOT create a disconnected replacement prototype.

DO NOT blindly rewrite working functionality.

Audit the existing application and migrate it incrementally into the
architecture described below.


============================================================
1. PRODUCT VISION
============================================================

Transform NewsNeta into a professional Telugu digital news platform
serving Andhra Pradesh, Telangana and Telugu audiences globally.

The target product should provide the editorial professionalism,
information density, freshness, performance and mobile usability
expected from major Telugu news publications.

Use established Telugu news websites as information-architecture and
UX references only.

DO NOT copy their:

- source code
- branding
- layouts
- logos
- images
- proprietary assets

NewsNeta must establish its own visual and editorial identity.


============================================================
2. ARCHITECTURAL PRINCIPLE
============================================================

NewsNeta must NOT depend directly on RSS for the website.

Target:

                   CONTENT SOURCES

        ┌──────────────┬──────────────┐
        │              │              │
   NewsNeta CMS    Licensed APIs     RSS
        │              │              │
        └──────────────┼──────────────┘
                       ↓
               INGESTION LAYER
                       ↓
              NORMALIZATION LAYER
                       ↓
              EDITORIAL WORKFLOW
                       ↓
                 NEWS DATABASE
                       ↓
                   NEWS API
                       ↓
          ┌────────────┼─────────────┐
          ↓            ↓             ↓
        WEB           PWA        MOBILE APP
     Desktop/Mobile             Android/iOS


CMS/Database/API must become the source of truth.

RSS and external providers are INPUTS.

They are NOT the frontend data architecture.


============================================================
3. EXISTING P0 PROBLEMS
============================================================

The current production system has experienced:

- news not reliably loading
- Latest News not refreshing
- Service Worker cache errors
- Response.clone() errors
- ERR_CACHE_MISS
- articles appearing without their real images
- RSS articles containing zero image URLs
- default/unrelated images previously masking missing media
- video/media inconsistencies

The previous P0 repair intentionally removed unrelated:

- NewsNeta logos
- stock photos
- archive images

from articles.

DO NOT restore those incorrect fallbacks.


============================================================
4. IMPLEMENTATION RULE
============================================================

Work milestone by milestone.

DO NOT redesign everything at once.

After every milestone:

BUILD
TEST
DEPLOY TO STAGING
VERIFY
REPORT
CONTINUE

Do not report "fixed" without evidence.


============================================================
MILESTONE 1 — PRODUCTION ARCHITECTURE AUDIT
============================================================

Inspect:

Next.js version
React version
routing
homepage
article pages
category pages
district pages
CMS
Netlify
Netlify Functions
Neon/PostgreSQL
database schema
news ingestion
RSS
GNews integration if present
authentication
roles
media
image storage
video
service worker
PWA
analytics
SEO
sitemap
structured data
environment variables

Produce:

CURRENT_ARCHITECTURE.md

Include:

Current architecture
Data flow
Publishing flow
Media flow
API endpoints
Database tables
Caching
Service Worker
External providers
Problems
Security concerns
Technical debt
Recommended migration


============================================================
MILESTONE 2 — REPAIR THE DATA FOUNDATION
============================================================

Create ONE canonical article model.

Conceptually:

Article {
    id
    slug

    title
    subtitle
    summary
    body

    language

    categoryId
    subcategoryId

    stateId
    districtId

    authorId

    status

    publishedAt
    updatedAt

    featuredMediaId

    sourceType
    sourceName
    sourceUrl
    externalId

    isBreaking
    isTopStory
    isTrending
    isEditorsPick
    isTodaysEdition
    isOpinion
    isFactCheck

    createdAt
}


Reuse existing fields/tables wherever possible.

Do NOT duplicate working schema unnecessarily.


============================================================
MILESTONE 3 — CONTENT SOURCE ARCHITECTURE
============================================================

Implement provider abstraction:

NewsProvider

Providers may include:

NewsNetaCMSProvider
RSSProvider
GNewsProvider

Future providers must be pluggable.

External providers should normalize into:

NormalizedExternalArticle {
    externalId
    provider
    title
    summary
    articleUrl
    sourceName
    sourceUrl
    imageUrl
    publishedAt
    category
}


============================================================
IMPORTANT
============================================================

Do NOT automatically publish all externally sourced content.

External content should enter an ingestion/review pipeline according
to NewsNeta editorial policy.


============================================================
MILESTONE 4 — CMS BECOMES SOURCE OF TRUTH
============================================================

Maintain/implement:

REPORTER
   ↓
Create Story
   ↓
Submit
   ↓
REVIEWER
   ↓
Review/Edit
   ↓
ADMIN/EDITOR
   ↓
Approve
   ↓
Publish
   ↓
DATABASE
   ↓
NEWS API
   ↓
WEB/PWA/APP


Statuses should be explicit, for example:

DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
PUBLISHED
REJECTED
ARCHIVED

Adapt to existing schema.


============================================================
MILESTONE 5 — PROFESSIONAL MEDIA SYSTEM
============================================================

Implement persistent NewsNeta media management.

Media must NOT depend on temporary serverless storage.

Create/reuse:

MediaAsset {
    id
    type

    storageProvider
    storageKey

    url
    thumbnailUrl
    posterUrl

    mimeType
    width
    height
    duration
    fileSize

    altText
    caption
    credit
    copyright

    source
    sourceUrl

    createdAt
}


Media types:

IMAGE
VIDEO
YOUTUBE
HLS
EXTERNAL_EMBED


============================================================
IMAGE PRIORITY
============================================================

Resolve article images in this order:

1. CMS uploaded Featured Media
2. NewsNeta persistent media
3. Licensed provider image
4. Valid RSS media if actually supplied
5. No image


NEVER use:

- NewsNeta logo
- unrelated archive image
- random stock image
- image belonging to another article

as the article image.


============================================================
NO-IMAGE UX
============================================================

If there is legitimately no image:

DO NOT show a large broken-looking:

"Image unavailable"

placeholder everywhere.

Render a professional TEXT-ONLY story card.

Example:

┌────────────────────────────────────┐
│ POLITICS                           │
│                                    │
│ తెలుగు వార్త శీర్షిక               │
│                                    │
│ Short story summary...             │
│                                    │
│ 5 min ago                          │
└────────────────────────────────────┘


============================================================
MILESTONE 6 — CMS MEDIA MANAGEMENT
============================================================

Reporter/editor must support:

Upload Featured Image
Replace Image
Remove Image
Preview Image
Alt Text
Caption
Photo Credit
Source
Copyright

For video:

Upload/select video
YouTube
HLS
Poster image
Thumbnail
Duration
Caption
Credit


============================================================
MILESTONE 7 — LICENSED NEWS PROVIDER
============================================================

If GNews integration already exists:

configure it properly.

Use:

process.env.GNEWS_API_KEY

SERVER SIDE ONLY.

Never expose provider keys through frontend JavaScript.

Never commit keys into GitHub.

Create provider health diagnostics:

Provider
Configured
Reachable
Articles received
Articles with images
Articles without images
Last successful fetch


============================================================
MILESTONE 8 — INGEST MEDIA
============================================================

Where licensing permits:

Provider Article
       ↓
Provider Image
       ↓
Validate
       ↓
Download server-side
       ↓
Verify MIME
       ↓
Store in NewsNeta persistent storage
       ↓
Create MediaAsset
       ↓
Link to Article


Do not permanently depend on fragile third-party hotlinks.

Respect copyright and licensing.


============================================================
MILESTONE 9 — FIX SERVICE WORKER
============================================================

Completely repair existing Service Worker issues.

Known historical errors include:

Response body is already used

and:

net::ERR_CACHE_MISS


Use:

STATIC FILES
CacheFirst

IMAGES
StaleWhileRevalidate

NEWS APIs
NetworkFirst

BREAKING NEWS
NetworkFirst

LATEST NEWS
NetworkFirst

ARTICLE
NetworkFirst / controlled revalidation


Do NOT CacheFirst live news APIs.

Do NOT cache failed media responses.

Do NOT cache complete videos blindly.

Support Range requests normally.


============================================================
MILESTONE 10 — LIVE NEWS REFRESH
============================================================

Publishing must work without redeployment.

Test:

Article A is current latest article.

Publish Article B.

DO NOT redeploy.

Refresh NewsNeta.

Expected:

Article B appears.

Article B's correct image appears.

If Article A remains:

FAIL.

If Article B appears with unrelated/default image:

FAIL.


============================================================
MILESTONE 11 — NEWS API
============================================================

Build/reuse clean APIs such as:

GET /news/latest

GET /news/breaking

GET /news/top

GET /news/category/:slug

GET /news/state/:slug

GET /news/district/:slug

GET /news/article/:slug

GET /news/trending

GET /news/videos

GET /news/shorts

GET /news/search


Actual endpoint naming may follow existing architecture.

Avoid unnecessary duplication.


============================================================
MILESTONE 12 — HOMEPAGE
============================================================

After infrastructure passes testing, redesign homepage.

Editorial order:

HEADER

PRIMARY NAVIGATION

BREAKING NEWS

TOP STORIES

TRENDING

LATEST NEWS

MOST READ

TODAY'S EDITION

ANDHRA PRADESH

TELANGANA

DISTRICT NEWS

POLITICS

CINEMA

SPORTS

VIDEOS

SHORTS

NATIONAL

INTERNATIONAL

BUSINESS

TECHNOLOGY

JOBS/EDUCATION

PHOTO NEWS

EXPLAINERS

FACT CHECK

OPINION

FOOTER


============================================================
MILESTONE 13 — TOP STORIES
============================================================

Use clear editorial hierarchy.

Desktop:

┌────────────────────────────┬───────────────┐
│                            │ Story 2       │
│       LEAD IMAGE           ├───────────────┤
│                            │ Story 3       │
│ MAIN HEADLINE              ├───────────────┤
│ Summary                    │ Story 4       │
│ Listen | AI Summary        ├───────────────┤
│                            │ Story 5       │
└────────────────────────────┴───────────────┘


============================================================
MILESTONE 14 — LATEST NEWS
============================================================

Latest News must be chronological.

Example:

17:26  Headline

17:19  Headline

17:10  Headline

17:04  Headline


Use real publishedAt timestamps.

Newest first.

Support:

LOAD MORE

or efficient pagination/infinite loading.


============================================================
MILESTONE 15 — TODAY'S EDITION
============================================================

Today's Edition should be editorial.

NOT statistics.

Display:

Lead story

Story 2
Story 3
Story 4
Story 5

VIEW TODAY'S EDITION


============================================================
MILESTONE 16 — REGIONAL NEWS
============================================================

Make regional coverage a core NewsNeta strength.

ANDHRA PRADESH

TELANGANA

DISTRICTS


District selector:

STATE ▼

DISTRICT ▼


Create SEO-friendly pages such as conceptually:

/andhra-pradesh

/telangana

/district/hyderabad

/district/guntur

Adapt URLs to existing routing.


============================================================
MILESTONE 17 — VIDEO
============================================================

Create professional video architecture.

Support:

Video News
Interviews
Explainers
Press Conferences
Short Clips

Do not treat every URL as <video>.

Correctly support:

uploaded MP4/WebM

YouTube

HLS

external embed


Verify:

thumbnail
poster
play
pause
seek
fullscreen
mobile playback


============================================================
MILESTONE 18 — SHORTS / REELS
============================================================

Create vertical:

9:16

news shorts.

Desktop:

horizontal carousel.

Mobile:

swipe experience.

Do not preload every video.


============================================================
MILESTONE 19 — ARTICLE PAGE
============================================================

Article page:

Category

Headline

Subheadline

Author

Published Date

Updated Date

Share

Hero Image

Caption

Credit

Listen

AI Summary

Article Body

Tags

Related Stories

Recommended Stories

Video where relevant

Fact Check status

Previous/Next


============================================================
MILESTONE 20 — MOBILE-FIRST
============================================================

Do not simply shrink desktop.

Create dedicated responsive behavior.

Mobile navigation:

HOME
LATEST
SHORTS
LOCAL
MORE


Use sticky bottom navigation.


============================================================
MILESTONE 21 — PWA
============================================================

NewsNeta must work as an installable PWA.

Verify:

manifest
icons
standalone mode
service worker
offline page
update handling
sharing
deep links
push readiness
Add to Home Screen


PWA must receive fresh news.

Caching must NEVER prevent current stories from appearing.


============================================================
MILESTONE 22 — FUTURE MOBILE APP
============================================================

Prepare architecture for:

Android
iOS

using the SAME NewsNeta APIs.

Do not create another database.

Future app:

HOME

LATEST

LOCAL

VIDEOS

SHORTS

SEARCH

BOOKMARKS

NOTIFICATIONS

PROFILE

SETTINGS


============================================================
MILESTONE 23 — SEARCH
============================================================

Implement high-quality search.

Support:

Telugu
English

Search:

headline
article body
keywords
category
author
state
district
date


============================================================
MILESTONE 24 — SEO
============================================================

Implement/verify:

Article
NewsArticle
VideoObject
BreadcrumbList
Organization
WebSite

Canonical URLs

OpenGraph

author

publishedAt

updatedAt

robots

sitemap

news sitemap


============================================================
MILESTONE 25 — GOOGLE NEWS / DISCOVER
============================================================

Prepare for:

Google News
Google Discover

Ensure:

stable URLs
accurate headlines
authors
publication dates
updated dates
high-quality images
mobile performance
editorial transparency
news sitemap


Do not use misleading metadata.


============================================================
MILESTONE 26 — AI
============================================================

NewsNeta AI functionality may include:

AI Summary

Listen to Article

Explain This Story

Timeline

Related Context

Fact Check Assistance

Personalized News


AI must supplement journalism.

It must not invent missing news information.

Do not allow AI widgets to dominate the homepage.


============================================================
MILESTONE 27 — ANALYTICS
============================================================

Track:

article_view
article_click
category_click
district_select
search
share
listen
ai_summary
video_play
short_play
notification_open


Only display public metrics when backed by real analytics.

Never fabricate view counts.


============================================================
MILESTONE 28 — PERFORMANCE
============================================================

Target where reasonably achievable:

LCP < 2.5 seconds

CLS < 0.1

INP < 200 ms


Optimize:

images
fonts
JavaScript
API requests
server rendering
third-party scripts
video
ads
caching


============================================================
MILESTONE 29 — SECURITY
============================================================

Review:

authentication
authorization
CMS roles
API authorization
file uploads
MIME validation
SQL injection
XSS
CSRF where applicable
rate limiting
environment variables
API keys
admin access


Never expose:

GNEWS_API_KEY

database credentials

admin secrets

storage credentials


============================================================
MILESTONE 30 — OBSERVABILITY
============================================================

Implement meaningful logs:

NEWS_FETCH_FAILED

NEWS_REFRESH_FAILED

NEWS_PROVIDER_FAILED

NEWS_DB_FAILED

IMAGE_MISSING

IMAGE_FAILED

VIDEO_FAILED

MEDIA_UPLOAD_FAILED

SERVICE_WORKER_FAILED

CACHE_FAILED

PUBLISH_FAILED


Never log credentials.


============================================================
MILESTONE 31 — ADMIN HEALTH DASHBOARD
============================================================

Create an operational dashboard.

Show:

Published Today

Drafts

Awaiting Review

Breaking Stories

Articles Without Images

Broken Images

Videos

Broken Videos

Provider Health

Last Provider Sync

API Health

Media Health


============================================================
MILESTONE 32 — PRODUCTION RELEASE TEST
============================================================

Create a test story through normal workflow:

REPORTER
↓
CREATE STORY
↓
UPLOAD UNIQUE IMAGE
↓
SUBMIT
↓
REVIEW
↓
APPROVE
↓
PUBLISH


DO NOT redeploy.


Verify:

Homepage
Latest
Category
State
District
Article
Search
Mobile
PWA


All must show the SAME:

Headline
Article
Image


============================================================
VIDEO RELEASE TEST
============================================================

Publish a real test video story.

WITHOUT redeployment verify:

Video page
Homepage if featured
Article
Mobile
PWA

Verify:

poster
thumbnail
play
pause
seek
fullscreen


============================================================
FINAL RELEASE GATE
============================================================

NewsNeta is NOT production ready until:

[ ] CMS is source of truth

[ ] RSS is only an ingestion source

[ ] News loads reliably

[ ] Latest News refreshes

[ ] New stories appear without deployment

[ ] Correct images appear

[ ] Persistent media storage works

[ ] No unrelated images

[ ] Videos work

[ ] Service Worker errors are gone

[ ] Homepage is professional

[ ] AP coverage works

[ ] Telangana coverage works

[ ] District coverage works

[ ] Search works

[ ] Mobile works

[ ] PWA works

[ ] SEO works

[ ] News sitemap works

[ ] Analytics works

[ ] Security review passes

[ ] Production build passes

[ ] No critical browser console errors


============================================================
IMPLEMENTATION REPORT
============================================================

After each milestone provide:

STATUS

ROOT CAUSE / FINDINGS

FILES CHANGED

DATABASE CHANGES

API CHANGES

ENVIRONMENT CHANGES

TESTS EXECUTED

PASS/FAIL

SCREENSHOTS/EVIDENCE WHERE APPROPRIATE

KNOWN ISSUES

NEXT MILESTONE


DO NOT reply merely:

"Implemented"
"Fixed"
"Done"


============================================================
START NOW
============================================================

FIRST complete Milestones 1–10.

Do not begin the large visual redesign yet.

The first release gate is:

1. Service Worker works.
2. News API works.
3. Latest News refresh works.
4. CMS publication works.
5. Persistent media works.
6. Real images work.
7. Video pipeline works.
8. Newly published content appears without redeployment.

Report the results.

Only after this release gate passes should implementation continue
with the professional NewsNeta website redesign.