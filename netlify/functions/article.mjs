import { getDatabase } from "@netlify/database";
import "rss-parser";
import newsCore from "../lib/news-core.js";

const BRAND_IMAGE = "/assets/brand/v1/social-share-1200x630.png";

const escapeHtml = value => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const clean = (value, max = 4000) => String(value || "").replace(/\0/g, "").trim().slice(0, max);

function canonicalMediaUrl(value, origin) {
  if (!value) return new URL(BRAND_IMAGE, origin).href;
  try {
    const url = new URL(value, origin);
    if (url.pathname === "/.netlify/functions/media") return `${origin}${url.pathname}${url.search}`;
    if (["thumb.wikimedia.org", "upload.wikimedia.org"].includes(url.hostname.toLowerCase())) {
      return `${origin}/.netlify/functions/image?url=${encodeURIComponent(url.href)}`;
    }
    return url.protocol === "https:" ? url.href : new URL(BRAND_IMAGE, origin).href;
  } catch {
    return new URL(BRAND_IMAGE, origin).href;
  }
}

function articleParagraphs(value) {
  const paragraphs = clean(value, 100000).split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  return paragraphs.length
    ? paragraphs.map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("")
    : "<p>Details are not available for this report.</p>";
}

function pageHtml(article, requestUrl) {
  const origin = requestUrl.origin;
  const story = newsCore._test.persistedArticleFromRow(article);
  const canonical = `${origin}/news/${encodeURIComponent(article.slug || article.id)}`;
  const description = clean(story.sourceDescription || story.summary || story.title, 600);
  const content = story.contentStatus === "brief" ? description : clean(story.body || description, 100000);
  const image = canonicalMediaUrl(article.social_image_url || article.thumbnail_url || story.image, origin);
  const imageIsFallback = image.endsWith(BRAND_IMAGE);
  const imageAlt = imageIsFallback ? "NewsNeta branded news preview" : clean(story.imageAlt || story.title, 500);
  const published = new Date(story.publishedAt || story.pubDate || Date.now()).toISOString();
  const modified = new Date(story.updatedAt || story.publishedAt || story.pubDate || Date.now()).toISOString();
  const publisher = clean(story.sourceName || story.source || "NewsNeta", 200);
  const category = clean(story.category || "News", 100);
  const statusLabel = story.contentStatus === "brief" ? "News Brief" : "Full Article";
  return `<!doctype html>
<html lang="te"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(story.title)} | NewsNeta</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="NewsNeta">
<meta property="og:title" content="${escapeHtml(story.title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
<meta property="article:published_time" content="${published}"><meta property="article:modified_time" content="${modified}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(story.title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="icon" href="/assets/brand/v1/favicon-32.png">
<style>
:root{--red:#d50000;--ink:#172033;--muted:#64748b;--line:#e2e8f0;--surface:#fff;--bg:#f5f7fa}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans Telugu","Nirmala UI",Arial,sans-serif;line-height:1.72}header{background:#fff;border-bottom:1px solid var(--line)}.header-inner{max-width:1120px;margin:auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}.brand{width:min(300px,58vw);height:70px;object-fit:contain}.home{color:var(--red);font-weight:800;text-decoration:none}.article{max-width:920px;margin:28px auto;background:var(--surface);padding:clamp(20px,4vw,52px);border:1px solid var(--line)}.category{color:var(--red);font-weight:900;text-transform:uppercase}.article h1{font-size:clamp(30px,5vw,52px);line-height:1.25;margin:10px 0}.meta{color:var(--muted);font-weight:700;margin-bottom:22px}.hero{width:100%;max-height:560px;object-fit:cover;background:#eef2f7}.caption{font-size:13px;color:var(--muted);margin:6px 0 8px}.social-row{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:10px 0 24px}.social-row a,.social-row button{display:grid;place-items:center;width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:#fff;color:var(--ink);font:900 15px/1 Arial;text-decoration:none;cursor:pointer}.social-row a:focus-visible,.social-row button:focus-visible{outline:3px solid rgba(213,0,0,.3);outline-offset:2px}.social-row .wa{color:#128c7e}.social-row .fb{color:#1877f2}.social-row .li{color:#0a66c2}.share-status{width:100%;text-align:center;color:var(--muted);font-size:13px;min-height:18px}.brief{display:inline-block;background:#fff1f2;color:#b91c1c;padding:4px 10px;font-weight:800;margin:12px 0}.content{font-size:clamp(18px,2.1vw,21px)}.content p{margin:0 0 1.25em}.toolbar{border-top:1px solid var(--line);margin-top:30px;padding-top:18px;display:flex;gap:10px;flex-wrap:wrap}.toolbar button{border:0;background:var(--red);color:#fff;padding:11px 20px;font-weight:800;cursor:pointer}.audio-options{display:none;width:100%;gap:12px;align-items:center}.audio-options.open{display:flex}@media(max-width:600px){.header-inner{padding:8px 12px}.brand{height:50px}.article{margin:0;border-width:0;padding:20px 16px}.article h1{font-size:30px}.content{font-size:18px}.social-row{gap:8px}.social-row a,.social-row button{width:42px;height:42px}}
</style></head><body>
<header><div class="header-inner"><a href="/"><img class="brand" src="/assets/brand/v1/wordmark-desktop.png" alt="NewsNeta"></a><a class="home" href="/">Home</a></div></header>
<main class="article"><div class="category">${escapeHtml(category)}</div><h1>${escapeHtml(story.title)}</h1>
<div class="meta">${escapeHtml(publisher)} · <time datetime="${published}">${escapeHtml(new Date(published).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }))}</time></div>
<img class="hero" src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}"><div class="caption">${escapeHtml(imageIsFallback ? "NewsNeta branded preview · Event photograph unavailable" : (story.imageLabel || imageAlt))}</div>
<div class="social-row" aria-label="Share this article"><a class="fb" aria-label="Share on Facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}" target="_blank" rel="noopener">f</a><a class="wa" aria-label="Share on WhatsApp" href="https://api.whatsapp.com/send?text=${encodeURIComponent(`${story.title} ${canonical}`)}" target="_blank" rel="noopener">◉</a><a aria-label="Share on X" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(story.title)}&url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener">X</a><a class="li" aria-label="Share on LinkedIn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener">in</a><button id="copy" type="button" aria-label="Copy article link">⌁</button><span class="share-status" id="copyStatus" aria-live="polite"></span></div>
${story.contentStatus === "brief" ? `<span class="brief">${statusLabel}</span>` : ""}<section class="content" id="articleContent">${articleParagraphs(content)}</section>
<div class="toolbar" aria-label="Article actions"><button id="listen" type="button">Listen</button>
<div class="audio-options" id="audioOptions"><label>Voice <select id="voice"><option value="auto">Auto</option><option value="female">Female Telugu</option><option value="male">Male Telugu</option></select></label><label>Speed <input id="speed" type="range" min="0.75" max="1.25" step="0.05" value="0.95"></label></div>
</div></main>
<script>const shareData={title:${JSON.stringify(story.title)},text:${JSON.stringify(description)},url:${JSON.stringify(canonical)}};const listen=document.getElementById('listen'),audio=document.getElementById('audioOptions');listen.onclick=()=>{if(!('speechSynthesis'in window))return;audio.classList.toggle('open');if(speechSynthesis.speaking){speechSynthesis.cancel();listen.textContent='Listen';return}const u=new SpeechSynthesisUtterance(document.getElementById('articleContent').innerText);u.lang='te-IN';u.rate=Number(document.getElementById('speed').value);u.onend=()=>listen.textContent='Listen';speechSynthesis.speak(u);listen.textContent='Pause'};document.getElementById('copy').onclick=async()=>{await navigator.clipboard.writeText(shareData.url);document.getElementById('copyStatus').textContent='Link copied'};</script>
</body></html>`;
}

export default async function handler(request) {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const identity = clean(url.searchParams.get("slug") || url.pathname.split("/").filter(Boolean).pop(), 500);
  if (!identity) return new Response("Article not found", { status: 404 });
  try {
    const { pool } = getDatabase();
    const result = await pool.query({
      text: `SELECT id, slug, title, summary, source_description, body, category, state, district, image_url,
        thumbnail_url, social_image_url, featured_media, source_url, source_name, published_at, source_published_at,
        updated_at, views, content_revision, content_status, image_alt, author_id,
        full_content_review_required, full_content_review_reason FROM articles
        WHERE status='published' AND (slug=$1 OR id::text=$1 OR source_article_id=$1)
        ORDER BY CASE WHEN slug=$1 THEN 0 WHEN id::text=$1 THEN 1 ELSE 2 END LIMIT 1`,
      values: [decodeURIComponent(identity)]
    });
    if (!result.rows[0]) return new Response("Article not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(pageHtml(result.rows[0], url), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" }
    });
  } catch (error) {
    console.error(JSON.stringify({ code: "ARTICLE_PAGE_FAILED", message: error.message, timestamp: new Date().toISOString() }));
    return new Response("Article temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}

export { canonicalMediaUrl, pageHtml };
