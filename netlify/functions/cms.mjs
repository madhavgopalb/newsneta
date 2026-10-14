import crypto from "node:crypto";
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";
import auth from "../lib/cms-auth.js";

const json = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const bearer = request => String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
const clean = (value, max = 20000) => String(value || "").replace(/\0/g, "").trim().slice(0, max);
const slugify = value => clean(value, 220).toLowerCase().replace(/[^a-z0-9\u0c00-\u0c7f]+/gu, "-").replace(/^-|-$/g, "").slice(0, 200);
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const session = request => auth.verifySession(bearer(request), process.env.CMS_SESSION_SECRET);
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm"]);
const maxUpload = mime => mime.startsWith("video/") ? 150 * 1024 * 1024 : 8 * 1024 * 1024;
const editableByAdmin = new Set(["draft", "changes_requested", "reviewer_approved", "published", "unpublished"]);
const mediaStoreName = () => process.env.CONTEXT === "production"
  ? "newsneta-media"
  : "newsneta-media-" + clean(process.env.DEPLOY_ID || process.env.CONTEXT || "local", 80).replace(/[^a-z0-9-]/gi, "-");

async function inTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function listArticles(pool) {
  const result = await pool.query({
    text: `SELECT id, slug, title AS headline, english_title, summary, body, category, state, district,
      status, author_id AS reporter, reviewer_id AS reviewer, publisher_id AS admin,
      image_url AS image, thumbnail_url AS thumbnail, image_alt, media, featured_media,
      tags, is_breaking, is_top_story, scheduled_at, published_at, content_revision,
      created_at, updated_at FROM articles
      WHERE source_provider='newsneta-cms' ORDER BY updated_at DESC LIMIT 250`,
    values: []
  });
  return result.rows;
}

function normalizedArticle(data) {
  const headline = clean(data.headline || data.title, 500);
  const body = clean(data.body, 100000);
  const category = clean(data.category, 80).toLowerCase();
  const slug = slugify(data.slug || headline);
  if (!headline || !body || !category || !slug) throw fail("Headline, body, category and slug are required", 400);
  const tags = Array.isArray(data.tags)
    ? data.tags.map(tag => clean(tag, 80)).filter(Boolean).slice(0, 30)
    : clean(data.tags, 500).split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 30);
  return {
    headline, body, category, slug, tags,
    englishTitle: clean(data.englishTitle, 500) || null,
    summary: clean(data.summary, 4000) || null,
    state: clean(data.state, 80) || null,
    district: clean(data.district, 120) || null,
    altText: clean(data.altText, 500) || null,
    breaking: Boolean(data.breaking),
    topStory: Boolean(data.topStory)
  };
}

async function loadOwnedMedia(client, user, mediaId, articleId = null) {
  if (!mediaId) return null;
  if (!isUuid(mediaId)) throw fail("Invalid media ID", 400);
  const result = await client.query({ text: "SELECT * FROM media_assets WHERE id=$1 FOR UPDATE", values: [mediaId] });
  const media = result.rows[0];
  if (!media) throw fail("Featured media was not found", 400);
  if (media.status === "rejected") throw fail("Rejected media cannot be attached", 409);
  if (user.role === "reporter" && media.uploaded_by !== user.id) throw fail("Reporter cannot attach another user's media", 403);
  if (media.article_id && media.article_id !== articleId) throw fail("Media is already associated with another article", 409);
  return media;
}

function featuredMedia(media) {
  if (!media) return null;
  return {
    id: media.id, url: media.public_url, thumbnailUrl: media.public_url, mimeType: media.mime_type,
    caption: media.caption, altText: media.alt_text, source: media.source,
    copyrightOwner: media.copyright_owner, license: media.license,
    imageType: "cms_approved", relevanceScore: media.status === "approved" ? 100 : 80
  };
}

async function listWorkflow(pool, user, articleId) {
  if (!isUuid(articleId)) throw fail("Invalid article ID", 400);
  if (!["reviewer", "admin"].includes(user.role)) throw fail("Role cannot inspect workflow", 403);
  const result = await pool.query({ text: "SELECT from_status,to_status,action,comments,actor_id,actor_role,created_at FROM article_workflow WHERE article_id=$1 ORDER BY created_at,id", values: [articleId] });
  return result.rows;
}

async function saveArticle(pool, user, data) {
  if (!["reporter", "admin"].includes(user.role)) throw fail("Role cannot edit articles", 403);
  const value = normalizedArticle(data);
  if (data.id && !isUuid(data.id)) throw fail("Invalid article ID", 400);

  return inTransaction(pool, async client => {
    let current = null;
    if (data.id) {
      const found = await client.query({ text: "SELECT * FROM articles WHERE id=$1 FOR UPDATE", values: [data.id] });
      current = found.rows[0];
      if (!current) throw fail("Article not found", 404);
      if (current.source_provider !== "newsneta-cms") throw fail("Only CMS-owned articles can be edited", 403);
      if (user.role === "reporter" && current.author_id !== user.id) throw fail("Reporter cannot edit another reporter's article", 403);
      if (user.role === "reporter" && !["draft", "changes_requested"].includes(current.status)) throw fail("Article is not editable by reporter", 409);
      if (user.role === "admin" && !editableByAdmin.has(current.status)) throw fail("Article is not editable by admin", 409);
      const revision = Number(data.contentRevision);
      if (!Number.isInteger(revision) || revision !== current.content_revision) throw fail("Article revision is stale", 409);
    }

    const collision = await client.query({
      text: "SELECT id FROM articles WHERE slug=$1 AND ($2::uuid IS NULL OR id<>$2::uuid) LIMIT 1",
      values: [value.slug, current?.id || null]
    });
    if (collision.rows.length) throw fail("Article slug already exists", 409);

    const media = await loadOwnedMedia(client, user, data.featuredMediaId, current?.id || null);
    const featured = featuredMedia(media);
    let result;
    if (!current) {
      result = await client.query({
        text: `INSERT INTO articles (slug,title,english_title,summary,body,category,state,district,status,author_id,
          image_url,thumbnail_url,image_alt,media,featured_media,tags,is_breaking,is_top_story,source_provider,content_revision)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,'newsneta-cms',1)
          RETURNING *`,
        values: [value.slug,value.headline,value.englishTitle,value.summary,value.body,value.category,value.state,value.district,user.id,
          media?.public_url || null,media?.alt_text || value.altText,JSON.stringify(featured ? [featured] : []),JSON.stringify(featured),
          JSON.stringify(value.tags),value.breaking,value.topStory]
      });
    } else {
      result = await client.query({
        text: `UPDATE articles SET slug=$1,title=$2,english_title=$3,summary=$4,body=$5,category=$6,state=$7,district=$8,
          image_url=CASE WHEN $9::text IS NULL THEN image_url ELSE $9 END,
          thumbnail_url=CASE WHEN $9::text IS NULL THEN thumbnail_url ELSE $9 END,
          image_alt=COALESCE($10,image_alt),
          media=CASE WHEN $11::jsonb IS NULL THEN media ELSE jsonb_build_array($11::jsonb) END,
          featured_media=COALESCE($11::jsonb,featured_media),tags=$12::jsonb,is_breaking=$13,is_top_story=$14,
          content_revision=content_revision+1,updated_at=now()
          WHERE id=$15 AND source_provider='newsneta-cms' AND content_revision=$16 RETURNING *`,
        values: [value.slug,value.headline,value.englishTitle,value.summary,value.body,value.category,value.state,value.district,
          media?.public_url || null,media?.alt_text || value.altText,featured ? JSON.stringify(featured) : null,
          JSON.stringify(value.tags),value.breaking,value.topStory,current.id,current.content_revision]
      });
      if (!result.rows.length) throw fail("Article revision is stale", 409);
    }
    if (media) await client.query({ text: "UPDATE media_assets SET article_id=$1,updated_at=now() WHERE id=$2", values: [result.rows[0].id,media.id] });
    return result.rows[0];
  });
}

async function transitionArticle(pool, user, data) {
  if (!isUuid(data.id)) throw fail("Invalid article ID", 400);
  const to = clean(data.to, 40);
  return inTransaction(pool, async client => {
    const found = await client.query({ text: "SELECT * FROM articles WHERE id=$1 AND source_provider='newsneta-cms' FOR UPDATE", values: [data.id] });
    const article = found.rows[0];
    if (!article) throw fail("Article not found", 404);
    if (user.role === "reporter" && article.author_id !== user.id) throw fail("Reporter cannot submit another reporter's article", 403);
    if (!auth.transitionAllowed(user.role, article.status, to)) throw fail(`Invalid ${user.role} transition from ${article.status} to ${to}`, 409);

    let media = null;
    const mediaId = article.featured_media?.id;
    if (mediaId) {
      const foundMedia = await client.query({ text: "SELECT * FROM media_assets WHERE id=$1 AND article_id=$2 FOR UPDATE", values: [mediaId,article.id] });
      media = foundMedia.rows[0];
      if (!media) throw fail("Featured media is not associated with this article", 409);
      if (media.status === "rejected") throw fail("Rejected media cannot be published", 409);
    }
    if (to === "reviewer_approved" && media) {
      if (!media.caption || !media.alt_text || !media.source || !media.copyright_owner || !media.license) throw fail("Media rights, caption and alt text are required before approval", 409);
      await client.query({ text: "UPDATE media_assets SET status='approved',approved_by=$1,updated_at=now() WHERE id=$2", values: [user.id,media.id] });
      media.status = "approved";
    }
    if (to === "reviewer_rejected" && media) {
      await client.query({ text: "UPDATE media_assets SET status='rejected',updated_at=now() WHERE id=$1", values: [media.id] });
    }
    if (to === "published" && media && media.status !== "approved") throw fail("Featured media must be approved before publication", 409);

    const updated = await client.query({
      text: `UPDATE articles SET status=$1,
        reviewer_id=CASE WHEN $2='reviewer' THEN $3 ELSE reviewer_id END,
        publisher_id=CASE WHEN $2='admin' THEN $3 ELSE publisher_id END,
        published_at=CASE WHEN $1='published' THEN now() ELSE published_at END,
        content_revision=content_revision+1,updated_at=now()
        WHERE id=$4 AND status=$5 RETURNING *`,
      values: [to,user.role,user.id,article.id,article.status]
    });
    if (!updated.rows.length) throw fail("Article changed during transition", 409);
    await client.query({
      text: `INSERT INTO article_workflow (article_id,from_status,to_status,action,comments,actor_id,actor_role)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      values: [article.id,article.status,to,clean(data.action,120) || `Transition to ${to}`,clean(data.comments,4000) || null,user.id,user.role]
    });
    return updated.rows[0];
  });
}

async function deleteArticle(pool, user, data) {
  if (user.role !== "admin") throw fail("Admin role required", 403);
  if (!isUuid(data.id)) throw fail("Invalid article ID", 400);
  return inTransaction(pool, async client => {
    const found = await client.query({ text: "SELECT id,status FROM articles WHERE id=$1 AND source_provider='newsneta-cms' FOR UPDATE", values: [data.id] });
    const article = found.rows[0];
    if (!article) throw fail("Article not found", 404);
    await client.query({ text: "UPDATE articles SET status='deleted',content_revision=content_revision+1,updated_at=now() WHERE id=$1", values: [article.id] });
    await client.query({ text: "INSERT INTO article_workflow (article_id,from_status,to_status,action,actor_id,actor_role) VALUES ($1,$2,'deleted','Delete article',$3,$4)", values: [article.id,article.status,user.id,user.role] });
    return article.id;
  });
}

async function uploadMedia(request, pool, user) {
  if (!["reporter", "admin"].includes(user.role)) throw fail("Role cannot upload media", 403);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw fail("A media file is required", 400);
  if (!allowedMime.has(file.type) || file.size > maxUpload(file.type)) throw fail("Unsupported media type or file size", 400);
  const extension = clean(file.name, 180).split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${extension}`;
  const store = getStore({ name: mediaStoreName(), consistency: "strong" });
  await store.set(key,file,{ metadata:{ contentType:file.type,fileName:file.name,uploadedBy:user.id } });
  const publicUrl = `${new URL(request.url).origin}/.netlify/functions/media?key=${encodeURIComponent(key)}`;
  const inserted = await pool.query({
    text: `INSERT INTO media_assets (storage_key,public_url,mime_type,file_name,file_size,caption,alt_text,source,copyright_owner,license,uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    values: [key,publicUrl,file.type,clean(file.name,500),file.size,clean(form.get("caption"),2000)||null,clean(form.get("altText"),1000)||null,
      clean(form.get("source"),1000)||null,clean(form.get("copyrightOwner"),1000)||null,clean(form.get("license"),1000)||null,user.id]
  });
  return inserted.rows[0];
}

export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || (request.method === "GET" ? "list" : "save");
    if (action === "login") {
      if (request.method !== "POST") return json(405,{status:"method-not-allowed"});
      const data = await request.json();
      const user = auth.authenticateCredentials(clean(data.email,320),clean(data.password,500),clean(data.role,20).toLowerCase(),process.env);
      if (!user) return json(401,{status:"unauthorized"});
      return json(200,{status:"ok",user,token:auth.signSession(user,process.env.CMS_SESSION_SECRET)});
    }
    const user = session(request);
    if (!user) return json(401,{status:"unauthorized"});
    const { pool } = getDatabase();
    if (request.method === "GET" && action === "list") return json(200,{status:"ok",items:await listArticles(pool)});
    if (request.method === "GET" && action === "workflow") return json(200,{status:"ok",items:await listWorkflow(pool,user,url.searchParams.get("id"))});
    if (request.method !== "POST") return json(405,{status:"method-not-allowed"});
    if (action === "upload") return json(201,{status:"ok",media:await uploadMedia(request,pool,user)});
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw fail("Invalid request body",400);
    if (action === "save") return json(data.id ? 200 : 201,{status:"ok",article:await saveArticle(pool,user,data)});
    if (action === "transition") return json(200,{status:"ok",article:await transitionArticle(pool,user,data)});
    if (action === "delete") { await deleteArticle(pool,user,data); return json(200,{status:"ok"}); }
    return json(404,{status:"not-found"});
  } catch (error) {
    console.error(JSON.stringify({code:"CMS_REQUEST_FAILED",message:error.message,timestamp:new Date().toISOString()}));
    if (error.code === "23505") return json(409,{status:"error",message:"Article slug already exists"});
    const publicMessage = error.status ? error.message : (process.env.CONTEXT === "production" ? "CMS request failed" : clean(error.message, 300));
    return json(error.status||500,{status:"error",message:publicMessage});
  }
}

export { saveArticle, transitionArticle, deleteArticle, inTransaction, mediaStoreName };
