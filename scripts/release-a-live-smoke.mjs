import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = String(process.env.BASE_URL || "").replace(/\/$/, "");
const password = process.env.CMS_TEST_PASSWORD;
const videoPath = process.env.TEST_VIDEO_PATH;

if (!baseUrl || !password || !videoPath) {
  throw new Error("BASE_URL, CMS_TEST_PASSWORD and TEST_VIDEO_PATH are required");
}

const cmsUrl = action => `${baseUrl}/.netlify/functions/cms?action=${action}`;
const unique = `release-a-${Date.now()}`;

async function request(url, options = {}, expected = 200) {
  const response = await fetch(url, options);
  if (response.status !== expected) {
    throw new Error(`${options.method || "GET"} ${url} returned ${response.status}: ${await response.text()}`);
  }
  return response;
}

async function login(role) {
  const response = await request(cmsUrl("login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${role}@newsneta.in`, password, role })
  });
  return (await response.json()).token;
}

const auth = token => ({ Authorization: `Bearer ${token}` });
const postJson = (action, token, body) => request(cmsUrl(action), {
  method: "POST",
  headers: { ...auth(token), "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

async function publicItems(client) {
  const response = await request(`${baseUrl}/.netlify/functions/news?category=latest&limit=100&force=${client}-${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" }
  });
  const payload = await response.json();
  return payload.items || payload.articles || [];
}

let article;
let media;

try {
  const [reporter, reviewer, admin] = await Promise.all([login("reporter"), login("reviewer"), login("admin")]);
  const bytes = await fs.readFile(videoPath);
  const form = new FormData();
  form.set("file", new File([bytes], path.basename(videoPath), { type: "video/mp4" }));
  form.set("caption", "Release A protected video playback validation");
  form.set("altText", "NewsNeta release validation video");
  form.set("source", "NewsNeta newsroom test fixture");
  form.set("copyrightOwner", "NewsNeta");
  form.set("license", "NewsNeta owned media");
  media = (await (await request(cmsUrl("upload"), {
    method: "POST",
    headers: auth(reporter),
    body: form
  }, 201)).json()).media;

  await request(media.public_url, {}, 404);

  article = (await (await postJson("save", reporter, {
    headline: `Release A video validation ${unique}`,
    englishTitle: `Release A video validation ${unique}`,
    summary: "A controlled newsroom validation story for protected video playback.",
    body: "This temporary article verifies reporter upload, reviewer approval, admin publication, public synchronization, byte-range playback and unpublish revocation.",
    category: "technology",
    state: "Telangana",
    district: "Hyderabad",
    tags: ["release-validation", unique],
    featuredMediaId: media.id
  })).json()).article;

  await postJson("transition", reporter, { id: article.id, to: "submitted", action: "Submit release validation" });
  await postJson("transition", reviewer, { id: article.id, to: "under_review", action: "Begin release review" });
  await postJson("transition", reviewer, { id: article.id, to: "reviewer_approved", action: "Approve release validation" });
  await postJson("transition", admin, { id: article.id, to: "published", action: "Publish release validation" });

  const [clientA, clientB] = await Promise.all([publicItems("client-a"), publicItems("client-b")]);
  if (!clientA.some(item => item.id === article.id) || !clientB.some(item => item.id === article.id)) {
    throw new Error("Published article was not visible to both independent API clients");
  }

  await request(media.public_url, { method: "HEAD" });
  const range = await request(media.public_url, { headers: { Range: "bytes=0-1023" } }, 206);
  if (!String(range.headers.get("content-range") || "").startsWith("bytes 0-1023/")) {
    throw new Error("Protected media returned an invalid Content-Range header");
  }
  if ((await range.arrayBuffer()).byteLength !== 1024) throw new Error("Protected media returned an invalid range length");

  await postJson("transition", admin, { id: article.id, to: "unpublished", action: "Complete release validation" });
  const afterUnpublish = await publicItems("after-unpublish");
  if (afterUnpublish.some(item => item.id === article.id)) throw new Error("Unpublished article remained in the public feed");
  await request(media.public_url, {}, 404);

  console.log(JSON.stringify({
    status: "passed",
    articleId: article.id,
    mediaId: media.id,
    clientsVerified: 2,
    rangeStatus: 206,
    unpublishRevoked: true
  }));
} catch (error) {
  console.error(JSON.stringify({ status: "failed", articleId: article?.id, mediaId: media?.id, error: error.message }));
  process.exitCode = 1;
}
