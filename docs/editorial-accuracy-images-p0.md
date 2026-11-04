# Editorial Accuracy Images P0

## Root cause

The first editorial-accuracy repair made automated feed media pending by default, but three residual compatibility paths still treated a non-empty license string as proof of publication rights. Those paths did not consistently require `relevanceEvidence.humanConfirmed === true`. A legacy record could therefore remain public after being assigned a high score, an approved status and plausible license text without an auditable article-level match.

## Repair

- Ingestion accepts media only when approval, explicit rights confirmation and human relevance evidence are all present.
- Public API serialization applies the same rule to CMS and feed records.
- Browser image selection no longer infers rights from license text.
- Representative, missing and branded-fallback records remain ineligible as article photographs.
- Editor-approved archive or illustrative media remains eligible only with explicit rights and human relevance evidence, and is labelled `FILE PHOTO` or `ILLUSTRATION`.
- Article detail displays the approved caption, label and attribution when present.
- The migration quarantines unsafe legacy associations, preserves their `featured_media` audit metadata and increments the article content revision.
- Service Worker cache version `v96` prevents stale article/media responses from surviving release.

## Description preservation

The existing `source_description` path remains canonical for authorized excerpts. Paragraph breaks survive feed normalization, database storage, public serialization and article-detail rendering. Full newsroom-owned or licensed bodies remain separate from card summaries. Missing source descriptions are not synthesized; those briefs keep their original-source link.

## Production sample before release

On 4 November 2026, a read-only sample of 20 current articles across Latest, Telangana and Andhra Pradesh returned:

- 20 source-linked articles.
- 9 authorized source descriptions.
- 11 excerpt-free briefs with original-source links.
- 0 public images, confirming the existing production API is already choosing omission over an unverified photograph.

The automated regression suite contains 20 cross-category mismatch cases, including the supplied reservation/Japanese-street, financial-assistance/desert-highway, government/foreign-parliament and vegetable-market/generic-photo scenarios.
