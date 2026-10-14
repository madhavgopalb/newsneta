import { getDatabase } from "@netlify/database";
import "rss-parser";
import newsCore from "../lib/news-core.js";

export default async function handler(request) {
  const url = new URL(request.url);
  const result = await newsCore.handler({
    queryStringParameters: Object.fromEntries(url.searchParams.entries())
  }, getDatabase);
  return new Response(result.body, {
    status: result.statusCode,
    headers: result.headers
  });
}
