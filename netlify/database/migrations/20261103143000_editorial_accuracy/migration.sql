ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS source_description text;

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS original_url text,
  ADD COLUMN IF NOT EXISTS image_type varchar(40) NOT NULL DEFAULT 'reporter_photo',
  ADD COLUMN IF NOT EXISTS relevance_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rights_confirmed boolean NOT NULL DEFAULT false;

UPDATE articles
SET source_description = summary
WHERE source_description IS NULL
  AND summary IS NOT NULL;

-- Remove only unsafe automated feed associations. Newsroom uploads remain intact.
UPDATE articles
SET image_url = NULL,
    thumbnail_url = NULL,
    media = '[]'::jsonb,
    featured_media = NULL,
    content_revision = content_revision + 1,
    updated_at = now()
WHERE author_id LIKE 'feed:%'
  AND featured_media IS NOT NULL
  AND (
    COALESCE(featured_media->>'approvalStatus', featured_media->>'approval_status', '') <> 'approved'
    OR COALESCE(featured_media->>'requiresReview', 'true') <> 'false'
    OR COALESCE(featured_media->>'imageType', featured_media->>'image_type', '') IN ('representative', 'archive', 'missing', 'branded_fallback')
    OR COALESCE(featured_media->>'license', '') ~* '(unknown|verify)'
  );
