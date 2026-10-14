ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "content_revision" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "article_id" uuid REFERENCES "articles"("id") ON DELETE SET NULL,
  "storage_key" text NOT NULL UNIQUE,
  "public_url" text NOT NULL,
  "mime_type" varchar(120) NOT NULL,
  "file_name" text NOT NULL,
  "file_size" integer NOT NULL,
  "caption" text,
  "alt_text" text,
  "source" text,
  "copyright_owner" text,
  "license" text,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "uploaded_by" varchar(160) NOT NULL,
  "approved_by" varchar(160),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_article_idx" ON "media_assets" ("article_id", "status", "created_at");