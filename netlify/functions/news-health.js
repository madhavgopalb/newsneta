const { getDatabase } = require("@netlify/database");

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(body)
});

exports.handler = async function handler(event) {
  const expected = process.env.ADMIN_HEALTH_TOKEN;
  const supplied = String(event.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return json(401, { status: "unauthorized" });

  try {
    const { pool } = getDatabase();
    const [latestRun, freshness, media] = await Promise.all([
      pool.query(`SELECT id, provider, status, started_at, finished_at, duration_ms,
        articles_fetched, articles_inserted, articles_updated, articles_rejected,
        categories, errors, metadata FROM ingestion_runs ORDER BY started_at DESC LIMIT 20`),
      pool.query(`SELECT
        max(source_published_at) AS newest_provider_article,
        max(ingested_at) AS newest_ingested_article,
        max(published_at) FILTER (WHERE status='published') AS newest_published_article,
        count(*) FILTER (WHERE status='published' AND published_at > now() - interval '24 hours')::int AS published_last_24h
        FROM articles`),
      pool.query(`SELECT
        count(*) FILTER (WHERE status='published')::int AS published_articles,
        count(*) FILTER (WHERE status='published' AND featured_media IS NOT NULL AND image_url IS NOT NULL)::int AS articles_with_images,
        count(*) FILTER (WHERE status='published' AND (featured_media IS NULL OR image_url IS NULL))::int AS text_only_articles
        FROM articles`)
    ]);
    return json(200, {
      status: "ok",
      deploymentVersion: process.env.COMMIT_REF || process.env.DEPLOY_ID || "local",
      generatedAt: new Date().toISOString(),
      ingestion: latestRun.rows,
      freshness: freshness.rows[0],
      media: media.rows[0]
    });
  } catch (error) {
    console.error(JSON.stringify({ code: "HEALTH_DASHBOARD_FAILED", message: error.message, timestamp: new Date().toISOString() }));
    return json(503, { status: "unavailable", message: "Health data is temporarily unavailable." });
  }
};
