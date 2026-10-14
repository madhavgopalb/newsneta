import { getDatabase } from "@netlify/database";
import ingestionCore from "../lib/ingest-news-core.js";

const { handler: runIngestion } = ingestionCore;

export default async function handler() {
  const result = await runIngestion(getDatabase);
  return new Response(result.body, {
    status: result.statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
