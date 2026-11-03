import { getDatabase } from "@netlify/database";
import "rss-parser";
import ingestionCore from "../lib/ingest-news-core.js";

const { handler: runIngestion } = ingestionCore;

async function publishDueScheduledArticles() {
  const { pool } = getDatabase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const due = await client.query(`UPDATE articles
      SET status='published', published_at=now(), updated_at=now(), content_revision=content_revision+1
      WHERE status='scheduled' AND scheduled_at <= now() AND publisher_id IS NOT NULL
      RETURNING id, publisher_id`);
    for (const article of due.rows) {
      await client.query({
        text: `INSERT INTO article_workflow (article_id,from_status,to_status,action,comments,actor_id,actor_role)
          VALUES ($1,'scheduled','published','Scheduled publication','Published automatically by the newsroom scheduler.',$2,'admin')`,
        values: [article.id, article.publisher_id]
      });
    }
    await client.query("COMMIT");
    return due.rowCount || 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export default async function handler() {
  const scheduledPublished = await publishDueScheduledArticles();
  const result = await runIngestion(getDatabase);
  console.info(JSON.stringify({ code: "INGESTION_RESULT", scheduledPublished, statusCode: result.statusCode, body: JSON.parse(result.body || "{}") }));
  return new Response(result.body, {
    status: result.statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
