const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const newsCore = require("../netlify/lib/news-core");
const news = newsCore._test;

const fullRow = {
  id: "9e047ca1-6f70-4bdd-93dd-e1a050eb3056",
  title: "తెలంగాణ పరీక్ష పూర్తి కథనం",
  summary: "కార్డులో మాత్రమే కనిపించే సంక్షిప్త సమాచారం.",
  body: "మొదటి పేరా పూర్తి వివరాలను అందిస్తుంది.\n\n## నేపథ్యం\n\nరెండో పేరా ధృవీకరించిన నేపథ్యాన్ని వివరిస్తుంది.",
  category: "telangana",
  state: "Telangana",
  district: "Hyderabad",
  status: "published",
  author_id: "reporter-1",
  image_url: "https://newsneta.example/.netlify/functions/media?key=article.jpg",
  thumbnail_url: "https://newsneta.example/.netlify/functions/media?key=article.jpg",
  featured_media: {
    id: "media-1",
    url: "https://newsneta.example/.netlify/functions/media?key=article.jpg",
    mimeType: "image/jpeg",
    imageType: "cms_approved",
    relevanceScore: 100
  },
  source_url: null,
  source_name: "NewsNeta",
  published_at: "2026-10-27T08:00:00.000Z",
  source_published_at: null,
  updated_at: "2026-10-27T09:00:00.000Z",
  views: 10,
  content_revision: 3,
  content_status: "newsroom_full_text",
  full_content_review_required: false,
  full_content_review_reason: null,
  image_alt: "Hyderabad newsroom test image"
};

test("persisted article serialization keeps summary, full Telugu body and approved image separate", () => {
  const article = news.persistedArticleFromRow(fullRow);
  assert.equal(article.summary, fullRow.summary);
  assert.equal(article.body, fullRow.body);
  assert.equal(article.fullArticle, fullRow.body);
  assert.equal(article.contentStatus, "newsroom_full_text");
  assert.equal(article.image, fullRow.featured_media.url);
  assert.equal(article.fullContentReviewRequired, false);
});

test("uploaded video metadata survives article serialization", () => {
  const row = {
    ...fullRow,
    image_url: "https://newsneta.example/.netlify/functions/media?key=poster.jpg",
    featured_media: {
      id: "video-1",
      url: "https://newsneta.example/.netlify/functions/media?key=story.mp4",
      thumbnailUrl: "https://newsneta.example/.netlify/functions/media?key=poster.jpg",
      mimeType: "video/mp4",
      imageType: "cms_approved"
    }
  };
  const article = news.persistedArticleFromRow(row);
  assert.deepEqual(article.video, {
    type: "uploaded",
    url: row.featured_media.url,
    mimeType: "video/mp4",
    posterUrl: row.featured_media.thumbnailUrl
  });
  assert.equal(article.image, row.featured_media.thumbnailUrl);
});

test("article detail endpoint returns only a published canonical record", async () => {
  let query;
  const response = await newsCore.handler(
    { queryStringParameters: { article: fullRow.id } },
    () => ({ pool: { query: async request => { query = request; return { rows: [fullRow] }; } } })
  );
  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.item.fullArticle, fullRow.body);
  assert.match(query.text, /status='published'/);
  assert.deepEqual(query.values, [fullRow.id]);
});

test("missing or unpublished article detail returns 404 instead of a cached summary", async () => {
  const response = await newsCore.handler(
    { queryStringParameters: { article: "removed-article" } },
    () => ({ pool: { query: async () => ({ rows: [] }) } })
  );
  assert.equal(response.statusCode, 404);
  assert.equal(JSON.parse(response.body).status, "not-found");
});

test("frontend fetches canonical detail, preserves old approved stories, and provides loading and retry states", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(source, /fetchStoryDetail\(id/);
  assert.match(source, /\.netlify\/functions\/news\?article=/);
  assert.match(source, /normalizeItems\(\[payload\.item\], \{allowStale:true\}\)/);
  assert.match(source, /data-article-retry/);
  assert.match(source, /articleDetailCache/);
  const opener = source.slice(source.indexOf("async function openStoryDetail"), source.indexOf("function renderStoryDetail"));
  assert.doesNotMatch(opener, /localStory\.persisted/);
  assert.match(opener, /fetchStoryDetail\(id/);
});

test("ingestion cannot downgrade an existing full article to a brief", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "ingest-news-core.js"), "utf8");
  assert.match(source, /articles\.content_status IN \('licensed_full_text','newsroom_full_text'\) AND EXCLUDED\.content_status='brief' THEN articles\.body/);
  assert.match(source, /THEN articles\.content_status/);
});

test("service worker evicts removed article responses before cache fallback", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const handler = source.slice(source.indexOf("async function handleNewsRequest"), source.indexOf("function isCacheableImage"));
  assert.match(handler, /networkResponse\.status === 404 \|\| networkResponse\.status === 410/);
  assert.match(handler, /cache\.delete\(stableRequest\)/);
  assert.ok(handler.indexOf("cache.delete(stableRequest)") < handler.indexOf("cache.match(stableRequest)"));
});
