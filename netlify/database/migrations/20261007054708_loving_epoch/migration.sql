CREATE TABLE "article_workflow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"article_id" uuid NOT NULL,
	"from_status" varchar(40),
	"to_status" varchar(40) NOT NULL,
	"action" varchar(120) NOT NULL,
	"comments" text,
	"actor_id" varchar(160) NOT NULL,
	"actor_role" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"slug" varchar(220) NOT NULL UNIQUE,
	"title" text NOT NULL,
	"english_title" text,
	"summary" text,
	"body" text NOT NULL,
	"category" varchar(80) NOT NULL,
	"state" varchar(80),
	"district" varchar(120),
	"status" varchar(40) DEFAULT 'draft' NOT NULL,
	"author_id" varchar(160) NOT NULL,
	"reviewer_id" varchar(160),
	"publisher_id" varchar(160),
	"image_url" text,
	"thumbnail_url" text,
	"image_alt" text,
	"media" jsonb DEFAULT '[]' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"is_breaking" boolean DEFAULT false NOT NULL,
	"is_top_story" boolean DEFAULT false NOT NULL,
	"is_trending" boolean DEFAULT false NOT NULL,
	"is_editors_pick" boolean DEFAULT false NOT NULL,
	"is_todays_edition" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "article_workflow_article_idx" ON "article_workflow" ("article_id","created_at");--> statement-breakpoint
CREATE INDEX "articles_latest_idx" ON "articles" ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "articles" ("category","published_at");--> statement-breakpoint
CREATE INDEX "articles_location_idx" ON "articles" ("state","district","published_at");--> statement-breakpoint
ALTER TABLE "article_workflow" ADD CONSTRAINT "article_workflow_article_id_articles_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE;