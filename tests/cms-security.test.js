const test = require("node:test");
const assert = require("node:assert/strict");

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";

function fakePool(handler) {
  const calls = [];
  const client = {
    async query(input) {
      const text = typeof input === "string" ? input : input.text;
      const values = typeof input === "string" ? [] : input.values;
      calls.push({ text, values });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text)) return { rows: [] };
      return handler(text, values, calls);
    },
    release() { calls.push({ text: "RELEASE", values: [] }); }
  };
  return { calls, connect: async () => client };
}

const reporter = { id: "reporter@example.test", role: "reporter" };
const base = {
  id: ARTICLE_ID, contentRevision: 3, headline: "తెలుగు వార్త", body: "సంపూర్ణ వార్తా కథనం",
  category: "telangana", slug: "telugu-story", tags: []
};
const row = {
  id: ARTICLE_ID, content_revision: 3, source_provider: "newsneta-cms",
  author_id: reporter.id, status: "draft", featured_media: null
};

test("transaction commits successful work and always releases the client", async () => {
  const { inTransaction } = await import("../netlify/functions/cms.mjs");
  const pool = fakePool(async () => ({ rows: [] }));
  assert.equal(await inTransaction(pool, async client => { await client.query("WORK"); return 42; }), 42);
  assert.deepEqual(pool.calls.map(call => call.text), ["BEGIN", "WORK", "COMMIT", "RELEASE"]);
});

test("transaction rolls back injected workflow failures", async () => {
  const { inTransaction } = await import("../netlify/functions/cms.mjs");
  const pool = fakePool(async text => {
    if (text === "WORKFLOW_FAIL") throw new Error("injected");
    return { rows: [] };
  });
  await assert.rejects(inTransaction(pool, client => client.query("WORKFLOW_FAIL")), /injected/);
  assert.deepEqual(pool.calls.map(call => call.text), ["BEGIN", "WORKFLOW_FAIL", "ROLLBACK", "RELEASE"]);
});

test("reporter updates a CMS article by UUID and expected revision", async () => {
  const { saveArticle } = await import("../netlify/functions/cms.mjs");
  const pool = fakePool(async text => {
    if (text.includes("SELECT * FROM articles WHERE id=")) return { rows: [row] };
    if (text.includes("SELECT id FROM articles WHERE slug=")) return { rows: [] };
    if (text.includes("UPDATE articles SET")) return { rows: [{ ...row, content_revision: 4 }] };
    throw new Error("Unexpected query: " + text);
  });
  const saved = await saveArticle(pool, reporter, base);
  assert.equal(saved.id, ARTICLE_ID);
  assert.equal(saved.content_revision, 4);
  assert.ok(pool.calls.some(call => call.text.includes("WHERE id=$15") && call.text.includes("content_revision=$16")));
});

test("rejects invalid UUID, another reporter, provider content, stale revision, and slug collision", async t => {
  const { saveArticle } = await import("../netlify/functions/cms.mjs");
  await t.test("invalid UUID", async () => {
    await assert.rejects(saveArticle(fakePool(async()=>({rows:[]})), reporter, { ...base, id: "bad" }), error => error.status === 400);
  });
  await t.test("another reporter", async () => {
    const pool = fakePool(async text => text.includes("SELECT * FROM articles") ? { rows: [{ ...row, author_id: "other@example.test" }] } : { rows: [] });
    await assert.rejects(saveArticle(pool, reporter, base), error => error.status === 403);
    assert.ok(pool.calls.some(call => call.text === "ROLLBACK"));
  });
  await t.test("provider article", async () => {
    const pool = fakePool(async text => text.includes("SELECT * FROM articles") ? { rows: [{ ...row, source_provider: "gnews" }] } : { rows: [] });
    await assert.rejects(saveArticle(pool, reporter, base), error => error.status === 403);
  });
  await t.test("stale revision", async () => {
    const pool = fakePool(async text => text.includes("SELECT * FROM articles") ? { rows: [row] } : { rows: [] });
    await assert.rejects(saveArticle(pool, reporter, { ...base, contentRevision: 2 }), error => error.status === 409);
  });
  await t.test("slug collision", async () => {
    const pool = fakePool(async text => {
      if (text.includes("SELECT * FROM articles")) return { rows: [row] };
      if (text.includes("SELECT id FROM articles WHERE slug=")) return { rows: [{ id: "22222222-2222-4222-8222-222222222222" }] };
      return { rows: [] };
    });
    await assert.rejects(saveArticle(pool, reporter, base), error => error.status === 409);
    assert.equal(pool.calls.some(call => call.text.includes("UPDATE articles SET")), false);
  });
});

test("CMS implementation never performs slug-based conflict updates", async () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(require("node:path").join(__dirname, "..", "netlify", "functions", "cms.mjs"), "utf8");
  assert.doesNotMatch(source, /ON CONFLICT\s*\(slug\)\s*DO UPDATE/i);
  assert.match(source, /SELECT \* FROM articles WHERE id=\$1 FOR UPDATE/);
  assert.match(source, /content_revision=\$16/);
});

test("editorial transition is atomic and rolls back when audit insertion fails", async () => {
  const { transitionArticle } = await import("../netlify/functions/cms.mjs");
  const admin = { id: "admin@example.test", role: "admin" };
  const approved = { ...row, status: "reviewer_approved" };
  const pool = fakePool(async text => {
    if (text.includes("SELECT * FROM articles")) return { rows: [approved] };
    if (text.includes("UPDATE articles SET status=")) return { rows: [{ ...approved, status: "published", content_revision: 4 }] };
    if (text.includes("INSERT INTO article_workflow")) throw new Error("audit unavailable");
    return { rows: [] };
  });
  await assert.rejects(transitionArticle(pool, admin, { id: ARTICLE_ID, to: "published" }), /audit unavailable/);
  assert.ok(pool.calls.some(call => call.text === "ROLLBACK"));
  assert.equal(pool.calls.some(call => call.text === "COMMIT"), false);
});

test("service worker evicts cached media when the origin revokes it", () => {
  const fs = require("node:fs");
  const source = fs.readFileSync(require("node:path").join(__dirname, "..", "sw.js"), "utf8");
  assert.match(source, /\[401, 403, 404, 410\]\.includes\(response\.status\)/);
  assert.match(source, /await cache\.delete\(request\)/);
});
