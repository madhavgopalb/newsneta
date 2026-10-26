const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const netlify = fs.readFileSync(path.join(__dirname, "..", "netlify.toml"), "utf8");

test("canonical Telangana and Andhra Pradesh routes are rewritable entry points", () => {
  assert.match(netlify, /from = "\/telangana"[\s\S]*?to = "\/index\.html"[\s\S]*?status = 200/);
  assert.match(netlify, /from = "\/andhra-pradesh"[\s\S]*?to = "\/index\.html"[\s\S]*?status = 200/);
});

test("regional navigation updates history, category, pagination and scroll target", () => {
  const router = page.slice(page.indexOf("function regionalPath"), page.indexOf("function setupNav"));
  assert.match(router, /"\/telangana"/);
  assert.match(router, /"\/andhra-pradesh"/);
  assert.match(router, /activeNewsCategory = state/);
  assert.match(router, /latestPage = 1/);
  assert.match(router, /history\.pushState/);
  assert.match(router, /loadNews\(state, true\)/);
  assert.match(router, /latestNewsSection/);
});

test("browser back and forward reapply the regional route", () => {
  assert.match(page, /window\.addEventListener\("popstate", \(\)=>applyRegionalRoute/);
});

test("district selection retains canonical state routing and passes a district filter", () => {
  assert.match(page, /navigateToRegionalNews\(state, \{historyMode:"push",district\}\)/);
  assert.match(page, /loadDistrictNews\(state, district, true\)/);
});
