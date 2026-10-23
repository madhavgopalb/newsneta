const crypto = require("node:crypto");
const { handler: fetchNews, _test: newsTest } = require("./news-core");

const LOCK_ID = 638281002;
const DEFAULT_CATEGORIES = ["latest", "ap", "telangana", "politics", "national", "international", "cinema", "sports", "cricket", "technology", "business", "education", "jobs", "viral"];
const MAX_RETRIES = 2;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const safeText = value => String(value || "").replace(/\s+/g, " ").trim();
const stableHash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const slugFor = (title, identity) => {
  const base = safeText(title).toLowerCase().replace(/[^a-z0-9\u0c00-\u0c7f]+/gu, "-").replace(/^-|-$/g, "").slice(0, 150) || "news";
  return `${base}-${stableHash(identity).slice(0, 12)}`;
};

async function withRetry(operation, label) {
  let error;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (caught) {
      error = caught;
      if (attempt === MAX_RETRIES) break;
      await sleep(500 * (2 ** attempt));
    }
  }
  throw new Error(`${label}: ${error?.message || error}`);
}

function canonicalArticle(item, category, provider) {
  const sourceUrl = safeText(item.link || item.url);
  const sourceArticleId = safeText(item.id || item.guid || sourceUrl).slice(0, 320);
  if (!sourceArticleId || !safeText(item.title) || !item.pubDate) return null;
  const media = item.media && item.media.url ? item.media : null;
  return {
    identity: sourceArticleId,
    slug: slugFor(item.title, `${provider}:${sourceArticleId}`),
    title: safeText(item.title),
    summary: safeText(item.description || item.summary || item.aiSummary),
    body: safeText(item.body || item.description || item.summary || item.title),
    category,
    state: item.state || (category === "ap" ? "Andhra Pradesh" : category === "telangana" ? "Telangana" : null),
    district: item.district || null,
    authorId: `feed:${safeText(item.source || provider).slice(0, 140) || provider}`,
    sourceUrl,
    sourceName: safeText(item.source || provider).slice(0, 200),
    publishedAt: new Date(item.pubDate),
    imageUrl: media?.url || null,
    thumbnailUrl: media?.thumbnailUrl || media?.url || null,
    featuredMedia: media
  };
}

async function validateMediaUrl(url) {
  if (!url || !/^https:\/\//i.test(url) || /logo|placeholder|sprite|icon/i.test(url)) return false;
  for (const method of ["HEAD", "GET"]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: method === "GET"
          ? { Accept: "image/avif,image/webp,image/*", Range: "bytes=0-1023" }
          : { Accept: "image/avif,image/webp,image/*" }
      });
      const type = String(response.headers.get("content-type") || "").toLowerCase();
      if (response.ok && type.startsWith("image/")) {
        if (response.body) await response.body.cancel().catch(() => {});
        return true;
      }
      if (response.body) await response.body.cancel().catch(() => {});
    } catch (error) {
      // Some licensed image CDNs reject HEAD while serving GET normally.
    } finally {
      clearTimeout(timeout);
    }
  }
  return false;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

async function ingestCategory(client, category, getDatabase) {
  category = newsTest.normalizeCategory(category);
  const result = await withRetry(async () => {
    const response = await fetchNews({ queryStringParameters: { cat: category, force: String(Date.now()), ingest: "1" } }, getDatabase);
    if (response.statusCode !== 200) throw new Error(`News API HTTP ${response.statusCode}`);
    const payload = JSON.parse(response.body || "{}");
    if (!Array.isArray(payload.items)) throw new Error("Malformed provider response");
    return payload;
  }, `category ${category}`);

  const provider = safeText(result.provider || "rss").slice(0, 80);
  const normalized = result.items.map(item => canonicalArticle(item, category, provider)).filter(Boolean);
  const articles = await mapWithConcurrency(normalized, 4, async article => {
    if (!article.imageUrl) return article;
    if (await validateMediaUrl(article.imageUrl)) return article;
    return { ...article, imageUrl: null, thumbnailUrl: null, featuredMedia: null, brokenMedia: true };
  });
  const counts = { fetched: result.items.length, inserted: 0, updated: 0, rejected: result.items.length - articles.length, withoutMedia: 0, brokenMedia: 0 };

  for (const article of articles) {
    if (!article.imageUrl) counts.withoutMedia += 1;
    if (article.brokenMedia) counts.brokenMedia += 1;
    const query = await client.query({
      text: `INSERT INTO articles (
        slug, title, summary, body, category, state, district, status, author_id,
        image_url, thumbnail_url, media, featured_media, source_provider,
        source_article_id, source_url, source_name, source_published_at,
        published_at, ingested_at, last_seen_at, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,'published',$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$17,now(),now(),now(),now()
      ) ON CONFLICT (source_provider, source_article_id)
        WHERE source_provider IS NOT NULL AND source_article_id IS NOT NULL
      DO UPDATE SET
        title=EXCLUDED.title, summary=EXCLUDED.summary, body=EXCLUDED.body,
        category=CASE WHEN articles.category='latest' THEN EXCLUDED.category WHEN EXCLUDED.category='latest' THEN articles.category ELSE EXCLUDED.category END, state=EXCLUDED.state, district=EXCLUDED.district,
        source_url=EXCLUDED.source_url, source_name=EXCLUDED.source_name,
        source_published_at=EXCLUDED.source_published_at, published_at=EXCLUDED.published_at,
        image_url=COALESCE(EXCLUDED.image_url, articles.image_url),
        thumbnail_url=COALESCE(EXCLUDED.thumbnail_url, articles.thumbnail_url),
        media=CASE WHEN EXCLUDED.featured_media IS NOT NULL THEN EXCLUDED.media ELSE articles.media END,
        featured_media=COALESCE(EXCLUDED.featured_media, articles.featured_media),
        last_seen_at=now(), updated_at=now()
      RETURNING (xmax = 0) AS inserted`,
      values: [
        article.slug, article.title, article.summary, article.body, article.category,
        article.state, article.district, article.authorId, article.imageUrl,
        article.thumbnailUrl, JSON.stringify(article.featuredMedia ? [article.featuredMedia] : []),
        JSON.stringify(article.featuredMedia), provider, article.identity, article.sourceUrl,
        article.sourceName, article.publishedAt
      ]
    });
    if (query.rows[0]?.inserted) counts.inserted += 1;
    else counts.updated += 1;
  }
  return { provider, counts };
}

exports.handler = async function handler(getDatabase, categoryOverride = null) {
  const startedAt = Date.now();
  let connection;
  try {
    connection = getDatabase();
  } catch (error) {
    return { statusCode: 503, body: JSON.stringify({ status: "database-unavailable", message: error.message }) };
  }
  const client = await connection.pool.connect();
  const categories = safeText(process.env.NEWS_INGEST_CATEGORIES).split(",").map(value => value.trim()).filter(Boolean);
  const selected = Array.isArray(categoryOverride) && categoryOverride.length
    ? categoryOverride.map(newsTest.normalizeCategory).filter((value, index, values) => values.indexOf(value) === index)
    : (categories.length ? categories : DEFAULT_CATEGORIES);
  const errors = [];
  const totals = { fetched: 0, inserted: 0, updated: 0, rejected: 0, withoutMedia: 0, brokenMedia: 0 };
  let runId;

  try {
    const lock = await client.query("SELECT pg_try_advisory_lock($1) AS acquired", [LOCK_ID]);
    if (!lock.rows[0]?.acquired) return { statusCode: 202, body: JSON.stringify({ status: "skipped", reason: "ingestion-already-running" }) };
    const run = await client.query("INSERT INTO ingestion_runs (provider, status, categories) VALUES ($1, 'running', $2::jsonb) RETURNING id", ["newsneta-feed-pipeline", JSON.stringify(selected)]);
    runId = run.rows[0].id;

    const queue = [...selected];
    const requestedConcurrency = Number(process.env.NEWS_INGEST_CONCURRENCY || 2);
    const concurrency = Math.max(1, Math.min(3, Number.isFinite(requestedConcurrency) ? requestedConcurrency : 2));
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const category = queue.shift();
        try {
          const result = await ingestCategory(client, category, getDatabase);
          for (const key of Object.keys(totals)) totals[key] += result.counts[key] || 0;
        } catch (error) {
          errors.push({ category, message: error.message, at: new Date().toISOString() });
        }
      }
    }));

    const status = errors.length === selected.length
      ? "failed"
      : errors.length
        ? "partial"
        : totals.inserted === 0
          ? "success-no-new-articles"
          : "success";
    const durationMs = Date.now() - startedAt;
    await client.query({
      text: `UPDATE ingestion_runs SET status=$1, finished_at=now(), duration_ms=$2,
        articles_fetched=$3, articles_inserted=$4, articles_updated=$5,
        articles_rejected=$6, errors=$7::jsonb, metadata=$8::jsonb WHERE id=$9`,
      values: [status, durationMs, totals.fetched, totals.inserted, totals.updated, totals.rejected, JSON.stringify(errors), JSON.stringify({ withoutMedia: totals.withoutMedia, brokenMedia: totals.brokenMedia }), runId]
    });
    return { statusCode: status === "failed" ? 502 : 200, body: JSON.stringify({ status, durationMs, categories: selected, totals, errors }) };
  } catch (error) {
    if (runId) await client.query("UPDATE ingestion_runs SET status='failed', finished_at=now(), duration_ms=$1, errors=$2::jsonb WHERE id=$3", [Date.now() - startedAt, JSON.stringify([{ message: error.message }]), runId]).catch(() => {});
    return { statusCode: 500, body: JSON.stringify({ status: "failed", message: error.message }) };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
};

exports._test = { canonicalArticle, slugFor, stableHash, validateMediaUrl };
