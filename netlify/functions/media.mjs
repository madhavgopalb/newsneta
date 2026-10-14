import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";

export default async function handler(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });
  const { pool } = getDatabase();
  const allowed = await pool.query({ text: `SELECT m.id FROM media_assets m JOIN articles a ON a.id=m.article_id WHERE m.storage_key=$1 AND m.status='approved' AND a.status='published' AND a.source_provider='newsneta-cms' LIMIT 1`, values: [key] });
  if (!allowed.rows.length) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const suffix = process.env.CONTEXT === "production" ? "" : `-${String(process.env.DEPLOY_ID || process.env.CONTEXT || "local").replace(/[^a-z0-9-]/gi, "-")}`;
  const store = getStore({ name: "newsneta-media" + suffix, consistency: "strong" });
  const entry = await store.getWithMetadata(key, { type: "arrayBuffer", consistency: "strong" });
  if (!entry) return new Response("Not found", { status: 404 });
  return new Response(entry.data, {
    status: 200,
    headers: {
      "Content-Type": entry.metadata?.contentType || "application/octet-stream",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}