ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source_provider" varchar(80);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source_article_id" varchar(320);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source_name" varchar(200);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "source_published_at" timestamp with time zone;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "featured_media" jsonb;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "ingested_at" timestamp with time zone;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;
CREATE UNIQUE INDEX IF NOT EXISTS "articles_source_identity_idx" ON "articles" ("source_provider", "source_article_id") WHERE "source_provider" IS NOT NULL AND "source_article_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "articles_source_freshness_idx" ON "articles" ("status", "source_published_at" DESC);

CREATE TABLE IF NOT EXISTS "ingestion_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" varchar(80) NOT NULL,
  "status" varchar(40) NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "articles_fetched" integer DEFAULT 0 NOT NULL,
  "articles_inserted" integer DEFAULT 0 NOT NULL,
  "articles_updated" integer DEFAULT 0 NOT NULL,
  "articles_rejected" integer DEFAULT 0 NOT NULL,
  "categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS "ingestion_runs_started_idx" ON "ingestion_runs" ("started_at" DESC);
CREATE INDEX IF NOT EXISTS "ingestion_runs_status_idx" ON "ingestion_runs" ("status", "started_at" DESC);
