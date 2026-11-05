ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS social_image_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS last_editor_id varchar(160);

CREATE TABLE IF NOT EXISTS article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  edited_by varchar(160) NOT NULL,
  edit_note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(article_id, revision_number)
);

CREATE INDEX IF NOT EXISTS article_revisions_article_idx
  ON article_revisions(article_id, revision_number DESC);
