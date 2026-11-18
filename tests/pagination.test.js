const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("news listings expose previous, next and numbered navigation", () => {
  const renderer = page.slice(page.indexOf("function renderPagedFeed"), page.indexOf("function renderSideNewsPanel"));
  assert.match(renderer, /data-page-action="\$\{pageKey\}:prev"/);
  assert.match(renderer, /data-page-action="\$\{pageKey\}:next"/);
  assert.match(renderer, /\$\{pageKey\}:page:\$\{number\}/);
  assert.match(renderer, /aria-current="page"/);
});

test("archive pagination uses stable database ordering and reports totals", async () => {
  const { _test } = require("../netlify/lib/news-core.js");
  const calls = [];
  const row = {
    id: "10000000-0000-4000-8000-000000000001", title: "Archived story", summary: "Summary", body: "Body",
    category: "telangana", status: "published", published_at: "2026-11-01T00:00:00.000Z", content_status: "newsroom_full_text"
  };
  const pool = { query: async query => {
    calls.push(query);
    if (/count\(\*\)/i.test(query.text)) return { rows: [{ total: 19 }] };
    return { rows: [row] };
  } };
  const result = await _test.persistedArchivePage("telangana", "Hyderabad", 2, 9, () => ({ pool }));
  assert.equal(result.page, 2);
  assert.equal(result.total, 19);
  assert.equal(result.totalPages, 3);
  assert.equal(result.items[0].title, "Archived story");
  assert.match(calls[1].text, /ORDER BY published_at DESC NULLS LAST, id DESC LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(calls[1].values, ["telangana", "Hyderabad", 9, 9]);
});
