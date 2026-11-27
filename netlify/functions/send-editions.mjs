import { getDatabase } from "@netlify/database";
import { sendQueuedDelivery } from "./edition-distribute.mjs";

export default async function handler(request) {
  const { pool } = getDatabase();
  const claimed = await pool.query(`UPDATE edition_deliveries SET status='processing',attempts=attempts+1,updated_at=now()
    WHERE id IN (SELECT id FROM edition_deliveries WHERE status IN ('queued','failed') AND scheduled_at<=now() AND attempts<4 ORDER BY scheduled_at LIMIT 20 FOR UPDATE SKIP LOCKED)
    RETURNING *`);
  let sent = 0;
  let failed = 0;
  for (const delivery of claimed.rows) {
    try { await sendQueuedDelivery(pool, delivery, new URL(request.url).origin); sent += 1; }
    catch { failed += 1; }
  }
  return Response.json({ status: "ok", claimed: claimed.rows.length, sent, failed });
}
