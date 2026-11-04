-- Quarantine legacy media that lacks explicit rights and human relevance approval.
-- Keep the featured_media metadata for audit, but remove it from public image fields.
UPDATE articles
SET image_url = NULL,
    thumbnail_url = NULL,
    media = '[]'::jsonb,
    featured_media = jsonb_set(
      jsonb_set(featured_media, '{approvalStatus}', '"rejected"'::jsonb, true),
      '{requiresReview}', 'true'::jsonb, true
    ),
    content_revision = content_revision + 1,
    updated_at = now()
WHERE featured_media IS NOT NULL
  AND jsonb_typeof(featured_media) = 'object'
  AND (
    COALESCE(featured_media->>'approvalStatus', featured_media->>'approval_status', '') <> 'approved'
    OR COALESCE(featured_media->>'rightsConfirmed', featured_media->>'rights_confirmed', 'false') <> 'true'
    OR COALESCE(featured_media->'relevanceEvidence'->>'humanConfirmed', featured_media->'relevance_evidence'->>'humanConfirmed', 'false') <> 'true'
    OR COALESCE(featured_media->>'imageType', featured_media->>'image_type', '') IN ('representative', 'missing', 'branded_fallback')
  );

-- Older malformed scalar values cannot carry auditable rights metadata.
UPDATE articles
SET image_url = NULL,
    thumbnail_url = NULL,
    media = '[]'::jsonb,
    featured_media = NULL,
    content_revision = content_revision + 1,
    updated_at = now()
WHERE featured_media IS NOT NULL
  AND jsonb_typeof(featured_media) <> 'object';

UPDATE media_assets
SET status = 'rejected',
    updated_at = now()
WHERE status = 'approved'
  AND (
    rights_confirmed IS NOT TRUE
    OR COALESCE(relevance_evidence->>'humanConfirmed', 'false') <> 'true'
    OR image_type IN ('representative', 'missing', 'branded_fallback')
  );
