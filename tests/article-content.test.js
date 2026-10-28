const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const news = require("../netlify/lib/news-core")._test;
const ingestion = require("../netlify/lib/ingest-news-core")._test;

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

test("authorized provider full text is preserved with paragraphs", () => {
  const previous = process.env.NEWS_LICENSED_FULLTEXT_SOURCES;
  process.env.NEWS_LICENSED_FULLTEXT_SOURCES = "Licensed Telugu Wire";
  try {
    const body = "మొదటి పేరాలో ధృవీకరించిన ప్రధాన పరిణామాన్ని పూర్తిగా వివరిస్తుంది. ".repeat(4)
      + "\n\n## నేపథ్యం\n\n"
      + "రెండో పేరాలో అధికారిక నేపథ్యం, సంబంధిత వ్యక్తులు, తదుపరి చర్యలను వివరిస్తుంది. ".repeat(4);
    const content = news.classifyProviderContent({ sourceName: "Licensed Telugu Wire", title: "పూర్తి కథనం", summary: "సంక్షిప్తం", body });
    assert.equal(content.contentStatus, "licensed_full_text");
    assert.equal(content.body, news.normalizeLicensedBody(body));
    assert.equal(content.fullContentReviewRequired, false);
    const article = ingestion.canonicalArticle({ id: "licensed-1", title: "పూర్తి కథనం", description: "సంక్షిప్తం", body: content.body, contentStatus: content.contentStatus, pubDate: new Date().toISOString(), link: "https://licensed.example/story", source: "Licensed Telugu Wire" }, "national", "licensed-provider");
    assert.equal(article.body, news.normalizeLicensedBody(body));
    assert.equal(article.contentStatus, "licensed_full_text");
  } finally {
    if (previous === undefined) delete process.env.NEWS_LICENSED_FULLTEXT_SOURCES;
    else process.env.NEWS_LICENSED_FULLTEXT_SOURCES = previous;
  }
});

test("unlicensed, truncated and metadata-only provider content remains a reviewable brief", () => {
  const previous = process.env.NEWS_LICENSED_FULLTEXT_SOURCES;
  process.env.NEWS_LICENSED_FULLTEXT_SOURCES = "Licensed Telugu Wire";
  try {
    const longBody = "Verified source paragraph with enough content for a complete syndicated article. ".repeat(8);
    const unlicensed = news.classifyProviderContent({ sourceName: "Vaartha Telugu", title: "Instagram Crackdown", summary: "", body: longBody });
    assert.equal(unlicensed.contentStatus, "brief");
    assert.equal(unlicensed.body, "");
    assert.equal(unlicensed.fullContentReviewRequired, true);
    const truncated = news.classifyProviderContent({ sourceName: "Licensed Telugu Wire", title: "Story", summary: "", body: `${longBody}[+420 chars]` });
    assert.equal(truncated.contentStatus, "brief");
    const rssMetadata = news.classifyProviderContent({ sourceName: "Vaartha Telugu", title: "Instagram Crackdown", summary: "", body: '<a href="https://news.google.com/story">Instagram Crackdown</a> Vaartha Telugu' });
    assert.equal(rssMetadata.contentStatus, "brief");
  } finally {
    if (previous === undefined) delete process.env.NEWS_LICENSED_FULLTEXT_SOURCES;
    else process.env.NEWS_LICENSED_FULLTEXT_SOURCES = previous;
  }
});

test("brief review flags are persisted by migration and ingestion", () => {
  const ingestionSource = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "ingest-news-core.js"), "utf8");
  const migration = fs.readFileSync(path.join(__dirname, "..", "netlify", "database", "migrations", "20261028103000_full_content_review", "migration.sql"), "utf8");
  assert.match(ingestionSource, /full_content_review_required/);
  assert.match(ingestionSource, /full_content_review_reason/);
  assert.match(migration, /WHERE "content_status" = 'brief'/);
});
