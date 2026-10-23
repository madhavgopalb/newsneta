import { getDatabase } from "@netlify/database";
import "rss-parser";
import newsCore from "../lib/news-core.js";

const PROXIED_IMAGE_HOSTS = new Set(["thumb.wikimedia.org", "upload.wikimedia.org"]);

export function deliveryImageUrl(value, origin) {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (!PROXIED_IMAGE_HOSTS.has(url.hostname.toLowerCase())) return value;
    return `${origin}/.netlify/functions/image?url=${encodeURIComponent(url.href)}`;
  } catch {
    return value;
  }
}

function normalizeMediaDelivery(item, origin) {
  const delivered = deliveryImageUrl(item.image || item.imageUrl, origin);
  const thumbnail = deliveryImageUrl(item.thumbnailUrl, origin);
  const media = item.media && !Array.isArray(item.media)
    ? { ...item.media, url: deliveryImageUrl(item.media.url, origin), thumbnailUrl: deliveryImageUrl(item.media.thumbnailUrl, origin) }
    : item.media;
  return { ...item, image: delivered, imageUrl: delivered, thumbnailUrl: thumbnail, media };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const result = await newsCore.handler({
    queryStringParameters: Object.fromEntries(url.searchParams.entries())
  }, getDatabase);
  let body = result.body;
  try {
    const payload = JSON.parse(result.body || "{}");
    if (Array.isArray(payload.items)) payload.items = payload.items.map(item => normalizeMediaDelivery(item, url.origin));
    body = JSON.stringify(payload);
  } catch {
    // Preserve the core error payload when it is not JSON.
  }
  return new Response(body, {
    status: result.statusCode,
    headers: result.headers
  });
}
