import crypto from "node:crypto";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import auth from "../lib/cms-auth.js";

const json = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const bearer = request => String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
const clean = (value, max = 20000) => String(value || "").replace(/\0/g, "").trim().slice(0, max);
const slugify = value => clean(value, 220).toLowerCase().replace(/[^a-z0-9\u0c00-\u0c7f]+/gu, "-").replace(/^-|-$/g, "").slice(0, 200);
const session = request => auth.verifySession(bearer(request), process.env.CMS_SESSION_SECRET);
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm"]);
const maxUpload = mime => mime.startsWith("video/") ? 150 * 1024 * 1024 : 8 * 1024 * 1024;

async function listArticles(pool, user) {
  const result = await pool.query({
    text: `SELECT id, slug, title AS headline, english_title, summary, body, category, state, district,
      status, author_id AS reporter, reviewer_id AS reviewer, publisher_id AS admin,
      image_url AS image, thumbnail_url AS thumbnail, image_alt, media, featured_media,
      tags, is_breaking, is_top_story, scheduled_at, published_at, content_revision,
      created_at, updated_at
      FROM articles
      WHERE source_provider='newsneta-cms'
      ORDER BY updated_at DESC LIMIT 250`,
    values: []
  });
  return result.rows;
}

async function saveArticle(pool, user, data) {
  if (!["reporter", "admin"].includes(user.role)) throw Object.assign(new Error("Role cannot edit articles"), { status: 403 });
  const headline = clean(data.headline || data.title, 500);
  const body = clean(data.body, 100000);
  const category = clean(data.category, 80).toLowerCase();
  if (!headline || !body || !category) throw Object.assign(new Error("Headline, body and category are required"), { status: 400 });
  const slug = slugify(data.slug || headline);
  const existing = await pool.query({ text: "SELECT id, status, author_id FROM articles WHERE slug=$1 LIMIT 1", values: [slug] });
  const current = existing.rows[0];
  if (current && user.role === "reporter" && current.author_id !== user.id) throw Object.assign(new Error("Reporter cannot edit another reporter's article"), { status: 403 });
  if (current && user.role === "reporter" && !["draft", "changes_requested"].includes(current.status)) throw Object.assign(new Error("Article must be returned to draft before reporter editing"), { status: 409 });

  let media = null;
  if (data.featuredMediaId) {
    const found = await pool.query({ text: "SELECT * FROM media_assets WHERE id=$1 LIMIT 1", values: [data.featuredMediaId] });
    media = found.rows[0] || null;
    if (!media) throw Object.assign(new Error("Featured media was not found"), { status: 400 });
  }
  const featured = media ? {
    id: media.id, url: media.public_url, thumbnailUrl: media.public_url, mimeType: media.mime_type,
    caption: media.caption, altText: media.alt_text, source: media.source, copyrightOwner: media.copyright_owner,
    license: media.license, imageType: "cms_approved", relevanceScore: media.status === "approved" ? 100 : 80
  } : null;
  const result = await pool.query({
    text: `INSERT INTO articles (slug,title,english_title,summary,body,category,state,district,status,author_id,
      image_url,thumbnail_url,image_alt,media,featured_media,tags,is_breaking,is_top_story,source_provider,source_article_id,content_revision)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,'newsneta-cms',$1,1)
      ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, english_title=EXCLUDED.english_title,
      summary=EXCLUDED.summary, body=EXCLUDED.body, category=EXCLUDED.category, state=EXCLUDED.state,
      district=EXCLUDED.district, image_url=COALESCE(EXCLUDED.image_url,articles.image_url),
      thumbnail_url=COALESCE(EXCLUDED.thumbnail_url,articles.thumbnail_url), image_alt=COALESCE(EXCLUDED.image_alt,articles.image_alt),
      media=CASE WHEN EXCLUDED.featured_media IS NOT NULL THEN EXCLUDED.media ELSE articles.media END,
      featured_media=COALESCE(EXCLUDED.featured_media,articles.featured_media), tags=EXCLUDED.tags,
      is_breaking=EXCLUDED.is_breaking, is_top_story=EXCLUDED.is_top_story,
      content_revision=articles.content_revision+1, updated_at=now()
      RETURNING *`,
    values: [slug, headline, clean(data.englishTitle, 500) || null, clean(data.summary, 4000) || null, body,
      category, clean(data.state, 80) || null, clean(data.district, 120) || null, user.id,
      media?.public_url || null, media?.alt_text || clean(data.altText, 500) || null,
      JSON.stringify(featured ? [featured] : []), JSON.stringify(featured),
      JSON.stringify(Array.isArray(data.tags) ? data.tags.map(tag => clean(tag, 80)).filter(Boolean) : clean(data.tags, 500).split(",").map(tag => tag.trim()).filter(Boolean)),
      Boolean(data.breaking), Boolean(data.topStory)]
  });
  if (media) await pool.query({ text: "UPDATE media_assets SET article_id=$1, updated_at=now() WHERE id=$2", values: [result.rows[0].id, media.id] });
  return result.rows[0];
}

async function transitionArticle(pool, user, data) {
  const found = await pool.query({ text: "SELECT * FROM articles WHERE id=$1 AND source_provider='newsneta-cms' LIMIT 1", values: [data.id] });
  const article = found.rows[0];
  if (!article) throw Object.assign(new Error("Article not found"), { status: 404 });
  const to = clean(data.to, 40);
  if (!auth.transitionAllowed(user.role, article.status, to)) throw Object.assign(new Error(`Invalid ${user.role} transition from ${article.status} to ${to}`), { status: 409 });
  if (to === "reviewer_approved" && article.featured_media?.id) {
    const media = await pool.query({ text: "SELECT caption, alt_text, source, copyright_owner, license FROM media_assets WHERE id=$1", values: [article.featured_media.id] });
    const asset = media.rows[0];
    if (!asset || !asset.caption || !asset.alt_text || !asset.source || !asset.copyright_owner || !asset.license) throw Object.assign(new Error("Media rights, caption and alt text are required before approval"), { status: 409 });
    await pool.query({ text: "UPDATE media_assets SET status='approved', approved_by=$1, updated_at=now() WHERE id=$2", values: [user.id, article.featured_media.id] });
  }
  const publishedAt = to === "published" ? "now()" : "published_at";
  const result = await pool.query({
    text: `UPDATE articles SET status=$1, reviewer_id=CASE WHEN $2='reviewer' THEN $3 ELSE reviewer_id END,
      publisher_id=CASE WHEN $2='admin' THEN $3 ELSE publisher_id END, published_at=${publishedAt},
      content_revision=content_revision+1, updated_at=now() WHERE id=$4 RETURNING *`,
    values: [to, user.role, user.id, article.id]
  });
  await pool.query({ text: `INSERT INTO article_workflow (article_id,from_status,to_status,action,comments,actor_id,actor_role)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, values: [article.id, article.status, to, clean(data.action, 120) || `Transition to ${to}`, clean(data.comments, 4000) || null, user.id, user.role] });
  return result.rows[0];
}

async function uploadMedia(request, pool, user) {
  if (!["reporter", "admin"].includes(user.role)) throw Object.assign(new Error("Role cannot upload media"), { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw Object.assign(new Error("A media file is required"), { status: 400 });
  if (!allowedMime.has(file.type) || file.size > maxUpload(file.type)) throw Object.assign(new Error("Unsupported media type or file size"), { status: 400 });
  const extension = clean(file.name, 180).split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const suffix = process.env.CONTEXT === "production" ? "" : `-${String(process.env.DEPLOY_ID || process.env.CONTEXT || "local").replace(/[^a-z0-9-]/gi, "-")}`;
  const store = getStore({ name: "newsneta-media" + suffix, consistency: "strong" });
  await store.set(key, file, { metadata: { contentType: file.type, fileName: file.name, uploadedBy: user.id } });
  const publicUrl = `${new URL(request.url).origin}/.netlify/functions/media?key=${encodeURIComponent(key)}`;
  const inserted = await pool.query({
    text: `INSERT INTO media_assets (storage_key,public_url,mime_type,file_name,file_size,caption,alt_text,source,copyright_owner,license,uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    values: [key, publicUrl, file.type, clean(file.name, 500), file.size, clean(form.get("caption"), 2000) || null,
      clean(form.get("altText"), 1000) || null, clean(form.get("source"), 1000) || null,
      clean(form.get("copyrightOwner"), 1000) || null, clean(form.get("license"), 1000) || null, user.id]
  });
  return inserted.rows[0];
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || (request.method === "GET" ? "list" : "save");
    if (action === "login") {
      const data = await request.json();
      const user = auth.authenticateCredentials(data.email, data.password, data.role, process.env);
      if (!user) return json(401, { status: "unauthorized" });
      return json(200, { status: "ok", user, token: auth.signSession(user, process.env.CMS_SESSION_SECRET) });
    }
    const user = session(request);
    if (!user) return json(401, { status: "unauthorized" });
    const { pool } = getDatabase();
    if (request.method === "GET" && action === "list") return json(200, { status: "ok", items: await listArticles(pool, user) });
    if (action === "upload") return json(201, { status: "ok", media: await uploadMedia(request, pool, user) });
    const data = await request.json();
    if (action === "save") return json(200, { status: "ok", article: await saveArticle(pool, user, data) });
    if (action === "transition") return json(200, { status: "ok", article: await transitionArticle(pool, user, data) });
    if (action === "delete") {
      if (user.role !== "admin") return json(403, { status: "forbidden" });
      const deleted = await pool.query({ text: "UPDATE articles SET status='deleted', content_revision=content_revision+1, updated_at=now() WHERE id=$1 AND source_provider='newsneta-cms' RETURNING id", values: [data.id] });
      return deleted.rows.length ? json(200, { status: "ok" }) : json(404, { status: "not-found" });
    }
    return json(404, { status: "not-found" });
  } catch (error) {
    console.error(JSON.stringify({ code: "CMS_REQUEST_FAILED", message: error.message, timestamp: new Date().toISOString() }));
    return json(error.status || 500, { status: "error", message: error.status ? error.message : "CMS request failed" });
  }
}