const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

test("image proxy only accepts approved HTTPS media hosts", async () => {
  const proxy = await import(pathToFileURL(path.join(root, "netlify/functions/image.mjs")));
  assert.equal(proxy.allowedImageUrl("https://thumb.wikimedia.org/example.jpg").hostname, "thumb.wikimedia.org");
  assert.equal(proxy.allowedImageUrl("https://upload.wikimedia.org/example.jpg").hostname, "upload.wikimedia.org");
  assert.equal(proxy.allowedImageUrl("https://images.unsplash.com/photo-example").hostname, "images.unsplash.com");
  assert.equal(proxy.allowedImageUrl("http://thumb.wikimedia.org/example.jpg"), null);
  assert.equal(proxy.allowedImageUrl("https://unsplash.com/photos/example"), null);
  assert.equal(proxy.allowedImageUrl("https://example.com/internal"), null);
  assert.equal(proxy.allowedImageUrl("file:///etc/passwd"), null);
});

test("news API rewrites approved archive media to same-origin delivery", async () => {
  const news = await import(pathToFileURL(path.join(root, "netlify/functions/news.mjs")));
  const remote = "https://thumb.wikimedia.org/wikipedia/example.jpg";
  const delivered = news.deliveryImageUrl(remote, "https://newsneta.com");
  assert.equal(delivered, `https://newsneta.com/.netlify/functions/image?url=${encodeURIComponent(remote)}`);
  const representative = "https://images.unsplash.com/photo-example?auto=format&fit=crop&w=900&q=80";
  assert.equal(news.deliveryImageUrl(representative, "https://newsneta.com"), `https://newsneta.com/.netlify/functions/image?url=${encodeURIComponent(representative)}`);
  assert.equal(news.deliveryImageUrl("https://licensed.example/article.jpg", "https://newsneta.com"), "https://licensed.example/article.jpg");
});

test("legacy feed records receive deterministic approved representative media", () => {
  const { _test } = require(path.join(root, "netlify/lib/news-core.js"));
  const row = {
    id: "legacy-feed-story",
    source_article_id: "legacy-feed-story",
    title: "తెలంగాణలో భారీ వర్షాలు, వాతావరణ శాఖ హెచ్చరిక",
    summary: "రాష్ట్రంలోని పలు జిల్లాలకు వర్ష సూచన.",
    category: "telangana",
    state: "Telangana",
    district: "Hyderabad",
    author_id: "feed:google-news",
    featured_media: null,
    image_url: null,
    content_status: "brief",
    source_url: "https://example.com/story",
    source_name: "Example Telugu",
    published_at: new Date().toISOString()
  };
  const first = _test.persistedArticleFromRow(row);
  const second = _test.persistedArticleFromRow(row);
  assert.match(first.image, /^https:\/\/images\.unsplash\.com\/photo-/);
  assert.equal(first.image, second.image);
  assert.equal(first.imageLabel, "REPRESENTATIVE IMAGE");
  assert.equal(first.mediaDecision.imageType, "representative");
  assert.equal(first.mediaDecision.requiresReview, false);
});
