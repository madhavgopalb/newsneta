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
const summaryFromBody = value => {
  const text = clean(value, 100000).replace(/\s+/g, " ");
  if (!text) return "";
  const sentences = text.match(/[^.!?।]+[.!?।]?/gu) || [text];
  return sentences.slice(0, 2).map(sentence => sentence.trim()).join(" ").trim().slice(0, 420);
};
const publishHash = data => crypto.createHash("sha256").update(JSON.stringify({
  headline: clean(data.headline || data.title, 500),
  body: clean(data.body, 100000),
  category: clean(data.category, 80),
  state: clean(data.state, 80),
  district: clean(data.district, 120),
  featuredMediaId: clean(data.featuredMediaId, 80),
  scheduledAt: clean(data.scheduledAt, 80),
  breaking: Boolean(data.breaking)
})).digest("hex");

async function listArticles(pool, user) {
  const result = await pool.query({
    text: `SELECT id, slug, title AS headline, english_title, summary, body, category, state, district,
      status, author_id AS reporter, reviewer_id AS reviewer, publisher_id AS admin,
      image_url AS image, thumbnail_url AS thumbnail, image_alt, media, featured_media,
      tags, is_breaking, is_top_story, scheduled_at, published_at, content_revision, content_status,
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
    const found = await pool.query({ text: "SELECT * FROM media_assets WHERE id=$1 AND uploaded_by=$2 LIMIT 1", values: [data.featuredMediaId, user.id] });
    media = found.rows[0] || null;
    if (!media) throw Object.assign(new Error("Featured media was not found or is not owned by this user"), { status: 403 });
    const evidence = clean(data.relevanceEvidence, 4000);
    const imageType = ["reporter_photo", "event_photo", "illustration"].includes(clean(data.imageType, 40)) ? clean(data.imageType, 40) : "reporter_photo";
    const updatedMedia = await pool.query({
      text: `UPDATE media_assets SET image_type=$1, relevance_evidence=$2::jsonb, rights_confirmed=$3, updated_at=now()
        WHERE id=$4 AND uploaded_by=$5 RETURNING *`,
      values: [imageType, JSON.stringify({ statement: evidence, humanConfirmed: Boolean(evidence) }), Boolean(data.rightsConfirmed), media.id, user.id]
    });
    media = updatedMedia.rows[0] || media;
  }
  const featured = media ? {
    id: media.id, url: media.public_url, thumbnailUrl: media.mime_type.startsWith("video/") ? (clean(data.posterUrl, 2000) || null) : media.public_url, mimeType: media.mime_type,
    caption: media.caption, altText: media.alt_text, source: media.source, copyrightOwner: media.copyright_owner,
    license: media.license, imageType: media.image_type || "reporter_photo", relevanceScore: media.status === "approved" ? 100 : 80,
    approvalStatus: media.status || "pending", requiresReview: media.status !== "approved", rightsConfirmed: Boolean(media.rights_confirmed),
    relevanceEvidence: media.relevance_evidence || {}, originalUrl: media.original_url || media.public_url
  } : null;
  const result = await pool.query({
    text: `INSERT INTO articles (slug,title,english_title,summary,body,category,state,district,status,author_id,
      image_url,thumbnail_url,image_alt,media,featured_media,tags,is_breaking,is_top_story,source_provider,source_article_id,content_revision,content_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,'newsneta-cms',$1,1,'newsroom_full_text')
      ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, english_title=EXCLUDED.english_title,
      summary=EXCLUDED.summary, body=EXCLUDED.body, category=EXCLUDED.category, state=EXCLUDED.state,
      district=EXCLUDED.district, image_url=COALESCE(EXCLUDED.image_url,articles.image_url),
      thumbnail_url=COALESCE(EXCLUDED.thumbnail_url,articles.thumbnail_url), image_alt=COALESCE(EXCLUDED.image_alt,articles.image_alt),
      media=CASE WHEN EXCLUDED.featured_media IS NOT NULL THEN EXCLUDED.media ELSE articles.media END,
      featured_media=COALESCE(EXCLUDED.featured_media,articles.featured_media), tags=EXCLUDED.tags,
      is_breaking=EXCLUDED.is_breaking, is_top_story=EXCLUDED.is_top_story, content_status='newsroom_full_text',
      content_revision=articles.content_revision+1, updated_at=now()
      RETURNING *`,
    values: [slug, headline, clean(data.englishTitle, 500) || null, clean(data.summary, 4000) || summaryFromBody(body), body,
      category, clean(data.state, 80) || null, clean(data.district, 120) || null, user.id,
      media?.mime_type?.startsWith("video/") ? (clean(data.posterUrl, 2000) || null) : (media?.public_url || null), media?.alt_text || clean(data.altText, 500) || null,
      JSON.stringify(featured ? [featured] : []), JSON.stringify(featured),
      JSON.stringify(Array.isArray(data.tags) ? data.tags.map(tag => clean(tag, 80)).filter(Boolean) : clean(data.tags, 500).split(",").map(tag => tag.trim()).filter(Boolean)),
      Boolean(data.breaking), Boolean(data.topStory)]
  });
  if (media) await pool.query({ text: "UPDATE media_assets SET article_id=$1, updated_at=now() WHERE id=$2", values: [result.rows[0].id, media.id] });
  return result.rows[0];
}

function validatePublication(data, article, media) {
  if (!article?.title || !article?.body || !article?.category) throw Object.assign(new Error("Headline, full description and category are required"), { status: 400 });
  const regional = ["telangana", "ap"].includes(String(article.category).toLowerCase()) || ["Telangana", "Andhra Pradesh"].includes(article.state);
  if (regional && (!article.state || !article.district)) throw Object.assign(new Error("State and district are required for regional news"), { status: 400 });
  if (media) {
    const missing = [["caption", media.caption], ["alt text", media.alt_text], ["source", media.source], ["copyright owner", media.copyright_owner], ["usage rights", media.license]].filter(([, value]) => !clean(value)).map(([label]) => label);
    if (missing.length) throw Object.assign(new Error(`Media verification is incomplete: ${missing.join(", ")}`), { status: 409 });
    if (!media.rights_confirmed) throw Object.assign(new Error("Media publication rights must be explicitly confirmed"), { status: 409 });
    const evidence = media.relevance_evidence?.statement || "";
    if (!clean(evidence, 4000) || media.relevance_evidence?.humanConfirmed !== true) throw Object.assign(new Error("Explain why the selected media belongs to this article"), { status: 409 });
  }
  if (data.scheduledAt) {
    const scheduled = new Date(data.scheduledAt);
    if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) throw Object.assign(new Error("Scheduled publication must be in the future"), { status: 400 });
  }
}

async function directAdminPublish(pool, user, data, idempotencyKey) {
  if (user.role !== "admin") throw Object.assign(new Error("Only an Admin can publish directly"), { status: 403 });
  const key = clean(idempotencyKey, 160);
  if (!/^[a-zA-Z0-9:_-]{16,160}$/.test(key)) throw Object.assign(new Error("A valid idempotency key is required"), { status: 400 });
  const requestHash = publishHash(data);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prior = await client.query({
      text: `SELECT article_id, request_hash FROM cms_publish_requests WHERE idempotency_key=$1 AND actor_id=$2 LIMIT 1`,
      values: [key, user.id]
    });
    if (prior.rows[0]) {
      if (prior.rows[0].request_hash !== requestHash) throw Object.assign(new Error("Idempotency key was already used for different content"), { status: 409 });
      const existing = await client.query({ text: "SELECT * FROM articles WHERE id=$1 LIMIT 1", values: [prior.rows[0].article_id] });
      await client.query("COMMIT");
      return { article: existing.rows[0], replayed: true };
    }

    const saved = await saveArticle(client, user, data);
    let media = null;
    if (saved.featured_media?.id) {
      const found = await client.query({ text: "SELECT * FROM media_assets WHERE id=$1 AND uploaded_by=$2 FOR UPDATE", values: [saved.featured_media.id, user.id] });
      media = found.rows[0] || null;
      if (!media) throw Object.assign(new Error("Featured media ownership could not be verified"), { status: 403 });
    }
    validatePublication(data, saved, media);
    if (media) {
      await client.query({ text: "UPDATE media_assets SET status='approved', approved_by=$1, updated_at=now() WHERE id=$2", values: [user.id, media.id] });
      await client.query({
        text: `UPDATE articles SET featured_media=jsonb_set(jsonb_set(jsonb_set(featured_media,'{approvalStatus}','\"approved\"'::jsonb),'{requiresReview}','false'::jsonb),'{rightsConfirmed}','true'::jsonb),
          media=jsonb_build_array(jsonb_set(jsonb_set(jsonb_set(featured_media,'{approvalStatus}','\"approved\"'::jsonb),'{requiresReview}','false'::jsonb),'{rightsConfirmed}','true'::jsonb)) WHERE id=$1`,
        values: [saved.id]
      });
    }
    const scheduled = Boolean(data.scheduledAt);
    const nextStatus = scheduled ? "scheduled" : "published";
    const updated = await client.query({
      text: `UPDATE articles SET status=$1::varchar, reviewer_id=$2, publisher_id=$2, approved_at=now(),
        scheduled_at=$3, published_at=CASE WHEN $1::varchar='published' THEN now() ELSE NULL END,
        source_notes=$4, is_breaking=$5, content_revision=content_revision+1, updated_at=now()
        WHERE id=$6 AND source_provider='newsneta-cms' RETURNING *`,
      values: [nextStatus, user.id, scheduled ? new Date(data.scheduledAt) : null, clean(data.sourceNotes, 8000) || null, Boolean(data.breaking), saved.id]
    });
    await client.query({
      text: `INSERT INTO article_workflow (article_id,from_status,to_status,action,comments,actor_id,actor_role)
        VALUES ($1,$2,$3,$4,$5,$6,'admin')`,
      values: [saved.id, saved.status, nextStatus, scheduled ? "Admin scheduled publication" : "Admin direct publish", clean(data.sourceNotes, 4000) || "Admin validated, approved and published in one transaction.", user.id]
    });
    await client.query({
      text: `INSERT INTO cms_publish_requests (idempotency_key,actor_id,request_hash,article_id) VALUES ($1,$2,$3,$4)`,
      values: [key, user.id, requestHash, saved.id]
    });
    await client.query("COMMIT");
    return { article: updated.rows[0], replayed: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function transitionArticle(pool, user, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query({ text: "SELECT * FROM articles WHERE id=$1 AND source_provider='newsneta-cms' FOR UPDATE", values: [data.id] });
    const article = found.rows[0];
    if (!article) throw Object.assign(new Error("Article not found"), { status: 404 });
    const to = clean(data.to, 40);
    if (!auth.transitionAllowed(user.role, article.status, to)) throw Object.assign(new Error(`Invalid ${user.role} transition from ${article.status} to ${to}`), { status: 409 });
    if (to === "reviewer_approved" && article.featured_media?.id) {
      const media = await client.query({ text: "SELECT caption, alt_text, source, copyright_owner, license, rights_confirmed, relevance_evidence FROM media_assets WHERE id=$1 FOR UPDATE", values: [article.featured_media.id] });
      const asset = media.rows[0];
      if (!asset || !asset.caption || !asset.alt_text || !asset.source || !asset.copyright_owner || !asset.license || !asset.rights_confirmed || !asset.relevance_evidence?.humanConfirmed) throw Object.assign(new Error("Media rights, relevance evidence, caption and alt text are required before approval"), { status: 409 });
      await client.query({ text: "UPDATE media_assets SET status='approved', approved_by=$1, updated_at=now() WHERE id=$2", values: [user.id, article.featured_media.id] });
      await client.query({ text: `UPDATE articles SET featured_media=jsonb_set(jsonb_set(jsonb_set(featured_media,'{approvalStatus}','\"approved\"'::jsonb),'{requiresReview}','false'::jsonb),'{rightsConfirmed}','true'::jsonb), media=jsonb_build_array(jsonb_set(jsonb_set(jsonb_set(featured_media,'{approvalStatus}','\"approved\"'::jsonb),'{requiresReview}','false'::jsonb),'{rightsConfirmed}','true'::jsonb)) WHERE id=$1`, values: [article.id] });
    }
    const publishedAt = to === "published" ? "now()" : "published_at";
    const result = await client.query({
      text: `UPDATE articles SET status=$1, reviewer_id=CASE WHEN $2='reviewer' THEN $3 ELSE reviewer_id END,
        publisher_id=CASE WHEN $2='admin' THEN $3 ELSE publisher_id END, published_at=${publishedAt},
        content_revision=content_revision+1, updated_at=now() WHERE id=$4 RETURNING *`,
      values: [to, user.role, user.id, article.id]
    });
    await client.query({ text: `INSERT INTO article_workflow (article_id,from_status,to_status,action,comments,actor_id,actor_role)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, values: [article.id, article.status, to, clean(data.action, 120) || `Transition to ${to}`, clean(data.comments, 4000) || null, user.id, user.role] });
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function uploadMedia(request, pool, user) {
  if (!["reporter", "admin"].includes(user.role)) throw Object.assign(new Error("Role cannot upload media"), { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw Object.assign(new Error("A media file is required"), { status: 400 });
  if (!allowedMime.has(file.type) || file.size > maxUpload(file.type)) throw Object.assign(new Error("Unsupported media type or file size"), { status: 400 });
  const extension = clean(file.name, 180).split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const store = getStore({ name: "newsneta-media", consistency: "strong" });
  await store.set(key, file, { metadata: { contentType: file.type, fileName: file.name, uploadedBy: user.id } });
  const publicUrl = `${new URL(request.url).origin}/.netlify/functions/media?key=${encodeURIComponent(key)}`;
  const inserted = await pool.query({
    text: `INSERT INTO media_assets (storage_key,public_url,original_url,mime_type,file_name,file_size,caption,alt_text,source,copyright_owner,license,image_type,relevance_evidence,rights_confirmed,uploaded_by)
      VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14) RETURNING *`,
    values: [key, publicUrl, file.type, clean(file.name, 500), file.size, clean(form.get("caption"), 2000) || null,
      clean(form.get("altText"), 1000) || null, clean(form.get("source"), 1000) || null,
      clean(form.get("copyrightOwner"), 1000) || null, clean(form.get("license"), 1000) || null,
      ["reporter_photo", "event_photo", "illustration"].includes(clean(form.get("imageType"), 40)) ? clean(form.get("imageType"), 40) : "reporter_photo",
      JSON.stringify({ statement: clean(form.get("relevanceEvidence"), 4000), humanConfirmed: Boolean(clean(form.get("relevanceEvidence"), 4000)) }),
      String(form.get("rightsConfirmed")) === "true", user.id]
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
    if (action === "publish-now" || action === "schedule") {
      const result = await directAdminPublish(pool, user, data, request.headers.get("Idempotency-Key") || data.idempotencyKey);
      return json(200, { status: "ok", ...result });
    }
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

export { directAdminPublish, summaryFromBody, validatePublication };
