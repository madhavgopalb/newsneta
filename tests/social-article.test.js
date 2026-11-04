const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const publishedRow = {
  id: "9e047ca1-6f70-4bdd-93dd-e1a050eb3056",
  slug: "hyderabad-reporter-story",
  title: "హైదరాబాద్‌లో రిపోర్టర్ పూర్తి కథనం",
  summary: "కార్డు కోసం ధృవీకరించిన సంక్షిప్త సమాచారం.",
  source_description: "ప్రచురణకు ఆమోదించిన పూర్తి వివరణ.",
  body: "మొదటి పేరాలో పూర్తి సమాచారం ఉంది.\n\nరెండో పేరాలో ధృవీకరించిన వివరాలు ఉన్నాయి.",
  category: "telangana",
  state: "Telangana",
  district: "Hyderabad",
  author_id: "reporter-1",
  image_url: "https://old-preview.example/.netlify/functions/media?key=2026%2Farticle.jpg",
  thumbnail_url: "https://old-preview.example/.netlify/functions/media?key=2026%2Farticle.jpg",
  featured_media: {
    id: "media-1",
    storageKey: "2026/article.jpg",
    url: "https://old-preview.example/.netlify/functions/media?key=2026%2Farticle.jpg",
    mimeType: "image/jpeg",
    imageType: "reporter_photo",
    relevanceScore: 100,
    approvalStatus: "approved",
    requiresReview: false,
    rightsConfirmed: true,
    relevanceEvidence: { statement: "Reporter photographed the named event", humanConfirmed: true }
  },
  source_name: "NewsNeta",
  published_at: "2026-11-04T08:00:00.000Z",
  updated_at: "2026-11-04T09:00:00.000Z",
  content_status: "newsroom_full_text",
  image_alt: "హైదరాబాద్ రిపోర్టర్ కథనానికి సంబంధించిన చిత్రం"
};

test("server-rendered article HTML exposes article-specific social metadata before JavaScript", async () => {
  const { pageHtml } = await import("../netlify/functions/article.mjs");
  const html = pageHtml(publishedRow, new URL("https://newsneta.com/news/hyderabad-reporter-story"));
  assert.match(html, /<title>హైదరాబాద్‌లో రిపోర్టర్ పూర్తి కథనం \| NewsNeta<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/newsneta\.com\/news\/hyderabad-reporter-story">/);
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/newsneta\.com\/\.netlify\/functions\/media\?key=2026%2Farticle\.jpg">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /article:published_time/);
  assert.match(html, /మొదటి పేరాలో పూర్తి సమాచారం ఉంది/);
  assert.match(html, /రెండో పేరాలో ధృవీకరించిన వివరాలు ఉన్నాయి/);
  assert.ok(html.indexOf("og:title") < html.indexOf("<script>"));
});

test("article page uses a truthful branded fallback and only Listen and Share are prominent", async () => {
  const { pageHtml } = await import("../netlify/functions/article.mjs");
  const html = pageHtml({ ...publishedRow, image_url: null, thumbnail_url: null, featured_media: null }, new URL("https://newsneta.com/news/no-image"));
  assert.match(html, /social-share-1200x630\.png/);
  assert.match(html, /Event photograph unavailable/);
  assert.match(html, /id="listen"[^>]*>Listen<\/button><button id="share"[^>]*>Share<\/button>/);
  assert.doesNotMatch(html, /30 sec read|1 min read|Full article toggle|>Like<|>Important<|For More, Follow Us/);
});

test("public API rewrites durable CMS media to the active production origin", async () => {
  const { canonicalCmsMediaUrl, normalizeMediaDelivery } = await import("../netlify/functions/news.mjs");
  assert.equal(
    canonicalCmsMediaUrl("https://old-preview.example/.netlify/functions/media?key=article.jpg", "https://newsneta.com"),
    "https://newsneta.com/.netlify/functions/media?key=article.jpg"
  );
  const delivered = normalizeMediaDelivery({
    image: publishedRow.image_url,
    featuredMedia: publishedRow.featured_media,
    media: [publishedRow.featured_media]
  }, "https://newsneta.com");
  assert.equal(delivered.image, "https://newsneta.com/.netlify/functions/media?key=2026%2Farticle.jpg");
  assert.equal(delivered.featuredMedia.publicUrl, "https://newsneta.com/.netlify/functions/media?key=2026%2Farticle.jpg");
});

test("CMS save and publish media associations use transactions", () => {
  const source = fs.readFileSync(path.join(root, "netlify", "functions", "cms.mjs"), "utf8");
  const saveTransaction = source.slice(source.indexOf("async function saveArticleTransaction"), source.indexOf("async function transitionArticle"));
  assert.match(saveTransaction, /query\("BEGIN"\)/);
  assert.match(saveTransaction, /await saveArticle\(client, user, data\)/);
  assert.match(saveTransaction, /query\("COMMIT"\)/);
  assert.match(saveTransaction, /query\("ROLLBACK"\)/);
  assert.match(source, /storageKey: media\.storage_key/);
});

test("article reader falls back to its approved public feed record when detail fetch fails", () => {
  const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(source, /catch\(error\)\{[\s\S]*?if\(localStory\) renderStoryDetail\(localStory\)/);
});
