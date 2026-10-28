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

export function normalizeMediaDelivery(item, origin) {
  const delivered = deliveryImageUrl(item.image || item.imageUrl, origin);
  const thumbnail = deliveryImageUrl(item.thumbnailUrl, origin);
  const normalizeMedia = media => media ? {
    ...media,
    url: deliveryImageUrl(media.url || media.publicUrl || media.public_url, origin),
    publicUrl: deliveryImageUrl(media.publicUrl || media.public_url || media.url, origin),
    thumbnailUrl: deliveryImageUrl(media.thumbnailUrl || media.thumbnail_url, origin)
  } : media;
  const media = Array.isArray(item.media) ? item.media.map(normalizeMedia) : normalizeMedia(item.media);
  const featuredMedia = normalizeMedia(item.featuredMedia || item.featured_media);
  const video = item.video ? { ...item.video, posterUrl: deliveryImageUrl(item.video.posterUrl, origin) } : item.video;
  return { ...item, image: delivered, imageUrl: delivered, thumbnailUrl: thumbnail, media, featuredMedia, video };
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
    if (payload.item) payload.item = normalizeMediaDelivery(payload.item, url.origin);
    body = JSON.stringify(payload);
  } catch {
    // Preserve the core error payload when it is not JSON.
  }
  return new Response(body, {
    status: result.statusCode,
    headers: result.headers
  });
}
