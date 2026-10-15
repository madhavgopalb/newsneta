import { getStore } from "@netlify/blobs";
import { getDatabase } from "@netlify/database";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match) return { invalid: true };
  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);
  if (start === null) {
    const suffix = end;
    if (!Number.isInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    if (!Number.isInteger(start) || start < 0 || start >= size) return { invalid: true };
    end = end === null ? size - 1 : Math.min(end, size - 1);
    if (!Number.isInteger(end) || end < start) return { invalid: true };
  }
  return { start, end };
}

function rangedStream(source, start, end) {
  const reader = source.getReader();
  let offset = 0;
  let finished = false;
  return new ReadableStream({
    async pull(controller) {
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) {
          finished = true;
          controller.close();
          return;
        }
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        const chunkStart = offset;
        const chunkEnd = offset + chunk.byteLength - 1;
        offset += chunk.byteLength;
        if (chunkEnd < start) continue;
        if (chunkStart > end) {
          finished = true;
          await reader.cancel();
          controller.close();
          return;
        }
        const from = Math.max(0, start - chunkStart);
        const to = Math.min(chunk.byteLength, end - chunkStart + 1);
        if (to > from) controller.enqueue(chunk.subarray(from, to));
        if (chunkEnd >= end) {
          finished = true;
          await reader.cancel();
          controller.close();
        }
        return;
      }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
}

export default async function handler(request) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.includes("..") || key.startsWith("/")) return notFound();

  const { pool } = getDatabase();
  const result = await pool.query({
    text: `SELECT m.storage_key,m.mime_type,m.file_name,m.file_size
      FROM media_assets m JOIN articles a ON a.id=m.article_id
      WHERE m.storage_key=$1 AND m.status='approved' AND a.status='published'
        AND a.source_provider='newsneta-cms' LIMIT 1`,
    values: [key]
  });
  const asset = result.rows[0];
  if (!asset) return notFound();

  const size = Number(asset.file_size);
  const type = asset.mime_type || "application/octet-stream";
  const headers = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": `inline; filename="${String(asset.file_name || "media").replace(/["\r\n]/g, "")}"`,
    "X-Content-Type-Options": "nosniff"
  };
  const range = parseRange(request.headers.get("range"), size);
  if (range?.invalid) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: { ...headers, "Content-Length": String(size) } });

  const store = getStore({ name: "newsneta-media", consistency: "strong" });
  const entry = await store.getWithMetadata(key, { type: "stream", consistency: "strong" });
  if (!entry) return notFound();
  if (!range) return new Response(entry.data, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
  const length = range.end - range.start + 1;
  return new Response(rangedStream(entry.data, range.start, range.end), {
    status: 206,
    headers: { ...headers, "Content-Length": String(length), "Content-Range": `bytes ${range.start}-${range.end}/${size}` }
  });
}

export { parseRange, rangedStream };
