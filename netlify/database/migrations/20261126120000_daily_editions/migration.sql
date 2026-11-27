CREATE TABLE IF NOT EXISTS daily_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date date NOT NULL,
  language varchar(16) NOT NULL DEFAULT 'te',
  edition_scope varchar(32) NOT NULL DEFAULT 'combined',
  page_count integer NOT NULL DEFAULT 4 CHECK (page_count IN (4,6,8)),
  cutoff_start timestamp with time zone NOT NULL,
  cutoff_end timestamp with time zone NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  lead_article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  pdf_storage_key text,
  created_by varchar(160) NOT NULL,
  generated_at timestamp with time zone,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (edition_date, language, edition_scope)
);

CREATE TABLE IF NOT EXISTS daily_edition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES daily_editions(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  page_number integer NOT NULL DEFAULT 1,
  section varchar(120) NOT NULL,
  headline text NOT NULL,
  summary text NOT NULL,
  image_url text,
  article_slug varchar(220) NOT NULL,
  article_revision integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (edition_id, article_id),
  UNIQUE (edition_id, position)
);

CREATE INDEX IF NOT EXISTS daily_editions_public_idx ON daily_editions (status, edition_date DESC);
CREATE INDEX IF NOT EXISTS daily_edition_items_order_idx ON daily_edition_items (edition_id, position);

CREATE TABLE IF NOT EXISTS edition_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES daily_editions(id) ON DELETE CASCADE,
  channel varchar(16) NOT NULL CHECK (channel IN ('email','whatsapp')),
  recipient_encrypted text NOT NULL,
  recipient_masked varchar(320) NOT NULL,
  consent_confirmed boolean NOT NULL DEFAULT false,
  scheduled_at timestamp with time zone NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  provider_message_id text,
  last_error text,
  requested_by varchar(160) NOT NULL,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edition_deliveries_due_idx ON edition_deliveries (status, scheduled_at);
CREATE INDEX IF NOT EXISTS edition_deliveries_edition_idx ON edition_deliveries (edition_id, created_at DESC);
