import crypto from "node:crypto";

const clean = (value, max = 1000) => String(value || "").replace(/\0/g, "").trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

export function validateRecipient(channel, value) {
  const recipient = clean(value, 320);
  if (channel === "email" && emailPattern.test(recipient)) return recipient.toLowerCase();
  if (channel === "whatsapp" && phonePattern.test(recipient)) return recipient;
  throw Object.assign(new Error(channel === "whatsapp" ? "WhatsApp number must use E.164 format, for example +919876543210" : "A valid recipient email is required"), { status: 400 });
}

export function maskRecipient(channel, value) {
  const recipient = String(value || "");
  if (channel === "email") {
    const [name, domain] = recipient.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${recipient.slice(0, 3)}******${recipient.slice(-3)}`;
}

function encryptionKey(secret) {
  if (!secret || String(secret).length < 24) throw Object.assign(new Error("EDITION_DELIVERY_SECRET is not configured"), { status: 503 });
  return crypto.createHash("sha256").update(String(secret)).digest();
}

export function encryptRecipient(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(buffer => buffer.toString("base64url")).join(".");
}

export function decryptRecipient(value, secret) {
  const [iv, tag, encrypted] = String(value || "").split(".").map(part => Buffer.from(part, "base64url"));
  if (!iv?.length || !tag?.length || !encrypted?.length) throw new Error("Recipient data is invalid");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function sendEditionEmail({ recipient, edition, origin, idempotencyKey, fetchImpl = fetch, env = process.env }) {
  if (!env.RESEND_API_KEY || !env.NEWSNETA_EMAIL_FROM) throw Object.assign(new Error("Email delivery is not configured"), { status: 503 });
  const editionUrl = `${origin}/epaper/${edition.id}`;
  const pdfUrl = `${origin}/.netlify/functions/editions?action=pdf&id=${edition.id}`;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from: env.NEWSNETA_EMAIL_FROM, to: [recipient], subject: `NewsNeta Daily - ${edition.edition_date}`, html: `<p>NewsNeta Daily for <strong>${edition.edition_date}</strong> is ready.</p><p><a href="${editionUrl}">Read online</a> or <a href="${pdfUrl}">download the PDF</a>.</p><p>You received this edition because delivery consent was confirmed by an authorized NewsNeta administrator.</p>`, tags: [{ name: "edition", value: String(edition.edition_date).replace(/[^a-zA-Z0-9_-]/g, "-") }] })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Email provider returned ${response.status}`);
  return payload.id || null;
}

export async function sendEditionWhatsApp({ recipient, edition, origin, fetchImpl = fetch, env = process.env }) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_TEMPLATE_NAME) throw Object.assign(new Error("WhatsApp Business delivery is not configured"), { status: 503 });
  const graphVersion = clean(env.WHATSAPP_GRAPH_VERSION || "v27.0", 16);
  const editionUrl = `${origin}/epaper/${edition.id}`;
  const response = await fetchImpl(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: recipient.replace(/^\+/, ""), type: "template", template: { name: env.WHATSAPP_TEMPLATE_NAME, language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || "te" }, components: [{ type: "body", parameters: [{ type: "text", text: String(edition.edition_date) }, { type: "text", text: editionUrl }] }] } })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `WhatsApp provider returned ${response.status}`);
  return payload.messages?.[0]?.id || null;
}

export async function deliverEdition(row, edition, origin, options = {}) {
  const env = options.env || process.env;
  const recipient = decryptRecipient(row.recipient_encrypted, env.EDITION_DELIVERY_SECRET);
  if (row.channel === "email") return sendEditionEmail({ recipient, edition, origin, idempotencyKey: `newsneta-edition-${row.id}`, fetchImpl: options.fetchImpl, env });
  return sendEditionWhatsApp({ recipient, edition, origin, fetchImpl: options.fetchImpl, env });
}
