ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS source_notes text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS cms_publish_requests (
  idempotency_key varchar(160) PRIMARY KEY,
  actor_id varchar(160) NOT NULL,
  request_hash varchar(64) NOT NULL,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cms_publish_requests_actor_idx
  ON cms_publish_requests(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS articles_scheduled_publish_idx
  ON articles(status, scheduled_at)
  WHERE status = 'scheduled';

-- Earlier ingestion could reinsert a published CMS article as a feed brief.
-- Keep the immutable newsroom record and remove only that exact duplicate form.
DELETE FROM articles AS feed_copy
USING articles AS newsroom_article
WHERE feed_copy.author_id LIKE 'feed:%'
  AND feed_copy.source_article_id = newsroom_article.id::text
  AND newsroom_article.source_provider = 'newsneta-cms';
