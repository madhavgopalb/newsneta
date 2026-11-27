import { getDatabase } from "@netlify/database";
import auth from "../lib/cms-auth.js";
import { deliverEdition, encryptRecipient, maskRecipient, validateRecipient } from "../lib/edition-distribution.mjs";

const json = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const bearer = request => String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
const session = request => auth.verifySession(bearer(request), process.env.CMS_SESSION_SECRET);

async function publishedEdition(pool, id) {
  const result = await pool.query({ text: "SELECT id,edition_date,edition_scope,pdf_storage_key FROM daily_editions WHERE id=$1 AND status='published' LIMIT 1", values: [id] });
  return result.rows[0] || null;
}

export async function sendQueuedDelivery(pool, delivery, origin, options = {}) {
  const edition = await publishedEdition(pool, delivery.edition_id);
  if (!edition?.pdf_storage_key) throw new Error("Published edition PDF is unavailable");
  try {
    const providerId = await deliverEdition(delivery, edition, origin, options);
    await pool.query({ text: "UPDATE edition_deliveries SET status='sent',provider_message_id=$1,sent_at=now(),last_error=NULL,updated_at=now() WHERE id=$2", values: [providerId, delivery.id] });
    return providerId;
  } catch (error) {
    await pool.query({ text: "UPDATE edition_deliveries SET status='failed',last_error=$1,updated_at=now() WHERE id=$2", values: [String(error.message || error).slice(0, 1000), delivery.id] });
    throw error;
  }
}

export default async function handler(request) {
  try {
    const user = session(request);
    if (user?.role !== "admin") return json(403, { status: "forbidden" });
    const { pool } = getDatabase();
    const url = new URL(request.url);
    if (request.method === "GET") {
      const result = await pool.query(`SELECT d.id,d.edition_id,d.channel,d.recipient_masked,d.consent_confirmed,d.scheduled_at,d.status,d.attempts,d.provider_message_id,d.last_error,d.sent_at,d.created_at,e.edition_date
        FROM edition_deliveries d JOIN daily_editions e ON e.id=d.edition_id ORDER BY d.created_at DESC LIMIT 100`);
      return json(200, { status: "ok", items: result.rows, providers: { email: Boolean(process.env.RESEND_API_KEY && process.env.NEWSNETA_EMAIL_FROM), whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME) } });
    }
    if (request.method !== "POST") return json(405, { status: "method-not-allowed" });
    const data = await request.json();
    if (!data.consentConfirmed) return json(400, { status: "consent-required", message: "Recipient consent must be confirmed before delivery" });
    if (!/^[0-9a-f-]{36}$/i.test(String(data.editionId || ""))) return json(400, { status: "invalid-edition" });
    const edition = await publishedEdition(pool, data.editionId);
    if (!edition?.pdf_storage_key) return json(409, { status: "edition-not-ready", message: "Publish and generate the edition PDF before distribution" });
    const channel = data.channel === "whatsapp" ? "whatsapp" : "email";
    const recipient = validateRecipient(channel, data.recipient);
    const scheduledAt = data.sendNow ? new Date() : new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date(Date.now() - 60000)) return json(400, { status: "invalid-schedule", message: "Choose a valid future delivery time" });
    const inserted = await pool.query({
      text: `INSERT INTO edition_deliveries (edition_id,channel,recipient_encrypted,recipient_masked,consent_confirmed,scheduled_at,requested_by)
        VALUES ($1,$2,$3,$4,true,$5,$6) RETURNING *`,
      values: [edition.id, channel, encryptRecipient(recipient, process.env.EDITION_DELIVERY_SECRET), maskRecipient(channel, recipient), scheduledAt.toISOString(), user.id]
    });
    const delivery = inserted.rows[0];
    if (data.sendNow) {
      await pool.query({ text: "UPDATE edition_deliveries SET status='processing',attempts=attempts+1,updated_at=now() WHERE id=$1", values: [delivery.id] });
      await sendQueuedDelivery(pool, { ...delivery, status: "processing", attempts: 1 }, url.origin);
    }
    return json(201, { status: "ok", delivery: { ...delivery, recipient_encrypted: undefined } });
  } catch (error) {
    console.error(JSON.stringify({ code: "EDITION_DELIVERY_FAILED", message: error.message, timestamp: new Date().toISOString() }));
    return json(error.status || 500, { status: "error", message: error.status ? error.message : "Edition delivery failed" });
  }
}

export { publishedEdition };
