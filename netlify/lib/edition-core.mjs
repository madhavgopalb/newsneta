import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const TELUGU_FONT = path.resolve(moduleDir, "../../assets/fonts/NotoSansTelugu.ttf");
const DEVANAGARI_FONT = path.resolve(moduleDir, "../../assets/fonts/NotoSansDevanagari.ttf");
const A3 = [841.89, 1190.55];

const clean = (value, max = 10000) => String(value || "").replace(/\0/g, "").trim().slice(0, max);
const words = value => clean(value, 20000).split(/\s+/u).filter(Boolean);

export function normalizedHeadline(value) {
  return clean(value, 500).toLocaleLowerCase("te-IN").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function deduplicateArticles(rows = [], limit = 30) {
  const seenIds = new Set();
  const seenHeadlines = new Set();
  return rows.filter(row => {
    const id = String(row.id || "");
    const headline = normalizedHeadline(row.title || row.headline);
    if (!id || !headline || seenIds.has(id) || seenHeadlines.has(headline)) return false;
    seenIds.add(id);
    seenHeadlines.add(headline);
    return true;
  }).slice(0, Math.max(1, Math.min(30, Number(limit) || 30)));
}

export function editionSummary(row, maxWords = 95) {
  const source = clean(row.edition_summary || row.summary || row.source_description || row.body, 12000);
  const selected = words(source).slice(0, Math.max(20, Math.min(120, maxWords)));
  return selected.join(" ") + (words(source).length > selected.length ? "..." : "");
}

export function editionSection(row) {
  const category = clean(row.category, 80).toLowerCase();
  if (category === "telangana") return "తెలంగాణ";
  if (["ap", "andhra-pradesh", "andhra pradesh"].includes(category)) return "ఆంధ్రప్రదేశ్";
  if (category === "districts") return "జిల్లా వార్తలు";
  if (category === "sports") return "క్రీడలు";
  if (category === "business") return "బిజినెస్";
  if (category === "cinema") return "సినిమా";
  if (category === "politics") return "రాజకీయాలు";
  return clean(row.category, 80) || "ముఖ్య వార్తలు";
}

function safeArticleUrl(baseUrl, item) {
  const slug = clean(item.article_slug || item.slug, 240);
  if (!slug) return baseUrl;
  return new URL(`/news/${encodeURIComponent(slug)}`, baseUrl).href;
}

async function loadImage(url, baseUrl) {
  const raw = clean(url, 3000);
  if (!raw) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(new URL(raw, baseUrl), { signal: controller.signal, headers: { Accept: "image/jpeg,image/png,image/webp,image/*" } });
    const type = String(response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok || !type.startsWith("image/")) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function storyBlock(doc, item, x, y, width, height, baseUrl, image) {
  const link = safeArticleUrl(baseUrl, item);
  doc.save().lineWidth(0.6).strokeColor("#d6d6d6").rect(x, y, width, height).stroke().restore();
  let textX = x + 10;
  let textWidth = width - 20;
  if (image) {
    const imageWidth = Math.min(150, width * 0.34);
    try {
      doc.image(image, x + 10, y + 10, { fit: [imageWidth, 92], align: "center", valign: "center" });
      textX += imageWidth + 10;
      textWidth -= imageWidth + 10;
    } catch { /* Keep the text layout when an image decoder rejects the source. */ }
  }
  doc.fillColor("#d71920").fontSize(9).text(clean(item.section, 80), textX, y + 10, { width: textWidth, lineBreak: false });
  doc.fillColor("#151515").fontSize(15).text(clean(item.headline, 500), textX, y + 28, { width: textWidth, height: 47, ellipsis: true, link, underline: false });
  doc.fillColor("#4b5563").fontSize(9.5).text(clean(item.summary, 5000), textX, y + 80, { width: textWidth, height: height - 91, ellipsis: true, lineGap: 2 });
}

export async function renderEditionPdf(edition, items, { baseUrl = "https://newsneta.com" } = {}) {
  const editionFont = edition.language === "hi" ? DEVANAGARI_FONT : TELUGU_FONT;
  if (!fs.existsSync(editionFont)) throw new Error("Edition PDF font is unavailable");
  const doc = new PDFDocument({ size: A3, margin: 36, autoFirstPage: false, info: { Title: `NewsNeta Daily ${edition.edition_date}`, Author: "NewsNeta" } });
  const chunks = [];
  doc.on("data", chunk => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  doc.registerFont("NewsNetaTelugu", editionFont);
  doc.font("NewsNetaTelugu");

  const pageCount = Math.max(1, Number(edition.page_count) || 4);
  const perPage = Math.max(1, Math.ceil(items.length / pageCount));
  const imageBuffers = await Promise.all(items.map((item, index) => index < 12 ? loadImage(item.image_url, baseUrl) : null));

  for (let page = 0; page < pageCount; page += 1) {
    const pageItems = items.slice(page * perPage, (page + 1) * perPage);
    if (!pageItems.length && page > 0) break;
    doc.addPage();
    doc.rect(0, 0, A3[0], 92).fill("#d71920");
    doc.fillColor("#ffffff").fontSize(31).text("న్యూస్ నేత", 36, 18, { width: 360 });
    doc.fontSize(14).text("NewsNeta Daily", 39, 58, { width: 260 });
    doc.fontSize(11).text(`${edition.edition_date}  |  ${clean(edition.edition_scope || "combined", 40).toUpperCase()}`, 500, 35, { width: 300, align: "right" });
    doc.fillColor("#151515").fontSize(10).text("newsneta.com", 36, 104, { link: baseUrl });

    const columns = 2;
    const gap = 16;
    const contentTop = 126;
    const footerY = A3[1] - 70;
    const columnWidth = (A3[0] - 72 - gap) / columns;
    const rows = Math.max(1, Math.ceil(pageItems.length / columns));
    const blockHeight = Math.min(238, (footerY - contentTop - gap * (rows - 1)) / rows);
    pageItems.forEach((item, localIndex) => {
      const column = localIndex % columns;
      const row = Math.floor(localIndex / columns);
      const x = 36 + column * (columnWidth + gap);
      const y = contentTop + row * (blockHeight + gap);
      storyBlock(doc, item, x, y, columnWidth, blockHeight, baseUrl, imageBuffers[page * perPage + localIndex]);
    });
    doc.fillColor("#6b7280").fontSize(9).text(`NewsNeta Daily  •  Page ${page + 1}`, 36, footerY, { width: A3[0] - 72, align: "center", lineBreak: false });
  }
  doc.end();
  return completed;
}

export { DEVANAGARI_FONT, TELUGU_FONT };
