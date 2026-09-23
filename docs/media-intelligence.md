# NewsNeta Media Intelligence

## Current image pipeline

1. The news function reads GNews when configured, otherwise Google News RSS.
2. A provider image or the article's declared Open Graph image is preferred.
3. If neither is available, an approved reusable-media search is attempted.
4. The browser keeps the `image` field used by existing cards and article views.
5. Reporter uploads are stored in the prototype CMS article record and pass through reviewer and admin queues.

## Root cause of irrelevant images

The previous fallback selected one of two broad category photographs using keyword rules. The image could match "cricket" or "weather" while depicting a different event, person, location, or date. Image URLs had no durable source, rights, relevance, archive, or review metadata, so editors could not audit why a photograph was selected.

## Incremental architecture

The feed API now returns its existing `image` field plus a backward-compatible `media` decision object. The decision records source, original URL, rights metadata, image type, editorial label, relevance score, score breakdown, selection reasons, image intent, review status, and selection time.

Automatic reusable-media candidates must score at least 70. They are labelled `FILE PHOTO`. When no candidate clears the threshold, NewsNeta returns its branded fallback instead of an unrelated photograph. Provider/article-associated images remain candidates but are marked for rights verification when syndication terms are not explicit.

## Target data model

Persist the following entities when the production database is introduced:

- `MediaAsset`: master file, dimensions, MIME type, size, focal point, capture metadata and moderation state.
- `MediaVariant`: hero, desktop, tablet, mobile, thumbnail, social and reel derivatives.
- `MediaSource` and `MediaLicense`: provider, photographer, copyright owner, terms, expiry and attribution.
- `MediaEntity` and `MediaLocation`: people, organizations, teams, landmarks, coordinates and event date.
- `ArticleMedia`: article relationship, role, ordering, caption, alt text and editorial label.
- `MediaUsage` and `MediaVersion`: usage history and replacements.
- `MediaCandidate`, `ImageSearchJob` and `ImageRelevanceScore`: traceable automated decisions.
- `ImageDuplicateHash` and `ImageModerationResult`: exact/near duplicate and quality checks.

## API evolution

The existing news response is unchanged for current clients. New clients may read:

```json
{
  "image": "/assets/newsneta-logo-header.png",
  "media": {
    "source": "NewsNeta",
    "license": "NewsNeta branded asset",
    "imageType": "branded_fallback",
    "relevanceScore": 10,
    "visualStatus": "orange",
    "requiresReview": true,
    "intent": {},
    "scoreBreakdown": {},
    "reasons": []
  }
}
```

Future media endpoints should use signed uploads, immutable asset IDs, role-scoped mutations, paginated search and asynchronous variant generation. Public APIs must never expose private GPS or camera metadata.

## Editor workflow

Reporter uploads one or more assets and supplies caption, alt text, source, photographer, copyright owner, license, image type and relevance score. A reviewer verifies factual relevance and rights. Admin publication validation blocks incomplete media and relevance below 70. Archive and representative assets must remain visibly labelled.

The next CMS increment should add Upload, Media Library, Reporter Photos, Approved Sources, Recent Images, Suggestions and Graphics tabs, followed by crop/focal-point previews for each distribution surface.

## Existing-content migration

1. Inventory published stories and normalize every image into a `MediaAsset` record.
2. Flag missing provenance, generic fallbacks, duplicates and images older than the event.
3. Prioritize homepage, latest, trending, most-read and indexed stories.
4. Replace misleading images with verified assets or the branded fallback.
5. Preserve every replacement in `MediaVersion` and invalidate CDN variants.

## Testing and release

- Contract-test the legacy `image` field and new `media` object.
- Test threshold behavior, rights metadata, archive labels and branded fallback selection.
- Verify reporter upload, reviewer approval and admin publication validation.
- Test responsive crops at card, hero, article, social and reel ratios.
- Audit duplicate imagery and homepage visual diversity.
- Release behind configuration, observe image failures and review queue volume, then migrate existing articles in batches.

This phase intentionally does not add a database, object store, CDN processor or external licensed-provider credentials. Those require provider and infrastructure choices, but the response contract and editorial validation are ready for those integrations.
