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
  const activeDetail = page.slice(page.indexOf("function renderStoryDetail(story)"), page.indexOf("function closeStoryModal()"));
  assert.match(activeDetail, /storyDescription\(story\)/);
  assert.match(activeDetail, /searchParams\.set\("article"/);
  assert.doesNotMatch(activeDetail, /NewsNeta Desk:.*నిరంతరం అప్డేట్లు/);
});

test("article summaries reject generic publisher taglines", () => {
  const selector = page.slice(page.indexOf("function isGenericStoryDescription"), page.indexOf("function heroStorySummary"));
  assert.match(selector, /normalized === normalizedTitle/);
  assert.match(selector, /normalized\.includes\(normalizedTitle\)/);
  assert.match(selector, /breaking news/);
  assert.match(selector, /storyDescription\(story\)/);
});

test("frontend hides unreviewed archive and representative images", () => {
  const extractor = page.slice(page.indexOf("function extractSourceImage"), page.indexOf("function chooseRelevantImage"));
  assert.match(extractor, /decision\.requiresReview !== true/);
  assert.match(extractor, /decisionScore >= 80/);
  assert.match(extractor, /event_candidate/);
  assert.match(extractor, /cms_approved/);
  assert.match(extractor, /featuredMedia/);
});

test("scheduled feed ingestion labels snippets as briefs", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "ingest-news-core.js"), "utf8");
  assert.match(source, /const contentStatus = item\.contentStatus === "licensed_full_text" \? "licensed_full_text" : "brief"/);
  assert.match(source, /content_status=CASE/);
  assert.match(source, /THEN articles\.content_status/);
  assert.match(source, /safeBody\(item\.body \|\| item\.fullArticle\)/);
  assert.match(source, /contentStatus === "licensed_full_text"/);
});

test("brief ingestion never promotes a summary into the article body", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "ingest-news-core.js"), "utf8");
  assert.match(source, /body: contentStatus === "licensed_full_text" \? safeBody/);
  assert.doesNotMatch(source, /body: safeText\(item\.body \|\| item\.description/);
});
