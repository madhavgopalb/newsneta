const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

test("image proxy only accepts approved HTTPS media hosts", async () => {
  const proxy = await import(pathToFileURL(path.join(root, "netlify/functions/image.mjs")));
  assert.equal(proxy.allowedImageUrl("https://thumb.wikimedia.org/example.jpg").hostname, "thumb.wikimedia.org");
  assert.equal(proxy.allowedImageUrl("https://upload.wikimedia.org/example.jpg").hostname, "upload.wikimedia.org");
  assert.equal(proxy.allowedImageUrl("http://thumb.wikimedia.org/example.jpg"), null);
  assert.equal(proxy.allowedImageUrl("https://example.com/internal"), null);
  assert.equal(proxy.allowedImageUrl("file:///etc/passwd"), null);
});

test("news API rewrites approved archive media to same-origin delivery", async () => {
  const news = await import(pathToFileURL(path.join(root, "netlify/functions/news.mjs")));
  const remote = "https://thumb.wikimedia.org/wikipedia/example.jpg";
  const delivered = news.deliveryImageUrl(remote, "https://newsneta.com");
  assert.equal(delivered, `https://newsneta.com/.netlify/functions/image?url=${encodeURIComponent(remote)}`);
  assert.equal(news.deliveryImageUrl("https://licensed.example/article.jpg", "https://newsneta.com"), "https://licensed.example/article.jpg");
});
