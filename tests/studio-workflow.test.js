const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("NewsNeta Studio exposes four primary newsroom actions", () => {
  const modal = page.slice(page.indexOf('id="loginBackdrop"'), page.indexOf('id="storyBackdrop"'));
  for (const label of ["Create Article", "Import Live Feeds", "Media Library", "Review &amp; Publish"]) {
    assert.match(modal, new RegExp(label.replace(/[&]/g, "&")));
  }
  assert.equal((modal.match(/<button class="cms-tab/g) || []).length, 4);
});

test("reporter creation screen documents direct device upload and the review path", () => {
  assert.match(page, /Reporter publishing steps/);
  assert.match(page, /Select one or more images, a thumbnail or video from this device/);
  assert.match(page, /Choose files directly from desktop or mobile/);
  assert.doesNotMatch(page, /data-cms-screen-jump="manage"/);
  assert.doesNotMatch(page, /data-cms-screen-jump="article"/);
});

test("feed import uses the signed CMS session and bounded categories", () => {
  const binding = page.slice(page.indexOf("function bindCmsScreen(role)"), page.indexOf("function switchCmsScreen"));
  assert.match(binding, /\.netlify\/functions\/refresh-news/);
  assert.match(binding, /cmsHeaders\(\)/);
  assert.match(binding, /slice\(0,4\)/);
});

test("media library retains article association and rights metadata", () => {
  const library = page.slice(page.indexOf("function cmsMediaLibraryScreen"), page.indexOf("function cmsScreenMarkup"));
  assert.match(library, /article\.headline/);
  assert.match(library, /item\.license/);
  assert.match(library, /item\.source/);
});

test("health endpoint accepts only an admin CMS session or health token", () => {
  const source = fs.readFileSync(path.join(root, "netlify", "functions", "news-health.mjs"), "utf8");
  assert.match(source, /verifySession/);
  assert.match(source, /cmsUser\?\.role === "admin"/);
  assert.match(source, /return json\(401/);
});
