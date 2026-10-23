import crypto from "node:crypto";
import { getDatabase } from "@netlify/database";
import "rss-parser";
import ingestionCore from "../lib/ingest-news-core.js";
import newsCore from "../lib/news-core.js";

const { handler: runIngestion } = ingestionCore;
const ALLOWED_CATEGORIES = new Set([
  "latest", "ap", "telangana", "politics", "national", "international",
  "cinema", "sports", "cricket", "technology", "business", "education",
  "jobs", "viral"
]);
const ALLOWED_ALIASES = new Set(["andhra", "andhra-pradesh", "andhrapradesh", "tg", "ts", "tech", "world", "india"]);

const json = (status, body) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" }
});

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function normalizeCategories(input) {
  const requested = Array.isArray(input) ? input : [input];
  return requested
    .map(value => String(value || "").trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(value => ALLOWED_CATEGORIES.has(value) || ALLOWED_ALIASES.has(value))
    .map(value => newsCore._test.normalizeCategory(value))
    .filter(value => ALLOWED_CATEGORIES.has(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);
}

export default async function handler(request) {
  if (request.method !== "POST") return json(405, { status: "method-not-allowed" });
  const expected = process.env.ADMIN_HEALTH_TOKEN;
  const supplied = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !safeEqual(supplied, expected)) return json(401, { status: "unauthorized" });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { status: "invalid-request", message: "A JSON request body is required." });
  }
  const categories = normalizeCategories(body.categories);
  if (!categories.length) return json(400, { status: "invalid-request", message: "Select at least one supported category." });

  const result = await runIngestion(getDatabase, categories);
  return new Response(result.body, {
    status: result.statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
