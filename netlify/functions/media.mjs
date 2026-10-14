import { getStore } from "@netlify/blobs";

export default async function handler(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });
  const store = getStore({ name: "newsneta-media", consistency: "strong" });
  const entry = await store.getWithMetadata(key, { type: "arrayBuffer", consistency: "strong" });
  if (!entry) return new Response("Not found", { status: 404 });
  return new Response(entry.data, {
    status: 200,
    headers: {
      "Content-Type": entry.metadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}