import { getDatabase } from "@netlify/database";

const escapeHtml = value => String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export default async function handler(request) {
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Edition not found", { status: 404 });
  const { pool } = getDatabase();
  const result = await pool.query({
    text: `SELECT id,edition_date,edition_scope,page_count FROM daily_editions WHERE id=$1 AND status='published' LIMIT 1`,
    values: [id]
  });
  const edition = result.rows[0];
  if (!edition) return new Response("Edition not found", { status: 404 });
  const title = `NewsNeta Daily - ${edition.edition_date}`;
  const canonical = `${url.origin}/epaper/${edition.id}`;
  const pdf = `${url.origin}/.netlify/functions/editions?action=pdf&id=${edition.id}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`${title} ${canonical}`)}`;
  return new Response(`<!doctype html><html lang="te"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="Read the ${escapeHtml(edition.edition_scope)} NewsNeta Daily Telugu ePaper."><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(edition.page_count)}-page NewsNeta Daily ePaper"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${url.origin}/assets/brand/v1/social-share-1200x630.png"><link rel="canonical" href="${escapeHtml(canonical)}"><style>body{margin:0;background:#f3f4f6;color:#161616;font-family:system-ui,sans-serif}.bar{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 18px;background:#d71920;color:#fff;flex-wrap:wrap}.bar img{width:180px;max-height:58px;object-fit:contain}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions a{padding:10px 14px;border-radius:6px;background:#fff;color:#b31218;font-weight:800;text-decoration:none}.reader{height:calc(100vh - 86px);min-height:620px;padding:12px}.reader iframe{width:100%;height:100%;border:1px solid #d1d5db;background:#fff}@media(max-width:640px){.bar img{width:140px}.reader{height:calc(100vh - 132px);padding:6px}}</style></head><body><header class="bar"><img src="/assets/brand/v1/wordmark-desktop.png" alt="NewsNeta"><strong>${escapeHtml(edition.edition_date)} - ${escapeHtml(edition.edition_scope)}</strong><div class="actions"><a href="${escapeHtml(pdf)}" download>Download PDF</a><a href="${escapeHtml(share)}" target="_blank" rel="noopener">WhatsApp</a><a href="/">Latest News</a></div></header><main class="reader"><iframe src="${escapeHtml(pdf)}" title="${escapeHtml(title)}"></iframe></main></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300, must-revalidate", "X-Content-Type-Options": "nosniff" } });
}
