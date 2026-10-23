const ALLOWED_HOSTS = new Set(["thumb.wikimedia.org", "upload.wikimedia.org"]);

const json = (status, body) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

export function allowedImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

export default async function handler(request) {
  if (!["GET", "HEAD"].includes(request.method)) return json(405, { status: "method-not-allowed" });
  const source = allowedImageUrl(new URL(request.url).searchParams.get("url"));
  if (!source) return json(400, { status: "invalid-image-url" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(source, {
      method: request.method,
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/avif,image/webp,image/*" }
    });
    const contentType = String(upstream.headers.get("content-type") || "").toLowerCase();
    if (!upstream.ok || !contentType.startsWith("image/")) return json(502, { status: "image-unavailable" });
    const length = upstream.headers.get("content-length");
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(length ? { "Content-Length": length } : {}),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return json(504, { status: "image-timeout" });
  } finally {
    clearTimeout(timeout);
  }
}
