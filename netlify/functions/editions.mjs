import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";
import auth from "../lib/cms-auth.js";
import { deduplicateArticles, editionSection, editionSummary, renderEditionPdf } from "../lib/edition-core.mjs";

const json = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const bearer = request => String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
const session = request => auth.verifySession(bearer(request), process.env.CMS_SESSION_SECRET);
const clean = (value, max = 2000) => String(value || "").replace(/\0/g, "").trim().slice(0, max);
const editionId = value => /^[0-9a-f-]{36}$/i.test(String(value || "")) ? String(value) : null;
const allowedLanguages = new Set(["te", "en", "hi"]);
const allowedScopes = new Set(["combined", "telangana", "andhra-pradesh"]);

function approvedImage(row) {
  const media = row.featured_media || {};
  const approval = String(media.approvalStatus || media.approval_status || "").toLowerCase();
  const rights = media.rightsConfirmed === true || media.rights_confirmed === true;
  const evidence = media.relevanceEvidence || media.relevance_evidence || {};
  const type = String(media.imageType || media.image_type || "").toLowerCase();
  if (approval !== "approved" || !rights || evidence.humanConfirmed !== true || ["representative", "missing", "branded_fallback"].includes(type)) return null;
  return clean(row.image_url || row.thumbnail_url || media.publicUrl || media.public_url || media.url, 3000) || null;
}

function defaultWindow(dateValue) {
  const end = dateValue ? new Date(`${dateValue}T00:30:00.000Z`) : new Date();
  if (Number.isNaN(end.getTime())) throw Object.assign(new Error("Edition date is invalid"), { status: 400 });
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end, editionDate: end.toISOString().slice(0, 10) };
}

async function editionRows(pool, id, publicOnly = true) {
  const edition = await pool.query({
    text: `SELECT * FROM daily_editions WHERE id=$1${publicOnly ? " AND status='published'" : ""} LIMIT 1`,
    values: [id]
  });
  if (!edition.rows[0]) return null;
  const items = await pool.query({ text: "SELECT * FROM daily_edition_items WHERE edition_id=$1 ORDER BY position", values: [id] });
  return { ...edition.rows[0], items: items.rows };
}

export async function createEditionDraft(pool, user, input = {}) {
  const language = allowedLanguages.has(input.language) ? input.language : "te";
  const scope = allowedScopes.has(input.editionScope) ? input.editionScope : "combined";
  const pageCount = [4, 6, 8].includes(Number(input.pageCount)) ? Number(input.pageCount) : 4;
  const standard = defaultWindow(clean(input.editionDate, 10));
  const start = input.cutoffStart ? new Date(input.cutoffStart) : standard.start;
  const end = input.cutoffEnd ? new Date(input.cutoffEnd) : standard.end;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw Object.assign(new Error("Editorial date range is invalid"), { status: 400 });
  const stateClause = scope === "telangana" ? " AND (state='Telangana' OR category='telangana')" : scope === "andhra-pradesh" ? " AND (state='Andhra Pradesh' OR category IN ('ap','andhra-pradesh'))" : "";
  const result = await pool.query({
    text: `SELECT id,slug,title,summary,source_description,body,category,image_url,thumbnail_url,featured_media,
      content_revision,is_top_story,is_breaking,published_at
      FROM articles WHERE status='published' AND published_at >= $1 AND published_at < $2${stateClause}
      ORDER BY is_top_story DESC,is_breaking DESC,published_at DESC LIMIT 80`,
    values: [start.toISOString(), end.toISOString()]
  });
  const selectedRows = deduplicateArticles(result.rows, Math.min(30, Math.max(20, pageCount * 7)));
  const selected = selectedRows.map((row, index) => ({
    articleId: row.id,
    position: index + 1,
    pageNumber: Math.min(pageCount, Math.floor(index / Math.max(1, Math.ceil(selectedRows.length / pageCount))) + 1),
    section: editionSection(row),
    headline: clean(row.title, 500),
    summary: editionSummary(row),
    imageUrl: approvedImage(row),
    articleSlug: row.slug,
    articleRevision: Number(row.content_revision || 1)
  }));
  if (!selected.length) throw Object.assign(new Error("No eligible published articles were found in this date range"), { status: 409 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const edition = await client.query({
      text: `INSERT INTO daily_editions (edition_date,language,edition_scope,page_count,cutoff_start,cutoff_end,lead_article_id,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (edition_date,language,edition_scope) DO UPDATE SET page_count=EXCLUDED.page_count,
        cutoff_start=EXCLUDED.cutoff_start,cutoff_end=EXCLUDED.cutoff_end,lead_article_id=EXCLUDED.lead_article_id,
        status='draft',pdf_storage_key=NULL,generated_at=NULL,updated_at=now()
        RETURNING *`,
      values: [standard.editionDate, language, scope, pageCount, start.toISOString(), end.toISOString(), selected[0].articleId, user.id]
    });
    await client.query({ text: "DELETE FROM daily_edition_items WHERE edition_id=$1", values: [edition.rows[0].id] });
    for (const item of selected) {
      await client.query({
        text: `INSERT INTO daily_edition_items (edition_id,article_id,position,page_number,section,headline,summary,image_url,article_slug,article_revision)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        values: [edition.rows[0].id, item.articleId, item.position, item.pageNumber, item.section, item.headline, item.summary, item.imageUrl, item.articleSlug, item.articleRevision]
      });
    }
    await client.query("COMMIT");
    return { ...edition.rows[0], items: selected };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function updateEdition(pool, id, data) {
  const current = await editionRows(pool, id, false);
  if (!current || current.status !== "draft") throw Object.assign(new Error("Draft edition not found"), { status: 404 });
  const supplied = Array.isArray(data.items) ? data.items : [];
  const byArticle = new Map(current.items.map(item => [String(item.article_id), item]));
  if (!supplied.length || supplied.some(item => !byArticle.has(String(item.articleId)))) throw Object.assign(new Error("Edition items are invalid"), { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let index = 0; index < supplied.length; index += 1) {
      await client.query({ text: "UPDATE daily_edition_items SET position=$1 WHERE edition_id=$2 AND article_id=$3", values: [-1000 - index, id, supplied[index].articleId] });
    }
    for (let index = 0; index < supplied.length; index += 1) {
      const item = supplied[index];
      await client.query({
        text: `UPDATE daily_edition_items SET position=$1,headline=$2,summary=$3,page_number=$4 WHERE edition_id=$5 AND article_id=$6`,
        values: [index + 1, clean(item.headline || byArticle.get(String(item.articleId)).headline, 500), clean(item.summary || byArticle.get(String(item.articleId)).summary, 5000), Number(item.pageNumber || 1), id, item.articleId]
      });
    }
    await client.query({ text: "UPDATE daily_editions SET lead_article_id=$1,pdf_storage_key=NULL,generated_at=NULL,updated_at=now() WHERE id=$2", values: [supplied[0].articleId, id] });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
  return editionRows(pool, id, false);
}

export async function generateEditionPdf(pool, edition, origin) {
  const items = edition.items || (await editionRows(pool, edition.id, false))?.items || [];
  const pdf = await renderEditionPdf(edition, items, { baseUrl: origin });
  const key = `editions/${edition.edition_date}/${edition.language}-${edition.edition_scope}-${edition.id}.pdf`;
  const store = getStore({ name: "newsneta-editions", consistency: "strong" });
  await store.set(key, pdf, { metadata: { contentType: "application/pdf", editionId: edition.id, generatedAt: new Date().toISOString() } });
  await pool.query({ text: "UPDATE daily_editions SET pdf_storage_key=$1,generated_at=now(),updated_at=now() WHERE id=$2", values: [key, edition.id] });
  return { key, bytes: pdf.byteLength };
}

async function pdfResponse(pool, id, isAdmin) {
  const edition = await editionRows(pool, id, !isAdmin);
  if (!edition?.pdf_storage_key) return new Response("Edition PDF is not available", { status: 404 });
  const store = getStore({ name: "newsneta-editions", consistency: "strong" });
  const entry = await store.getWithMetadata(edition.pdf_storage_key, { type: "stream", consistency: "strong" });
  if (!entry) return new Response("Edition PDF is not available", { status: 404 });
  return new Response(entry.data, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="newsneta-daily-${edition.edition_date}.pdf"`, "Cache-Control": edition.status === "published" ? "public, max-age=3600, immutable" : "no-store" } });
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const action = clean(url.searchParams.get("action"), 40) || "list";
    const user = session(request);
    const { pool } = getDatabase();
    if (request.method === "GET" && action === "pdf") {
      const id = editionId(url.searchParams.get("id"));
      return id ? pdfResponse(pool, id, user?.role === "admin") : json(400, { status: "invalid-edition" });
    }
    if (request.method === "GET" && action === "detail") {
      const id = editionId(url.searchParams.get("id"));
      const edition = id ? await editionRows(pool, id, user?.role !== "admin") : null;
      return edition ? json(200, { status: "ok", edition }) : json(404, { status: "not-found" });
    }
    if (request.method === "GET") {
      const includeDrafts = user?.role === "admin";
      const result = await pool.query(`SELECT id,edition_date,language,edition_scope,page_count,status,pdf_storage_key,generated_at,published_at
        FROM daily_editions ${includeDrafts ? "" : "WHERE status='published'"} ORDER BY edition_date DESC,created_at DESC LIMIT 60`);
      return json(200, { status: "ok", items: result.rows });
    }
    if (request.method !== "POST") return json(405, { status: "method-not-allowed" });
    if (user?.role !== "admin") return json(403, { status: "forbidden" });
    const data = await request.json();
    if (action === "draft") return json(201, { status: "ok", edition: await createEditionDraft(pool, user, data) });
    const id = editionId(data.id);
    if (!id) return json(400, { status: "invalid-edition" });
    if (action === "update") return json(200, { status: "ok", edition: await updateEdition(pool, id, data) });
    const edition = await editionRows(pool, id, false);
    if (!edition) return json(404, { status: "not-found" });
    if (action === "generate") return json(200, { status: "ok", ...(await generateEditionPdf(pool, edition, url.origin)) });
    if (action === "publish") {
      if (!edition.pdf_storage_key) await generateEditionPdf(pool, edition, url.origin);
      await pool.query({ text: "UPDATE daily_editions SET status='published',published_at=COALESCE(published_at,now()),updated_at=now() WHERE id=$1", values: [id] });
      return json(200, { status: "ok", edition: await editionRows(pool, id, false) });
    }
    return json(404, { status: "not-found" });
  } catch (error) {
    console.error(JSON.stringify({ code: "EDITION_REQUEST_FAILED", message: error.message, timestamp: new Date().toISOString() }));
    return json(error.status || 500, { status: "error", message: error.status ? error.message : "Edition request failed" });
  }
}

export { approvedImage, defaultWindow, editionRows };
