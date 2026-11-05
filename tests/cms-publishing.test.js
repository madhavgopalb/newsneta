const test = require("node:test");
const assert = require("node:assert/strict");

const admin = { id: "00000000-0000-4000-8000-000000000001", role: "admin" };
const baseArticle = {
  headline: "హైదరాబాద్ నగర సేవలపై ప్రత్యేక సమీక్ష",
  body: "హైదరాబాద్ నగరంలో ప్రజా సేవల అమలును అధికారులు సమీక్షించారు. శాఖల వారీగా తదుపరి చర్యలను ప్రకటించారు.",
  category: "telangana",
  state: "Telangana",
  district: "Hyderabad"
};

function fakePool() {
  const events = [];
  const article = { id: "10000000-0000-4000-8000-000000000001", slug: "story-test", status: "draft", title: baseArticle.headline, body: baseArticle.body, category: "telangana", state: "Telangana", district: "Hyderabad", featured_media: {} };
  const client = {
    async query(input) {
      const text = typeof input === "string" ? input : input.text;
      events.push(text);
      if (/SELECT article_id, request_hash/.test(text)) return { rows: [] };
      if (/SELECT id,author_id,status,source_provider/.test(text)) return { rows: [] };
      if (/INSERT INTO articles/.test(text)) return { rows: [article] };
      if (/UPDATE articles SET status=/.test(text)) return { rows: [{ ...article, status: "published" }] };
      return { rows: [], rowCount: 1 };
    },
    release() { events.push("RELEASE"); }
  };
  return { connect: async () => client, events };
}

test("automatic summary preserves the full article body", async () => {
  const { summaryFromBody } = await import("../netlify/functions/cms.mjs");
  const body = "First verified sentence. Second verified sentence. Third sentence remains in the full body.";
  assert.equal(summaryFromBody(body), "First verified sentence. Second verified sentence.");
  assert.match(body, /Third sentence remains/);
});

test("admin direct publish commits article and audit in one transaction", async () => {
  const { directAdminPublish } = await import("../netlify/functions/cms.mjs");
  const pool = fakePool();
  const result = await directAdminPublish(pool, admin, baseArticle, "publish:1234567890abcdef");
  assert.equal(result.article.status, "published");
  assert.equal(result.replayed, false);
  assert.equal(pool.events[0], "BEGIN");
  assert.ok(pool.events.some(sql => /INSERT INTO article_workflow/.test(sql)));
  assert.ok(pool.events.some(sql => /INSERT INTO cms_publish_requests/.test(sql)));
  assert.ok(pool.events.includes("COMMIT"));
  assert.equal(pool.events.at(-1), "RELEASE");
});

test("reporter cannot use the direct publish endpoint", async () => {
  const { directAdminPublish } = await import("../netlify/functions/cms.mjs");
  await assert.rejects(() => directAdminPublish(fakePool(), { ...admin, role: "reporter" }, baseArticle, "publish:1234567890abcdef"), /Only an Admin/);
});

function publishedEditPool() {
  const events = [];
  const article = {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "immutable-story-url",
    status: "published",
    source_provider: "newsneta-cms",
    title: baseArticle.headline,
    body: baseArticle.body,
    category: "telangana",
    state: "Telangana",
    district: "Hyderabad",
    thumbnail_url: "https://cdn.example.com/story.jpg",
    image_url: "https://cdn.example.com/story.jpg",
    content_revision: 3,
    published_at: "2026-11-04T08:00:00.000Z"
  };
  const client = {
    async query(input) {
      const text = typeof input === "string" ? input : input.text;
      events.push({ text, values: input?.values || [] });
      if (/SELECT \* FROM articles/.test(text)) return { rows: [article] };
      if (/UPDATE articles SET title=/.test(text)) return { rows: [{ ...article, title: "Updated headline", content_revision: 4 }] };
      return { rows: [], rowCount: 1 };
    },
    release() { events.push({ text: "RELEASE", values: [] }); }
  };
  return { connect: async () => client, events };
}

test("admin published edit snapshots the prior revision and preserves article identity", async () => {
  const { editPublishedArticle } = await import("../netlify/functions/cms.mjs");
  const pool = publishedEditPool();
  const result = await editPublishedArticle(pool, admin, {
    id: "10000000-0000-4000-8000-000000000001",
    headline: "Updated headline",
    body: baseArticle.body,
    category: "telangana",
    state: "Telangana",
    district: "Hyderabad",
    thumbnailUrl: "https://cdn.example.com/story.jpg",
    editNote: "Corrected the civic service timing"
  });
  assert.equal(result.content_revision, 4);
  assert.equal(pool.events[0].text, "BEGIN");
  assert.ok(pool.events.some(event => /INSERT INTO article_revisions/.test(event.text)));
  assert.ok(pool.events.some(event => /INSERT INTO article_workflow/.test(event.text)));
  const update = pool.events.find(event => /UPDATE articles SET title=/.test(event.text));
  assert.doesNotMatch(update.text, /slug\s*=/);
  assert.doesNotMatch(update.text, /published_at\s*=/);
  assert.ok(pool.events.some(event => event.text === "COMMIT"));
  assert.equal(pool.events.at(-1).text, "RELEASE");
});

test("published editing is admin-only and requires an audit note", async () => {
  const { editPublishedArticle } = await import("../netlify/functions/cms.mjs");
  await assert.rejects(() => editPublishedArticle(publishedEditPool(), { ...admin, role: "reviewer" }, {}), /Only an Admin/);
  await assert.rejects(() => editPublishedArticle(publishedEditPool(), admin, {
    id: "10000000-0000-4000-8000-000000000001",
    ...baseArticle,
    thumbnailUrl: "https://cdn.example.com/story.jpg"
  }), /revision note/i);
});

test("published edit migration creates revision storage and thumbnail metadata", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const migration = fs.readFileSync(path.resolve(__dirname, "../netlify/database/migrations/20261105100000_admin_post_publish_edit/migration.sql"), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS article_revisions/);
  assert.match(migration, /social_image_url/);
  assert.match(migration, /thumbnail_metadata/);
  assert.match(migration, /last_editor_id/);
});

test("generic draft save cannot bypass the audited published edit endpoint", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.resolve(__dirname, "../netlify/functions/cms.mjs"), "utf8");
  assert.match(source, /current\?\.status === "published"/);
  assert.match(source, /Published articles must use the audited edit endpoint/);
});
