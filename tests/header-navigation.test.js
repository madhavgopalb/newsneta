const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
const netlify = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");

test("global header exposes functional navigation actions without social links", () => {
  const header = page.match(/<header class="header"[\s\S]*?<\/header>/)?.[0] || "";
  assert.match(header, /id="menuToggle"/);
  assert.match(header, /id="adminLoginBtn"/);
  assert.match(header, /id="headerSearchBtn"/);
  assert.match(header, /id="notificationBtn"/);
  assert.doesNotMatch(header, /main-socials|facebook|instagram|whatsapp/);
});

test("drawer and ribbon are rendered from the shared category and district masters", () => {
  assert.match(page, /function drawerNavMarkup\(\)/);
  assert.match(page, /categories\.filter\(\(\[id\]\)=>id !== "district"\)/);
  assert.match(page, /districts\[id\]\.map/);
  assert.match(page, /function setupNav\(\)/);
});

test("district master and canonical regional paths include current supported districts", () => {
  const master = page.match(/const districts = \{([\s\S]*?)\n\};/)?.[1] || "";
  const tg = master.match(/telangana:\s*\[([\s\S]*?)\]\s*,\s*ap:/)?.[1] || "";
  const ap = master.match(/ap:\s*\[([\s\S]*?)\]\s*$/)?.[1] || "";
  assert.equal((tg.match(/"[^"]+"/g) || []).length, 33);
  assert.equal((ap.match(/"[^"]+"/g) || []).length, 28);
  assert.match(ap, /"Markapuram"/);
  assert.match(ap, /"Polavaram"/);
  assert.match(page, /return district \? `\$\{base\}\/\$\{districtSlug\(district\)\}` : base/);
  assert.match(netlify, /from = "\/telangana\/\*"/);
  assert.match(netlify, /from = "\/andhra-pradesh\/\*"/);
});

test("article sharing uses the direct story URL and follow profiles are not fabricated", () => {
  assert.match(page, /url\.hash = `story-\$\{encodeURIComponent/);
  assert.match(page, /id="storyFollowBtn"/);
  assert.match(page, /once they are configured and verified/);
});
