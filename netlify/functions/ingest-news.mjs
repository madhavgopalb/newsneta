import { getDatabase } from "@netlify/database";
import "rss-parser";
import ingestionCore from "../lib/ingest-news-core.js";

const { handler: runIngestion } = ingestionCore;

export default async function handler() {
  const result = await runIngestion(getDatabase);
  console.info(JSON.stringify({ code: "INGESTION_RESULT", statusCode: result.statusCode, body: JSON.parse(result.body || "{}") }));
  return new Response(result.body, {
    status: result.statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
