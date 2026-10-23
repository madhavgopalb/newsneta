ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "content_status" varchar(40) DEFAULT 'brief' NOT NULL;
--> statement-breakpoint
UPDATE "articles"
SET "content_status" = 'newsroom_full_text'
WHERE "source_provider" = 'newsneta-cms'
  AND length(trim(COALESCE("body", ''))) > 0;
--> statement-breakpoint
ALTER TABLE "articles"
  DROP CONSTRAINT IF EXISTS "articles_content_status_check";
--> statement-breakpoint
ALTER TABLE "articles"
  ADD CONSTRAINT "articles_content_status_check"
  CHECK ("content_status" IN ('brief', 'licensed_full_text', 'newsroom_full_text'));
