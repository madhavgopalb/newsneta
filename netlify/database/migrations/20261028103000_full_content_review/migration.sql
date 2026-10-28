ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "full_content_review_required" boolean DEFAULT false NOT NULL;

ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "full_content_review_reason" text;

UPDATE "articles"
SET
  "full_content_review_required" = true,
  "full_content_review_reason" = COALESCE(
    "full_content_review_reason",
    'Source supplied metadata or an excerpt without full-text syndication authorization'
  )
WHERE "content_status" = 'brief';

UPDATE "articles"
SET
  "full_content_review_required" = false,
  "full_content_review_reason" = NULL
WHERE "content_status" IN ('licensed_full_text', 'newsroom_full_text');
