import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handler: runIngestion } = require("../lib/ingest-news-core.js");

export default async function handler() {
  const result = await runIngestion();
  return new Response(result.body, {
    status: result.statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

