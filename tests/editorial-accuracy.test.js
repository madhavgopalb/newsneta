const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ingestion = require("../netlify/lib/ingest-news-core")._test;
const news = require("../netlify/lib/news-core")._test;

const articleClasses = [
  ["Telangana reservation policy update", "https://images.example/japanese-street.jpg"],
  ["Andhra Pradesh financial assistance scheme", "https://images.example/desert-highway.jpg"],
  ["State government cabinet decision", "https://images.example/foreign-parliament.jpg"],
  ["Vegetable market prices rise", "https://images.example/generic-market.jpg"],
  ["Hyderabad drinking water update", "https://images.example/random-river.jpg"],
  ["Vijayawada traffic restrictions", "https://images.example/foreign-road.jpg"],
  ["Warangal hospital expansion", "https://images.example/office-team.jpg"],
  ["Visakhapatnam port review", "https://images.example/airport.jpg"],
  ["Telangana teacher recruitment", "https://images.example/sports-crowd.jpg"],
  ["AP crop insurance payment", "https://images.example/city-skyline.jpg"],
  ["National budget announcement", "https://images.example/beach.jpg"],
  ["International summit begins", "https://images.example/vegetables.jpg"],
  ["Telugu cinema release update", "https://images.example/parliament.jpg"],
  ["Cricket team selection", "https://images.example/market.jpg"],
  ["Technology policy consultation", "https://images.example/temple.jpg"],
  ["Business lending rates change", "https://images.example/stadium.jpg"],
  ["Education examination schedule", "https://images.example/factory.jpg"],
  ["District jobs notification", "https://images.example/film-set.jpg"],
  ["Weather warning for coastal districts", "https://images.example/classroom.jpg"],
  ["Election counting arrangements", "https://images.example/mountain.jpg"]
];

test("20 unrelated or unapproved feed images never become public article media", () => {
  for (const [title, url] of articleClasses) {
    const article = ingestion.canonicalArticle({
      id: title,
      title,
      pubDate: "2026-11-03T08:00:00.000Z",
      description: "Verified source description.",
      media: {
        url,
        imageType: "representative",
        relevanceScore: 99,
        approvalStatus: "pending",
        requiresReview: false,
        license: "Licensed"
      }
    }, "latest", "test-feed");
    assert.equal(article.imageUrl, null, title);
    assert.equal(article.featuredMedia, null, title);
  }
});

test("a license string and high score cannot replace explicit rights and human relevance approval", () => {
  for (const [title, url] of articleClasses) {
    const common = {
      url,
      imageType: "event_candidate",
      relevanceScore: 99,
      approvalStatus: "approved",
      requiresReview: false,
      license: "Licensed editorial use"
    };
    const withoutRights = ingestion.canonicalArticle({
      id: `${title}-rights`, title, pubDate: "2026-11-03T08:00:00.000Z", description: "Verified source description.",
      media: { ...common, rightsConfirmed: false, relevanceEvidence: { statement: "High score", humanConfirmed: true } }
    }, "latest", "test-feed");
    const withoutHumanReview = ingestion.canonicalArticle({
      id: `${title}-evidence`, title, pubDate: "2026-11-03T08:00:00.000Z", description: "Verified source description.",
      media: { ...common, rightsConfirmed: true, relevanceEvidence: { statement: "Automated match", humanConfirmed: false } }
    }, "latest", "test-feed");
    assert.equal(withoutRights.imageUrl, null, `${title}: rights`);
    assert.equal(withoutHumanReview.imageUrl, null, `${title}: evidence`);
  }
});

test("only explicitly approved article media survives API serialization", () => {
  const approved = {
    url: "https://images.example/verified-event.jpg",
    imageType: "event_photo",
    approvalStatus: "approved",
    requiresReview: false,
    rightsConfirmed: true,
    relevanceEvidence: { statement: "Reporter photographed the named event", humanConfirmed: true },
    license: "NewsNeta owned"
  };
  assert.equal(news.editoriallyApprovedMedia(approved), true);
  assert.equal(news.editoriallyApprovedMedia({ ...approved, rightsConfirmed: false }), false);
  assert.equal(news.editoriallyApprovedMedia({ ...approved, relevanceEvidence: { statement: "AI score", humanConfirmed: false } }), false);
});

test("public refresh payload strips pending media fields server-side", () => {
  const item = news.publicMediaItem({
    id: "pending-media",
    image: "https://images.example/unverified.jpg",
    imageUrl: "https://images.example/unverified.jpg",
    media: { url: "https://images.example/unverified.jpg", imageType: "event_candidate", approvalStatus: "pending", requiresReview: true, license: "Verify rights" }
  });
  assert.equal(item.image, null);
  assert.equal(item.imageUrl, null);
  assert.equal(item.media, null);
  assert.equal(item.imageStatus, "unavailable");
});

test("paragraph-form source descriptions remain separate from card summaries", () => {
  const article = ingestion.canonicalArticle({
    id: "description-preservation",
    title: "తెలంగాణలో పరీక్ష వార్త",
    pubDate: "2026-11-03T08:00:00.000Z",
    summary: "కార్డు సంక్షిప్తం.",
    description: "మొదటి పేరా పూర్తి సమాచారం.\n\nరెండో పేరా అదనపు ధృవీకరించిన సమాచారం."
  }, "telangana", "test-feed");
  assert.equal(article.summary, "కార్డు సంక్షిప్తం.");
  assert.match(article.sourceDescription, /\n\n/);
  const rendered = news.persistedArticleFromRow({
    ...article,
    id: "description-preservation",
    author_id: "feed:test",
    source_description: article.sourceDescription,
    content_status: "brief",
    published_at: article.publishedAt
  });
  assert.equal(rendered.description, article.sourceDescription);
  assert.equal(rendered.sourceDescription, article.sourceDescription);
});

test("browser detail uses source description paragraphs and requires explicit media approval", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(source, /story\.sourceDescription \|\| story\.description/);
  assert.match(source, /availableDescription \? articleBodyMarkup\(availableDescription\)/);
  assert.match(source, /decisionApproval === "approved"/);
  assert.match(source, /decisionEvidence\.humanConfirmed === true/);
  assert.doesNotMatch(source, /Boolean\(decision\?\.license/);
  assert.doesNotMatch(source, /\["cms_approved","event_candidate","event_photo","archive","representative"\]\.includes\(type\)/);
});

test("CMS publication rejects media without explicit rights or relevance evidence", async () => {
  const cms = await import("../netlify/functions/cms.mjs");
  const article = { title: "Test", body: "Complete newsroom report", category: "national" };
  assert.throws(() => cms.validatePublication({}, article, {
    caption: "Caption", alt_text: "Alt", source: "Reporter", copyright_owner: "NewsNeta", license: "Editorial use",
    rights_confirmed: false, relevance_evidence: { statement: "Same event", humanConfirmed: true }
  }), /rights must be explicitly confirmed/);
  assert.throws(() => cms.validatePublication({}, article, {
    caption: "Caption", alt_text: "Alt", source: "Reporter", copyright_owner: "NewsNeta", license: "Editorial use",
    rights_confirmed: true, relevance_evidence: {}
  }), /why the selected media belongs/);
});

test("migration quarantines legacy public media without explicit human approval", () => {
  const migration = fs.readFileSync(path.join(__dirname, "..", "netlify", "database", "migrations", "20261104120000_strict_media_approval", "migration.sql"), "utf8");
  assert.match(migration, /rightsConfirmed/);
  assert.match(migration, /humanConfirmed/);
  assert.match(migration, /approvalStatus/);
  assert.match(migration, /image_url = NULL/);
  assert.match(migration, /status = 'rejected'/);
  assert.match(migration, /jsonb_typeof\(featured_media\) = 'object'/);
  assert.match(migration, /jsonb_typeof\(featured_media\) <> 'object'/);
});
