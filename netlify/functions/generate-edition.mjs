import { getDatabase } from "@netlify/database";
import { createEditionDraft } from "./editions.mjs";

export default async function handler() {
  try {
    const { pool } = getDatabase();
    const now = new Date();
    const editionDate = now.toISOString().slice(0, 10);
    const edition = await createEditionDraft(pool, { id: "system:daily-edition", role: "admin" }, { editionDate, language: "te", editionScope: "combined", pageCount: 4 });
    console.log(JSON.stringify({ code: "DAILY_EDITION_DRAFT_READY", editionId: edition.id, editionDate, timestamp: now.toISOString() }));
    return Response.json({ status: "ok", editionId: edition.id });
  } catch (error) {
    console.error(JSON.stringify({ code: "DAILY_EDITION_DRAFT_FAILED", message: error.message, timestamp: new Date().toISOString() }));
    return Response.json({ status: "error", message: "Daily edition draft failed" }, { status: 500 });
  }
}
