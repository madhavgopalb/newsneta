const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("article reader distinguishes complete content from syndicated briefs", () => {
  const renderer = page.slice(page.indexOf("function buildExpandedArticle(story)"), page.indexOf("function storyMediaGallery(story)"));
  assert.match(renderer, /newsroom_full_text/);
  assert.match(renderer, /licensed_full_text/);
  assert.match(renderer, /Read original report/);
  assert.match(renderer, /articleBodyMarkup\(fullBody\)/);
  assert.doesNotMatch(renderer, /slice\(0,\s*(?:8|12)\)/);
  assert.doesNotMatch(renderer, /trust score|public impact|next expected updates/i);
});

test("article detail uses verified summary and a shareable direct URL", () => {
  const activeDetail = page.slice(page.lastIndexOf("function openStoryDetail(id)"), page.indexOf("function closeStoryModal()"));
  assert.match(activeDetail, /story\.description \|\| story\.summary \|\| story\.aiSummary/);
  assert.match(activeDetail, /searchParams\.set\("article"/);
  assert.doesNotMatch(activeDetail, /NewsNeta Desk:.*నిరంతరం అప్డేట్లు/);
});

test("scheduled feed ingestion labels snippets as briefs", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "ingest-news-core.js"), "utf8");
  assert.match(source, /contentStatus: item\.contentStatus === "licensed_full_text" \? "licensed_full_text" : "brief"/);
  assert.match(source, /content_status=EXCLUDED\.content_status/);
});
