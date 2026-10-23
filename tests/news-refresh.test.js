const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

test("manual newsroom refresh accepts only canonical categories", async () => {
  const refresh = await import(pathToFileURL(path.join(root, "netlify/functions/refresh-news.mjs")));
  assert.deepEqual(
    refresh.normalizeCategories(["Andhra Pradesh", "tg", "unknown", "sports", "sports", "business"]),
    ["ap", "telangana", "sports", "business"]
  );
});

test("manual newsroom refresh is token protected and POST only", async () => {
  const source = require("node:fs").readFileSync(path.join(root, "netlify/functions/refresh-news.mjs"), "utf8");
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /ADMIN_HEALTH_TOKEN/);
  assert.match(source, /cmsUser\?\.role === "admin"/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /runIngestion\(getDatabase, categories\)/);
});
