const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const auth = require("../netlify/lib/cms-auth");

const env = {
  CMS_REPORTER_EMAIL: "reporter@example.test",
  CMS_REPORTER_PASSWORD: "reporter-secret"
};

test("CMS credentials are verified by role without exposing passwords to the browser", () => {
  assert.deepEqual(auth.authenticateCredentials("reporter@example.test", "reporter-secret", "reporter", env), {
    id: "reporter@example.test", email: "reporter@example.test", role: "reporter"
  });
  assert.equal(auth.authenticateCredentials("reporter@example.test", "wrong", "reporter", env), null);
  assert.equal(auth.authenticateCredentials("reporter@example.test", "reporter-secret", "admin", env), null);
});

test("CMS sessions are signed, expire, and reject tampering", () => {
  const now = Date.UTC(2026, 9, 14, 6);
  const token = auth.signSession({ id: "reporter@example.test", role: "reporter" }, "test-session-secret-at-least-32-chars", now);
  assert.equal(auth.verifySession(token, "test-session-secret-at-least-32-chars", now + 1000).role, "reporter");
  assert.equal(auth.verifySession(`${token}x`, "test-session-secret-at-least-32-chars", now + 1000), null);
  assert.equal(auth.verifySession(token, "test-session-secret-at-least-32-chars", now + 9 * 60 * 60 * 1000), null);
});

test("editorial role transitions enforce reporter review and admin publication", () => {
  assert.equal(auth.transitionAllowed("reporter", "draft", "submitted"), true);
  assert.equal(auth.transitionAllowed("reporter", "draft", "published"), false);
  assert.equal(auth.transitionAllowed("reviewer", "submitted", "reviewer_approved"), true);
  assert.equal(auth.transitionAllowed("admin", "reviewer_approved", "published"), true);
  assert.equal(auth.transitionAllowed("reviewer", "submitted", "published"), false);
});

test("service worker never stores authenticated CMS responses", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  const cmsBranch = source.slice(source.indexOf('request.url.includes("/.netlify/functions/cms")'), source.indexOf('request.url.includes("/.netlify/functions/news")'));
  assert.match(cmsBranch, /fetch\(request, \{ cache: "no-store" \}\)/);
  assert.doesNotMatch(cmsBranch, /cache\.put/);
});

test("public news API exposes canonical content revision and CMS media", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "lib", "news-core.js"), "utf8");
  assert.match(source, /content_revision FROM articles/);
  assert.match(source, /featured_media\?\.url \|\| row\.image_url/);
});

test("public media requires approved media on a published CMS article", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "netlify", "functions", "media.mjs"), "utf8");
  assert.match(source, /m\.status='approved'/);
  assert.match(source, /a\.status='published'/);
  assert.match(source, /a\.source_provider='newsneta-cms'/);
});

test("browser sends immutable server article IDs back to CMS", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(source, /id:\/\^\[0-9a-f\]\{8\}/);
});
