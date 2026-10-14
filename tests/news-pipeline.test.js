const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const news = require("../netlify/lib/news-core")._test;
const ingestion = require("../netlify/lib/ingest-news-core")._test;

test("category aliases preserve canonical feeds", () => {
  assert.equal(news.normalizeCategory("Andhra Pradesh"), "ap");
  assert.equal(news.normalizeCategory("TG"), "telangana");
  assert.equal(news.normalizeCategory("world"), "international");
  assert.equal(news.normalizeCategory("unknown"), "telangana");
});

test("fresh feed normalization removes duplicate article identities", () => {
  const now = new Date().toISOString();
  const items = [
    { title: "తెలంగాణలో తాజా పరీక్ష వార్తలు", link: "https://example.com/1", pubDate: now },
    { title: "తెలంగాణలో తాజా పరీక్ష వార్తలు", link: "https://example.com/2", pubDate: now },
    { title: "ఆంధ్రప్రదేశ్‌లో మరో తాజా కథనం", link: "https://example.com/3", pubDate: now }
  ];
  assert.equal(news.freshSorted(items).length, 2);
});

test("RSS item without associated media remains text-only", () => {
  const media = news.feedAssociatedMedia({ title: "తెలంగాణలో తాజా పరీక్ష వార్తలు" }, "telangana", "");
  assert.equal(media.url, null);
  assert.equal(media.imageType, "missing");
});

test("RSS media remains associated with the same article", () => {
  const url = "https://media.example.com/article-123.jpg";
  const media = news.feedAssociatedMedia({ title: "ఆంధ్రప్రదేశ్‌లో తాజా పరీక్ష వార్తలు", enclosure: { url } }, "ap", "");
  assert.equal(media.url, url);
  assert.equal(media.imageType, "event_candidate");
});

test("placeholder and logo image URLs are rejected", () => {
  assert.equal(news.trustedImageUrl("https://example.com/logo.png"), false);
  assert.equal(news.trustedImageUrl("https://example.com/placeholder.jpg"), false);
  assert.equal(news.trustedImageUrl("https://example.com/article.jpg"), true);
});

test("ingestion keeps stable identity and media on one canonical article", () => {
  const item = {
    id: "provider-article-123",
    title: "తెలంగాణలో తాజా పరీక్ష వార్తలు",
    pubDate: "2026-10-13T04:00:00.000Z",
    link: "https://publisher.example/article-123",
    source: "Licensed Publisher",
    media: { url: "https://media.example/article-123.jpg", imageType: "event_candidate" }
  };
  const first = ingestion.canonicalArticle(item, "telangana", "licensed-news-api");
  const second = ingestion.canonicalArticle(item, "telangana", "licensed-news-api");
  assert.equal(first.identity, second.identity);
  assert.equal(first.slug, second.slug);
  assert.equal(first.imageUrl, item.media.url);
  assert.equal(first.featuredMedia.url, item.media.url);
});

test("service worker clones before cache write and keeps representation parameters", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const clone = source.indexOf("const responseForCache = networkResponse.clone()");
  const put = source.indexOf("cache.put(stableRequest, responseForCache)");
  assert.ok(clone >= 0 && put > clone);
  assert.match(source, /searchParams\.delete\("refresh"\)/);
  assert.doesNotMatch(source, /searchParams\.delete\("cat"\)/);
  assert.doesNotMatch(source, /searchParams\.delete\("category"\)/);
  assert.doesNotMatch(source, /searchParams\.delete\("district"\)/);
});

test("service worker uses network-first media and does not cache failed images", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const mediaHandler = source.slice(source.indexOf("async function handleImageRequest"), source.indexOf("self.addEventListener(\"activate\""));
  assert.match(source, /CACHE_VERSION = "v83"/);
  assert.match(mediaHandler, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.match(mediaHandler, /isCacheableImage\(response\)/);
  assert.match(mediaHandler, /cache\.match\(request\)/);
});

test("ingestion preserves valid persisted media when a later source update has none", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "ingest-news-core.js"), "utf8");
  assert.match(source, /image_url=COALESCE\(EXCLUDED\.image_url, articles\.image_url\)/);
  assert.match(source, /featured_media=COALESCE\(EXCLUDED\.featured_media, articles\.featured_media\)/);
});
test("media validation falls back from rejected HEAD to a successful image GET", async () => {
  const originalFetch = global.fetch;
  const methods = [];
  global.fetch = async (_url, options = {}) => {
    methods.push(options.method);
    if (options.method === "HEAD") return new Response("", { status: 405 });
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
      status: 206,
      headers: { "content-type": "image/jpeg" }
    });
  };
  try {
    assert.equal(await ingestion.validateMediaUrl("https://media.example/article.jpg"), true);
    assert.deepEqual(methods, ["HEAD", "GET"]);
  } finally {
    global.fetch = originalFetch;
  }
});
