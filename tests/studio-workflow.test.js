const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("NewsNeta Studio uses one compact secure login before role navigation", () => {
  const modal = page.slice(page.indexOf('id="loginBackdrop"'), page.indexOf('id="storyBackdrop"'));
  assert.match(modal, /id="loginEmail"[\s\S]*?required/);
  assert.match(modal, /id="loginPassword"[\s\S]*?required/);
  assert.match(modal, /id="loginPasswordToggle"/);
  assert.match(modal, /Forgot password\?/);
  assert.match(modal, /id="loginSubmit"/);
  assert.equal((modal.match(/class="cms-tabs/g) || []).length, 0);
});

test("Studio restores validated sessions and exposes role-specific navigation", () => {
  assert.match(page, /async function restoreCmsSession/);
  assert.match(page, /await reloadCmsArticles/);
  const navigation = page.slice(page.indexOf("function cmsNavigationForRole"), page.indexOf("function cmsMobileNavigation"));
  for (const label of ["Create News", "Published", "Pending", "Drafts", "Media", "Users", "My Articles", "Submitted", "Feedback", "Reviewed"]) {
    assert.match(navigation, new RegExp(label));
  }
  assert.match(page, /class="cms-mobile-nav"/);
  assert.match(page, /safe-area-inset-bottom/);
});

test("reporter and admin share one simplified article editor", () => {
  const editor = page.slice(page.indexOf("function simplifiedArticleEditor"), page.indexOf("function cmsWorkflowForm"));
  for (const field of ["cmsHeadline", "cmsBody", "cmsCategory", "cmsState", "cmsDistrict", "cmsMediaUpload"]) assert.match(editor, new RegExp(field));
  assert.match(editor, /Save Draft/);
  assert.match(editor, /Preview/);
  assert.match(editor, /Submit for Review/);
  assert.match(editor, /Publish Now/);
  assert.match(editor, /multiple/);
  assert.match(editor, /Edit Published News/);
  assert.match(editor, /"Edit Published News" : "Create News"/);
  assert.match(editor, /Save & Update Published Article/);
  assert.match(editor, /cmsThumbnailUpload/);
  assert.match(editor, /cmsRightsConfirmed/);
  assert.match(editor, /cmsMediaRightsBasis/);
  assert.match(editor, /cmsEditNote/);
  assert.doesNotMatch(editor, />Thumbnail URL<|>Social Image URL<|Article Relevance|Why this media belongs|SEO Title|Relevance Score|Reporter Location/);
  assert.match(editor, /Advanced Media Settings/);
});

test("Studio uses a non-overlapping desktop grid and a drawer below 1024px", () => {
  assert.doesNotMatch(page, /\.login-modal header\{/);
  assert.match(page, /\.login-modal>header\{/);
  assert.match(page, /#roleDashboardContent\{width:100%;height:100%;min-width:0;min-height:0;overflow:hidden\}/);
  assert.match(page, /\.cms-shell\{display:grid;grid-template-columns:240px minmax\(0,1fr\);grid-template-rows:minmax\(0,1fr\)[\s\S]*?height:100%;min-width:0;min-height:0;overflow:hidden/);
  assert.match(page, /\.cms-sidebar\{grid-column:1;grid-row:1;position:sticky;top:0;width:240px;height:100%;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden/);
  assert.match(page, /\.cms-workspace\{grid-column:2;grid-row:1;min-width:0;min-height:0;width:100%;height:100%[\s\S]*?overflow-y:auto;overflow-x:hidden/);
  const desktop = page.slice(page.indexOf("@media (min-width:1024px)"), page.indexOf("@media (max-width:1023px)"));
  assert.match(desktop, /\.login-modal\.authenticated \.cms-sidebar\{grid-column:1;grid-row:1\}/);
  assert.match(desktop, /\.login-modal\.authenticated \.cms-workspace\{grid-column:2;grid-row:1\}/);
  assert.match(desktop, /\.login-modal\.authenticated \.cms-mobile-header[\s\S]*?\{display:none\}/);
  const responsive = page.slice(page.indexOf("@media (max-width:1023px)"), page.indexOf("@media (max-width:980px)"));
  assert.match(responsive, /\.cms-sidebar\{display:block;position:fixed/);
  assert.match(responsive, /transform:translateX\(-105%\)/);
  assert.match(responsive, /\.cms-shell\.cms-nav-open \.cms-sidebar\{transform:translateX\(0\)\}/);
  assert.match(page, /closeCmsNavigation\(\); if\(backdrop\?\.classList\.contains\("open"\)\)/);
  assert.match(page, /document\.body\.classList\.remove\("lock"\)/);
});

test("Create News owns vertical scrolling and grows the article editor", () => {
  assert.match(page, /function resizeCmsArticleBody\(\)/);
  assert.match(page, /editor\.style\.height = "auto"/);
  assert.match(page, /Math\.max\(260,editor\.scrollHeight\)/);
  assert.match(page, /getElementById\("cmsBody"\)\?\.addEventListener\("input",resizeCmsArticleBody\)/);
  assert.match(page, /\.cms-form textarea\.article-body\{min-height:260px;overflow-y:hidden;touch-action:pan-y\}/);
  assert.match(page, /shell\?\.classList\.toggle\("editor-active",screen === "create"\)/);
  assert.match(page, /\.cms-shell\.editor-active \.dashboard-head\{display:none\}/);
});

test("admin manage queue exposes live edit, view, unpublish and delete controls", () => {
  const manage = page.slice(page.indexOf("function cmsManageScreen"), page.indexOf("function cmsAnalyticsScreen"));
  assert.match(manage, /data-edit-article/);
  assert.match(manage, /data-view-article/);
  assert.match(manage, /unpublish/);
  assert.match(manage, /data-delete-article/);
  const binding = page.slice(page.indexOf("function bindCmsScreen(role)"), page.indexOf("function switchCmsScreen"));
  assert.match(binding, /updatePublishedCmsArticle/);
  assert.match(binding, /Confirm Live Update/);
  assert.match(page, /\.cms-form-actions\{[^}]*safe-area-inset-bottom/);
});

test("dashboard omits shortcut cards and workflow diagram", () => {
  const dashboard = page.slice(page.indexOf("function openRoleDashboard"), page.indexOf('document.getElementById("loginForm")'));
  assert.doesNotMatch(dashboard, /dashboard-actions/);
  assert.doesNotMatch(dashboard, /cmsWorkflowLane/);
});

test("feed import uses the signed CMS session and bounded categories", () => {
  const binding = page.slice(page.indexOf("function bindCmsScreen(role)"), page.indexOf("function switchCmsScreen"));
  assert.match(binding, /\.netlify\/functions\/refresh-news/);
  assert.match(binding, /cmsHeaders\(\)/);
  assert.match(binding, /slice\(0,4\)/);
});

test("media library retains article association and rights metadata", () => {
  const library = page.slice(page.indexOf("function cmsMediaLibraryScreen"), page.indexOf("function cmsScreenMarkup"));
  assert.match(library, /article\.headline/);
  assert.match(library, /item\.license/);
  assert.match(library, /item\.source/);
});

test("health endpoint accepts only an admin CMS session or health token", () => {
  const source = fs.readFileSync(path.join(root, "netlify", "functions", "news-health.mjs"), "utf8");
  assert.match(source, /verifySession/);
  assert.match(source, /cmsUser\?\.role === "admin"/);
  assert.match(source, /return json\(401/);
});
