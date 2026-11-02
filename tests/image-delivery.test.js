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

test("representative media uses the story subject instead of only its state", () => {
  const { _test } = require(path.join(root, "netlify/lib/news-core.js"));
  const cases = [
    ["వీరాయపల్లిలో వేగంగా భూముల రీ-సర్వే", "ap", "agriculture"],
    ["చిన్నారుల భద్రత, ఆరోగ్యంపై ప్రత్యేక శ్రద్ధ పెట్టాలి", "ap", "health"],
    ["ఏపీలో మున్సిపల్ ఎన్నికల పోలింగ్ అప్‌డేట్స్", "ap", "politics"],
    ["రైల్వే వంతెన నిర్మాణంలో జాప్యం", "telangana", "infrastructure"],
    ["గ్రామీణ ఉపాధి పథకంలో కొత్త విధానం", "business", "jobs"],
    ["బిగ్ బాస్ బ్యూటీల లేటెస్ట్ ఫొటోలు", "viral", "cinema"]
  ];
  for (const [title, category, expectedSet] of cases) {
    const image = _test.selectImage(title, category, "", 0);
    assert.equal(image, {
      agriculture: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=76",
      health: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1000&q=76",
      politics: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1000&q=76",
      infrastructure: "https://images.unsplash.com/photo-1473445361085-b9a07f55608b?auto=format&fit=crop&w=1000&q=76",
      jobs: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1000&q=76",
      cinema: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=76"
    }[expectedSet]);
  }
});
