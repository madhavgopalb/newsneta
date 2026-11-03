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
