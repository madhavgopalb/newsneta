const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

test("daily edition selection deduplicates article identities and headlines", async () => {
  const core = await import(pathToFileURL(path.join(root, "netlify/lib/edition-core.mjs")));
  const selected = core.deduplicateArticles([
    { id: "one", title: "తెలంగాణలో కొత్త పథకం" },
    { id: "two", title: "తెలంగాణలో కొత్త పథకం!" },
    { id: "one", title: "Different duplicate id" },
    { id: "three", title: "ఆంధ్రప్రదేశ్‌లో వర్షాలు" }
  ]);
  assert.deepEqual(selected.map(item => item.id), ["one", "three"]);
});

test("edition summary reuses stored editorial copy without inventing content", async () => {
  const core = await import(pathToFileURL(path.join(root, "netlify/lib/edition-core.mjs")));
  const summary = core.editionSummary({ summary: "one two three four five", body: "body must not replace summary" }, 20);
  assert.equal(summary, "one two three four five");
});

test("A3 PDF generation embeds the edition font and creates reusable output", async () => {
  const core = await import(pathToFileURL(path.join(root, "netlify/lib/edition-core.mjs")));
  const items = Array.from({ length: 20 }, (_, index) => ({
    article_slug: `story-${index + 1}`,
    section: index % 2 ? "తెలంగాణ" : "ఆంధ్రప్రదేశ్",
    headline: `రోజువారీ ముఖ్య వార్త ${index + 1}`,
    summary: "ప్రచురిత కథనంలో ఉన్న ధృవీకరించిన వివరాలతో న్యూస్ నేత డైలీ కోసం సిద్ధం చేసిన సంక్షిప్త సమాచారం.",
    image_url: null
  }));
  const pdf = await core.renderEditionPdf({ edition_date: "2026-11-26", edition_scope: "combined", language: "te", page_count: 4 }, items);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.byteLength > 25000);
  const output = path.join(os.tmpdir(), "newsneta-daily-test.pdf");
  fs.writeFileSync(output, pdf);
  assert.equal(fs.statSync(output).size, pdf.byteLength);
});

test("edition endpoint requires Admin for mutations and stores generated PDFs", () => {
  const source = fs.readFileSync(path.join(root, "netlify/functions/editions.mjs"), "utf8");
  assert.match(source, /user\?\.role !== "admin"/);
  assert.match(source, /getStore\(\{ name: "newsneta-editions"/);
  assert.match(source, /status='published'/);
  assert.match(source, /pdf_storage_key/);
});

test("daily draft schedule runs at 6 AM IST and remains review-only", () => {
  const config = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
  const scheduled = fs.readFileSync(path.join(root, "netlify/functions/generate-edition.mjs"), "utf8");
  assert.match(config, /\[functions\."generate-edition"\][\s\S]*schedule = "30 0 \* \* \*"/);
  assert.doesNotMatch(scheduled, /status='published'|action.*publish/i);
});

test("published edition reader exposes edition-specific social metadata", () => {
  const reader = fs.readFileSync(path.join(root, "netlify/functions/edition-reader.mjs"), "utf8");
  const config = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
  assert.match(reader, /og:title/);
  assert.match(reader, /og:url/);
  assert.match(reader, /og:image/);
  assert.match(reader, /daily_editions WHERE id=\$1 AND status='published'/);
  assert.match(config, /from = "\/epaper\/\*"[\s\S]*edition-reader\?id=:splat/);
});

test("delivery recipients are validated, masked and encrypted", async () => {
  const delivery = await import(pathToFileURL(path.join(root, "netlify/lib/edition-distribution.mjs")));
  const secret = "test-edition-delivery-secret-32-bytes";
  const email = delivery.validateRecipient("email", "Reader@Example.com");
  const encrypted = delivery.encryptRecipient(email, secret);
  assert.equal(delivery.decryptRecipient(encrypted, secret), "reader@example.com");
  assert.equal(delivery.maskRecipient("email", email), "re***@example.com");
  assert.equal(delivery.validateRecipient("whatsapp", "+919876543210"), "+919876543210");
  assert.throws(() => delivery.validateRecipient("whatsapp", "9876543210"), /E\.164/);
});

test("official email and WhatsApp providers receive edition-specific links", async () => {
  const delivery = await import(pathToFileURL(path.join(root, "netlify/lib/edition-distribution.mjs")));
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url, options, body: JSON.parse(options.body) }); return { ok: true, json: async () => url.includes("resend") ? { id: "email-1" } : { messages: [{ id: "wa-1" }] } }; };
  const edition = { id: "10000000-0000-4000-8000-000000000001", edition_date: "2026-11-27" };
  const emailId = await delivery.sendEditionEmail({ recipient: "reader@example.com", edition, origin: "https://newsneta.com", idempotencyKey: "delivery-1", fetchImpl, env: { RESEND_API_KEY: "test", NEWSNETA_EMAIL_FROM: "NewsNeta <daily@newsneta.com>" } });
  const waId = await delivery.sendEditionWhatsApp({ recipient: "+919876543210", edition, origin: "https://newsneta.com", fetchImpl, env: { WHATSAPP_ACCESS_TOKEN: "test", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_TEMPLATE_NAME: "newsneta_daily", WHATSAPP_GRAPH_VERSION: "v27.0" } });
  assert.equal(emailId, "email-1");
  assert.equal(waId, "wa-1");
  assert.match(requests[0].body.html, /\/epaper\/10000000-0000-4000-8000-000000000001/);
  assert.equal(requests[1].body.to, "919876543210");
  assert.equal(requests[1].body.type, "template");
});

test("delivery queue requires Admin consent and has a bounded retry schedule", () => {
  const endpoint = fs.readFileSync(path.join(root, "netlify/functions/edition-distribute.mjs"), "utf8");
  const worker = fs.readFileSync(path.join(root, "netlify/functions/send-editions.mjs"), "utf8");
  const config = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
  assert.match(endpoint, /user\?\.role !== "admin"/);
  assert.match(endpoint, /consentConfirmed/);
  assert.match(worker, /attempts<4/);
  assert.match(worker, /FOR UPDATE SKIP LOCKED/);
  assert.match(config, /\[functions\."send-editions"\][\s\S]*schedule = "\*\/5 \* \* \* \*"/);
});
