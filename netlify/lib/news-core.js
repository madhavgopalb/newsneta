const Parser = require("rss-parser");

const parser = new Parser({
  headers: {
    "User-Agent": "NewsNeta/1.0 (+https://newsneta.in)"
  },
  customFields: {
    item: [["content:encoded", "contentEncoded"]]
  }
});

const CACHE = {};
const IMAGE_CACHE = {};
const TTL = 4 * 60 * 1000;
const IMAGE_TTL = 6 * 60 * 60 * 1000;
const FRESH_NEWS_DAYS = 3;
const BRANDED_FALLBACK = "/assets/newsneta-logo-header.png";
// Archive candidates are always labelled as file photos. A score of 60 still
// requires multiple query/entity matches while allowing Telugu headlines whose
// English location or event terms only appear in the image catalogue metadata.
const AUTO_IMAGE_THRESHOLD = 60;

function googleNewsUrl(query) {
  const freshQuery = `${query} when:2d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(freshQuery)}&hl=te&gl=IN&ceid=IN:te`;
}

const FEEDS = {
  latest: googleNewsUrl("Telugu breaking latest news Telangana Andhra Pradesh India"),
  politics: googleNewsUrl("Telugu politics India"),
  telangana: googleNewsUrl("Telangana Telugu news"),
  ap: googleNewsUrl("Andhra Pradesh Telugu news"),
  national: googleNewsUrl("India Telugu news"),
  international: googleNewsUrl("World Telugu international news"),
  cinema: googleNewsUrl("Telugu cinema news"),
  sports: googleNewsUrl("Sports Telugu cricket"),
  cricket: googleNewsUrl("Cricket Telugu India IPL T20 match score"),
  technology: googleNewsUrl("Technology Telugu news"),
  business: googleNewsUrl("Business Telugu news"),
  education: googleNewsUrl("Education jobs exams Telugu news Telangana Andhra Pradesh"),
  jobs: googleNewsUrl("Government jobs recruitment Telugu Telangana Andhra Pradesh"),
  viral: googleNewsUrl("Viral Telugu news"),
  special: googleNewsUrl("Telugu special stories explainer ground report fact check public interest")
};

const CATEGORY_ALIASES = {
  andhra: "ap",
  "andhra-pradesh": "ap",
  andhrapradesh: "ap",
  tg: "telangana",
  ts: "telangana",
  tech: "technology",
  world: "international",
  india: "national"
};

function normalizeCategory(value = "") {
  const requested = String(value || "telangana").trim().toLowerCase().replace(/\s+/g, "-");
  const normalized = CATEGORY_ALIASES[requested] || requested;
  return Object.prototype.hasOwnProperty.call(FEEDS, normalized) ? normalized : "telangana";
}

const IMAGE_SETS = {
  telangana: [
    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1590253230532-a67f6bc61c9e?auto=format&fit=crop&w=1000&q=76"
  ],
  ap: [
    "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=76"
  ],
  politics: [
    "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1541872705-1f73c6400ec9?auto=format&fit=crop&w=1000&q=76"
  ],
  international: [
    "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1000&q=76"
  ],
  cinema: [
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1000&q=76"
  ],
  sports: [
    "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1000&q=76"
  ],
  technology: [
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1000&q=76"
  ],
  business: [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1000&q=76"
  ],
  weather: [
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1000&q=76"
  ],
  cricket: [
    "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?auto=format&fit=crop&w=1000&q=76"
  ],
  gold: [
    "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1605792657660-596af9009e82?auto=format&fit=crop&w=1000&q=76"
  ],
  traffic: [
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1000&q=76"
  ],
  default: [
    "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1000&q=76"
  ]
};

const CATEGORY_LABELS = {
  latest: "Latest",
  politics: "Politics",
  telangana: "Telangana",
  ap: "Andhra Pradesh",
  national: "National",
  international: "International",
  cinema: "Cinema",
  sports: "Sports",
  cricket: "Cricket",
  technology: "Technology",
  business: "Business",
  education: "Education",
  jobs: "Jobs",
  viral: "Viral",
  special: "Special Stories"
};

function feedFor(cat, district) {
  if (district) {
    const state = cat === "ap" ? "Andhra Pradesh" : "Telangana";
    return googleNewsUrl(`${district} ${state} Telugu news`);
  }
  return FEEDS[cat] || FEEDS.telangana;
}

function queryFor(cat, district) {
  if (district) {
    const state = cat === "ap" ? "Andhra Pradesh" : "Telangana";
    return `${district} ${state} Telugu news`;
  }
  const queries = {
    latest: "Telugu breaking latest news Telangana Andhra Pradesh India",
    politics: "Telugu politics India",
    telangana: "Telangana Telugu news",
    ap: "Andhra Pradesh Telugu news",
    national: "India Telugu news",
    international: "World Telugu news",
    cinema: "Telugu cinema news",
    sports: "Sports Telugu",
    cricket: "Cricket Telugu India IPL T20 match score",
    technology: "Technology Telugu news",
    business: "Business Telugu news",
    education: "Education exams Telugu news Telangana Andhra Pradesh",
    jobs: "Government jobs recruitment Telugu Telangana Andhra Pradesh",
    viral: "Viral Telugu news",
    special: "Telugu special stories explainer ground report fact check public interest"
  };
  return queries[cat] || queries.telangana;
}

function json(statusCode, body, cacheSeconds = 0) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheSeconds > 0 ? `public, max-age=${cacheSeconds}, stale-while-revalidate=60` : "no-store, max-age=0, must-revalidate"
    },
    body: JSON.stringify(body)
  };
}

function logEvent(code, details = {}) {
  console.error(JSON.stringify({
    code,
    timestamp: new Date().toISOString(),
    ...details
  }));
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function hashViews(text) {
  let hash = 0;
  for (const char of text) hash = (hash << 5) - hash + char.charCodeAt(0);
  return Math.abs(hash % 90000) + 18000;
}

function inferSentiment(index) {
  return ["Positive", "Neutral", "Mixed", "Alert"][index % 4];
}

function publicTitle(title = "") {
  const clean = String(title)
    .replace(/^RTV\s+Digital\.\s*\.\s*/iu, "")
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/\s+-\s+[^-]{2,80}$/u, "")
    .replace(/\s*\|\s*[^|]{2,80}$/u, "")
    .replace(/\s+/g, " ")
    .trim();
  const mixedPrefix = clean.match(/^([A-Za-z][A-Za-z0-9 .&/-]{1,48}):\s*(.*[\u0C00-\u0C7F].*)$/u);
  return mixedPrefix ? mixedPrefix[2].trim() : clean;
}

function publisherFromItem(item = {}) {
  const explicit = cleanText(item.source?.name || item.creator || item.author || "");
  if (explicit) return explicit;
  const rawTitle = String(item.title || "");
  return cleanText(rawTitle.match(/\s+-\s+([^-]{2,80})$/u)?.[1] || rawTitle.match(/\s*\|\s*([^|]{2,80})$/u)?.[1] || "");
}

function cleanText(value = "") {
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function licensedFullTextSources() {
  return new Set(String(process.env.NEWS_LICENSED_FULLTEXT_SOURCES || "")
    .split(",")
    .map(value => cleanText(value).toLowerCase())
    .filter(Boolean));
}

function decodeHtmlEntities(value = "") {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value).replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, token) => {
    if (token[0] === "#") {
      const hex = token[1]?.toLowerCase() === "x";
      const code = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return entities[token.toLowerCase()] || "";
  });
}

function normalizeLicensedBody(value = "") {
  return decodeHtmlEntities(String(value)
    .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function classifyProviderContent({ sourceName = "", title = "", summary = "", body = "" } = {}) {
  const normalizedBody = normalizeLicensedBody(body);
  const sourceLicensed = licensedFullTextSources().has(cleanText(sourceName).toLowerCase());
  const titleText = cleanText(title).toLowerCase();
  const bodyText = cleanText(normalizedBody).toLowerCase();
  const truncated = /\[\+\d+\s+chars?\]\s*$/i.test(normalizedBody) || /\.\.\.\s*$/i.test(normalizedBody);
  const substantive = normalizedBody.length >= 280
    && bodyText !== titleText
    && !bodyText.startsWith(`${titleText} ${cleanText(sourceName).toLowerCase()}`)
    && normalizedBody !== cleanText(summary)
    && !truncated;
  if (sourceLicensed && substantive) {
    return { body: normalizedBody, contentStatus: "licensed_full_text", fullContentReviewRequired: false, fullContentReviewReason: null };
  }
  return {
    body: "",
    contentStatus: "brief",
    fullContentReviewRequired: true,
    fullContentReviewReason: sourceLicensed
      ? "Licensed source payload did not contain a complete article body"
      : "Source supplied metadata or an excerpt without full-text syndication authorization"
  };
}

function extractImageIntent(title, cat, district, description = "") {
  const combined = cleanText(`${title} ${description}`);
  const englishEntities = combined.match(/\b[A-Z][A-Za-z.-]+(?:\s+[A-Z][A-Za-z.-]+){0,3}\b/g) || [];
  const stop = /^(Breaking News|Latest News|Telugu News|Andhra Pradesh|News Update)$/i;
  const entities = [...new Set(englishEntities.filter(entity => !stop.test(entity)))].slice(0, 5);
  const location = district || (/hyderabad|హైదరాబాద్/i.test(combined) ? "Hyderabad" : /vijayawada|విజయవాడ/i.test(combined) ? "Vijayawada" : "");
  const eventTerms = combined.match(/rain|flood|cyclone|election|meeting|protest|match|final|launch|court|arrest|వర్ష|వరద|తుఫాను|ఎన్నిక|సమావేశం|మ్యాచ్|కోర్టు/gi) || [];
  return {
    entities,
    location,
    event: [...new Set(eventTerms)].slice(0, 3),
    category: cat,
    query: [entities.slice(0, 2).join(" "), location, eventTerms.slice(0, 2).join(" "), new Date().getFullYear()].filter(Boolean).join(" ")
  };
}

function visualStatus(score, imageType) {
  if (imageType === "branded_fallback") return "orange";
  if (score >= 90) return "green";
  if (score >= 70) return "blue";
  if (imageType === "archive" || imageType === "representative") return "yellow";
  return "red";
}

function mediaDecision({
  url = null,
  source = "",
  originalUrl = "",
  photographer = "",
  copyrightOwner = "",
  license = "",
  attributionRequired = false,
  imageType = "missing",
  label = "",
  score = 10,
  intent = {},
  reasons = []
} = {}) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  return {
    url,
    thumbnailUrl: url,
    source,
    originalUrl,
    photographer,
    copyrightOwner,
    license,
    attributionRequired,
    imageType,
    label,
    relevanceScore: safeScore,
    visualStatus: visualStatus(safeScore, imageType),
    requiresReview: safeScore < 80 || !license || /unknown|verify/i.test(license),
    selectedAt: new Date().toISOString(),
    intent,
    scoreBreakdown: {
      semantic: Math.min(30, Math.round(safeScore * 0.30)),
      entity: Math.min(20, Math.round(safeScore * 0.20)),
      event: Math.min(20, Math.round(safeScore * 0.20)),
      location: Math.min(10, Math.round(safeScore * 0.10)),
      recency: Math.min(10, Math.round(safeScore * 0.10)),
      quality: Math.min(5, Math.round(safeScore * 0.05)),
      rights: Math.min(5, Math.round(safeScore * 0.05))
    },
    reasons
  };
}

function brandedFallbackDecision(intent, reason = "No sufficiently relevant, rights-aware image was found") {
  return mediaDecision({
    url: null,
    source: "",
    originalUrl: "",
    copyrightOwner: "",
    license: "",
    imageType: "missing",
    score: 0,
    intent,
    reasons: [reason]
  });
}

function representativeImageDecision(title, cat, district, index, intent, reason) {
  const url = selectImage(title, cat, district, index);
  return mediaDecision({
    url,
    originalUrl: url,
    source: "Unsplash",
    copyrightOwner: "Unsplash contributor",
    license: "Unsplash License",
    imageType: "representative",
    label: "REPRESENTATIVE IMAGE",
    score: 62,
    intent,
    reasons: [reason, "Selected from the matching NewsNeta topic photo collection"]
  });
}

function expandedNewsDescription(title, cat, district, seedText = "") {
  const cleanTitle = publicTitle(title);
  const sourceLine = cleanText(seedText)
    .replace(/^RTV\s+Digital\.\s*\.\s*/iu, "")
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/\s+(facebook|instagram|youtube|x)\.com\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedTitle = cleanTitle.toLocaleLowerCase("te-IN").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const normalizedSource = sourceLine.toLocaleLowerCase("te-IN").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!sourceLine || sourceLine.length < 40 || normalizedSource === normalizedTitle || normalizedSource.startsWith(normalizedTitle)) return "";
  return sourceLine;
}

function articleTime(item = {}) {
  const date = new Date(item.publishedAt || item.pubDate || item.isoDate || item.date || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isFreshArticle(item = {}, maxAgeDays = FRESH_NEWS_DAYS) {
  const time = articleTime(item);
  if (!time) return false;
  const ageMs = Date.now() - time;
  return ageMs >= 0 && ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function freshSorted(items = [], maxAgeDays = FRESH_NEWS_DAYS) {
  const seen = new Set();
  return items
    .filter(item => isFreshArticle(item, maxAgeDays))
    .filter(item => isUsefulTitle(publicTitle(item.title || "")))
    .sort((a, b) => articleTime(b) - articleTime(a))
    .filter(item => {
      const titleKey = publicTitle(item.title || "")
        .toLocaleLowerCase("te-IN")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
      const linkKey = String(item.url || item.link || "").split("?")[0].toLowerCase();
      const identity = titleKey || linkKey;
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

function isUsefulTitle(title = "") {
  const clean = String(title).replace(/\s+/g, " ").trim();
  if (clean.length < 14) return false;
  return !/^(breaking|live|latest|top news|12\s*:\s*00\s*a\.?m\.?|news update)$/iu.test(clean)
    && !/\b(profile|icc ranking|career statistics)\b/i.test(clean);
}

async function fetchGNewsItems(cat, district) {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    q: queryFor(cat, district),
    lang: "te",
    country: "in",
    max: "10",
    apikey: apiKey
  });
  const response = await fetch(`https://gnews.io/api/v4/search?${params.toString()}`, {
    headers: { "User-Agent": "NewsNeta/1.0" }
  });
  if (!response.ok) throw new Error(`GNews API failed: ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.articles) || payload.articles.length === 0) return null;

  const freshArticles = freshSorted(payload.articles);
  if (!freshArticles.length) return null;

  return Promise.all(freshArticles.slice(0, 10).map(async (article, index) => {
    const title = publicTitle(article.title);
    const description = expandedNewsDescription(title, cat, district, article.description);
    const sourceName = cleanText(article.source?.name || "");
    const content = classifyProviderContent({ sourceName, title, summary: description, body: article.content || article.body || "" });
    const intent = extractImageIntent(title, cat, district, description);
    let media = trustedImageUrl(article.image)
      ? mediaDecision({
          url: article.image,
          originalUrl: article.image,
          source: article.source?.name || "Licensed news provider",
          copyrightOwner: article.source?.name || "Publisher",
          license: "Provider-associated editorial image; verify syndication terms",
          imageType: "event_candidate",
          score: 88,
          intent,
          reasons: ["Image was supplied with the same provider article", "Headline and image share the provider record"]
        })
      : null;
    if (!media) {
      media = brandedFallbackDecision(intent, "The licensed provider did not supply an article-associated image");
    }
    return {
      id: article.url || `${cat}-gnews-${index}`,
      headline: title,
      title,
      link: article.url || "#",
      pubDate: article.publishedAt,
      desk: "NewsNeta",
      source: sourceName,
      category: district || CATEGORY_LABELS[cat] || "Telugu",
      district: district || null,
      state: cat === "ap" ? "Andhra Pradesh" : cat === "telangana" ? "Telangana" : null,
      image: media.url,
      imageUrl: media.url,
      video: null,
      media,
      imageLabel: media.label,
      imageRelevanceScore: media.relevanceScore,
      imageStatus: media.visualStatus,
      views: null,
      trust: null,
      sentiment: null,
      description,
      summary: description,
      body: content.body,
      fullArticle: content.body,
      aiSummary: description,
      contentStatus: content.contentStatus,
      fullContentReviewRequired: content.fullContentReviewRequired,
      fullContentReviewReason: content.fullContentReviewReason,
      sourceUrl: article.url || null,
      publishedAt: article.publishedAt,
      updatedAt: article.publishedAt
    };
  }));
}

function selectImage(title, cat, district, index) {
  const text = `${title} ${cat} ${district}`.toLowerCase();
  let key = cat;
  if (/gold|బంగారం|పసిడి/.test(text)) key = "gold";
  else if (/cricket|క్రికెట్|ipl|sports|క్రీడ/.test(text)) key = "cricket";
  else if (/weather|temperature|rain|cyclone|వాతావరణ|ఉష్ణోగ్రత|వర్ష/.test(text)) key = "weather";
  else if (/traffic|metro|road|accident|ట్రాఫిక్|రోడ్డు|ప్రమాద/.test(text)) key = "traffic";
  else if (/movie|cinema|సినిమా|బాక్సాఫీస్/.test(text)) key = "cinema";
  else if (/market|business|stock|economy|మార్కెట్|వ్యాపార/.test(text)) key = "business";
  else if (/tech|ai|mobile|టెక్నాలజీ|మొబైల్/.test(text)) key = "technology";
  else if (/trump|iran|israel|world|అంతర్జాతీయ|ప్రపంచ/.test(text)) key = "international";
  else if (district) key = cat === "ap" ? "ap" : "telangana";

  const images = IMAGE_SETS[key] || IMAGE_SETS.default;
  return images[index % images.length];
}

function imageSearchQuery(title, cat, district) {
  if (district) {
    const state = cat === "ap" ? "Andhra Pradesh" : "Telangana";
    return `${district} ${state} city photo`;
  }

  const text = `${title} ${cat}`.toLowerCase();
  const asciiWords = String(title).match(/[a-z][a-z0-9-]{3,}/gi)?.slice(0, 4).join(" ");
  if (asciiWords && !/telangana|andhra|pradesh|news|update|states/i.test(asciiWords)) return `${asciiWords} India`;
  if (/yoga|యోగ/.test(text)) return "yoga competition India";
  if (/bus|rtc|depot|బస్సు|డిపో|ఆర్టీసీ/.test(text)) return "public bus transport India";
  if (/forest|tribal|గిరిజన|అటవీ|ఫారెస్ట్/.test(text)) return "tribal forest India";
  if (/cabinet|కేబినెట్|secretariat|సచివాలయ/.test(text)) return cat === "ap" ? "Andhra Pradesh government secretariat" : "Telangana government secretariat";
  if (/court|judge|కోర్టు|న్యాయ/.test(text)) return "court building India";
  if (/police|arrest|crime|పోలీస్|అరెస్ట్|నేరం/.test(text)) return "police India";
  if (/cricket|ipl|sports|క్రికెట్|క్రీడ/.test(text)) return "cricket stadium India";
  if (/cinema|movie|film|సినిమా|బాక్సాఫీస్/.test(text)) return "Telugu cinema";
  if (/school|education|results|గురుకుల|పాఠశాల|విద్య/.test(text)) return "school education India";
  if (/farmer|maize|procurement|రైతు|పంట|వ్యవసాయ/.test(text)) return "Indian farmers agriculture";
  if (/market|business|stock|economy|మార్కెట్|వ్యాపార/.test(text)) return "Indian stock market business";
  if (/tech|ai|mobile|technology|టెక్నాలజీ|మొబైల్/.test(text)) return "artificial intelligence technology India";
  if (/heatwave|weather|rain|cyclone|వాతావరణ|ఉష్ణోగ్రత|వర్ష|ఎండ/.test(text)) return "India heatwave weather";
  if (/traffic|metro|road|accident|ట్రాఫిక్|రోడ్డు|ప్రమాద/.test(text)) return "Hyderabad traffic metro";
  if (/scheme|ప్రణాళిక|పథకం|నిధులు|ప్రభుత్వ/.test(text)) return "Telangana government building";
  if (cat === "telangana") return "Hyderabad Telangana";
  if (cat === "ap") return "Amaravati Andhra Pradesh";
  if (cat === "politics" || cat === "national") return "Parliament of India";
  if (cat === "international") return "United Nations General Assembly";
  return "news media India";
}

function commonsLicenseOk(imageInfo = {}) {
  const metadata = imageInfo.extmetadata || {};
  const license = String(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || "").toLowerCase();
  return /cc|creative commons|public domain|pd|own work/.test(license);
}

function commonsPhotoOk(page = {}, query = "") {
  const info = page.imageinfo?.[0] || {};
  const title = String(page.title || "").toLowerCase();
  const search = String(query || "").toLowerCase();
  const wrongRegion = /telangana|andhra|hyderabad|amaravati/.test(search)
    && /tamil nadu|kerala|maharashtra|rajasthan|punjab|bengal|assam/i.test(title);
  return info?.mime?.startsWith("image/")
    && info.mime !== "image/svg+xml"
    && !wrongRegion
    && !/map|locator|flag|logo|emblem|icon|seal|symbol|blank|chart|graph|result|results|diagram/i.test(title)
    && commonsLicenseOk(info);
}

function commonsMetadata(info = {}) {
  const metadata = info.extmetadata || {};
  const value = key => cleanText(metadata[key]?.value || "");
  return {
    photographer: value("Artist"),
    copyrightOwner: value("Credit") || value("Artist"),
    license: value("LicenseShortName") || value("UsageTerms"),
    attributionRequired: !/public domain|cc0|pd/i.test(`${value("LicenseShortName")} ${value("UsageTerms")}`),
    originalUrl: info.descriptionurl || info.url || ""
  };
}

function candidateRelevance(page = {}, intent = {}, query = "") {
  const haystack = `${page.title || ""} ${page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value || ""}`.toLowerCase();
  const queryTokens = String(query).toLowerCase().match(/[a-z]{4,}/g) || [];
  const tokens = [...(intent.entities || []), ...(intent.event || []), intent.location, intent.category]
    .filter(Boolean)
    .map(value => String(value).toLowerCase());
  const matches = tokens.filter(token => haystack.includes(token)).length;
  const entityMatch = (intent.entities || []).some(entity => haystack.includes(String(entity).toLowerCase()));
  const eventMatch = (intent.event || []).some(event => haystack.includes(String(event).toLowerCase()));
  const locationMatch = intent.location && haystack.includes(String(intent.location).toLowerCase());
  const queryMatches = [...new Set(queryTokens)].filter(token => haystack.includes(token)).length;
  return Math.min(88, 48 + matches * 8 + queryMatches * 5 + (entityMatch ? 10 : 0) + (eventMatch ? 8 : 0) + (locationMatch ? 8 : 0));
}

async function commonsImage(query, intent = {}) {
  const key = query.toLowerCase();
  if (IMAGE_CACHE[key] && Date.now() - IMAGE_CACHE[key].time < IMAGE_TTL) {
    return IMAGE_CACHE[key].decision;
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "800"
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { "User-Agent": "NewsNeta/1.0 (+https://newsneta.com)" }
    });
    if (!response.ok) return brandedFallbackDecision(intent, `Approved image search failed with ${response.status}`);

    const payload = await response.json();
    const pages = Object.values(payload.query?.pages || {});
    const ranked = pages
      .filter(page => commonsPhotoOk(page, query))
      .map(page => ({page, score: candidateRelevance(page, intent, query)}))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < AUTO_IMAGE_THRESHOLD) {
      return brandedFallbackDecision(intent, "Approved-source candidates were below the automatic relevance threshold");
    }
    const info = best.page.imageinfo?.[0] || {};
    const decision = mediaDecision({
      url: info.thumburl || info.url || null,
      source: "Wikimedia Commons",
      imageType: "archive",
      label: "FILE PHOTO",
      score: best.score,
      intent,
      reasons: ["Matched an approved reusable-media source", "Archive image is labelled to avoid implying a current-event photograph"],
      ...commonsMetadata(info)
    });
    IMAGE_CACHE[key] = { time: Date.now(), decision };
    return decision;
  } catch (error) {
    return brandedFallbackDecision(intent, "Approved image search was unavailable");
  }
}

function trustedImageUrl(url = "") {
  return /^https:\/\/[^/]+/i.test(url)
    && !/logo|sprite|placeholder|icon/i.test(url)
    && !/lh3\.googleusercontent\.com\/J6_coFbog/i.test(url)
    && !/s0-w300/i.test(url);
}

function extractMetaImages(html = "") {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
  ];
  const images = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      if (match?.[1]) images.push(match[1].replace(/&amp;/g, "&"));
    }
  }
  const imageSrc = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)/i)?.[1];
  if (imageSrc) images.push(imageSrc.replace(/&amp;/g, "&"));
  return [...new Set(images)];
}

function feedAssociatedMedia(item, cat, district) {
  const title = publicTitle(item.title);
  const intent = extractImageIntent(title, cat, district, item.contentSnippet || item.content || item.summary);
  const feedImage = item.enclosure?.url || item.enclosure?.link || item.media?.content?.url || item.media?.thumbnail?.url || "";
  if (!trustedImageUrl(feedImage)) {
    return brandedFallbackDecision(intent, "The feed did not supply an article-associated licensed image");
  }
  return mediaDecision({
    url: feedImage,
    originalUrl: feedImage,
    source: "Article feed",
    copyrightOwner: "Article publisher",
    license: "Publisher-associated editorial image; verify syndication terms",
    imageType: "event_candidate",
    score: 86,
    intent,
    reasons: ["Image was supplied in the same RSS article record"]
  });
}

async function articleImage(item, cat, district) {
  const associated = feedAssociatedMedia(item, cat, district);
  if (associated.url) return associated;

  const title = publicTitle(item.title);
  const intent = extractImageIntent(title, cat, district, item.contentSnippet || item.content || item.summary);
  return brandedFallbackDecision(intent, "The feed did not provide an image associated with this exact article");
}

function mergeCanonicalArticles(primary = [], secondary = []) {
  const seen = new Set();
  return [...primary, ...secondary].filter(article => {
    const identity = String(article.id || article.link || article.title || "").toLowerCase();
    if (!identity || seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function approvedPersistedImage(row = {}) {
  const media = row.featured_media && typeof row.featured_media === "object" ? row.featured_media : null;
  const imageType = String(media?.imageType || media?.image_type || "").toLowerCase();
  const score = Number(media?.relevanceScore ?? media?.relevance_score ?? 0);
  const newsroomOwned = !String(row.author_id || "").startsWith("feed:");
  const mediaUrl = media?.publicUrl || media?.public_url || media?.url || null;
  if (newsroomOwned) {
    if (media && !["cms_approved", "cms_upload", "uploaded"].includes(imageType)) return null;
    return trustedImageUrl(mediaUrl || row.image_url) ? (mediaUrl || row.image_url) : null;
  }
  if (!media || media.requiresReview === true || ["archive", "representative", "branded_fallback", "missing"].includes(imageType)) return null;
  if (score < 80 || !["event_candidate", "event_photo", "uploaded", "cms_upload"].includes(imageType)) return null;
  return trustedImageUrl(mediaUrl || row.image_url) ? (mediaUrl || row.image_url) : null;
}

function persistedArticleFromRow(row = {}) {
  const featuredIsVideo = String(row.featured_media?.mimeType || row.featured_media?.mime_type || "").startsWith("video/");
  const featuredUrl = row.featured_media?.url || row.featured_media?.publicUrl || row.featured_media?.public_url || null;
  const featuredThumbnail = row.featured_media?.thumbnailUrl || row.featured_media?.thumbnail_url || row.thumbnail_url || null;
  const approvedImage = featuredIsVideo ? featuredThumbnail : approvedPersistedImage(row);
  return {
    id: row.id,
    headline: row.title,
    title: row.title,
    summary: row.summary || "",
    description: row.summary || "",
    body: row.body || "",
    fullArticle: row.content_status === "brief" ? "" : (row.body || ""),
    contentStatus: row.content_status || "brief",
    category: row.category,
    state: row.state,
    district: row.district,
    image: approvedImage,
    imageUrl: approvedImage,
    thumbnailUrl: featuredThumbnail,
    video: featuredIsVideo && featuredUrl ? { type: "uploaded", url: featuredUrl, mimeType: row.featured_media.mimeType || row.featured_media.mime_type, posterUrl: featuredThumbnail || row.image_url || null } : null,
    media: row.featured_media ? [row.featured_media] : [],
    mediaDecision: row.featured_media || null,
    featuredMedia: row.featured_media || null,
    link: row.source_url || `?article=${encodeURIComponent(row.id)}`,
    source: row.source_name || "NewsNeta",
    sourceName: row.source_name || "NewsNeta",
    pubDate: row.source_published_at || row.published_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    sourceUrl: row.source_url || null,
    imageAlt: row.image_alt || "",
    authorId: row.author_id || null,
    views: row.views || 0,
    contentRevision: row.content_revision || 1,
    fullContentReviewRequired: Boolean(row.full_content_review_required),
    fullContentReviewReason: row.full_content_review_reason || null,
    persisted: true
  };
}

async function persistedArticleById(id, getDatabase) {
  const identity = cleanText(id).slice(0, 500);
  if (!identity) return null;
  const { pool } = getDatabase();
  const result = await pool.query({
    text: `SELECT id, title, summary, body, category, state, district, image_url,
      thumbnail_url, featured_media, source_url, source_name, published_at,
      source_published_at, updated_at, views, content_revision, content_status, image_alt, author_id,
      full_content_review_required, full_content_review_reason FROM articles
      WHERE status='published' AND (id::text=$1 OR source_article_id=$1)
      ORDER BY updated_at DESC LIMIT 1`,
    values: [identity]
  });
  return result.rows[0] ? persistedArticleFromRow(result.rows[0]) : null;
}

async function persistedArticles(cat, district, limit = 24, getDatabase) {
  try {
    const { pool } = getDatabase();
    const values = [cat, limit];
    let districtClause = "";
    if (district) {
      values.splice(1, 0, district);
      districtClause = " AND lower(district) = lower($2)";
    }
    const limitIndex = district ? 3 : 2;
    const result = await pool.query({
      text: `SELECT id, title, summary, body, category, state, district, image_url,
        thumbnail_url, featured_media, source_url, source_name, published_at,
        source_published_at, updated_at, views, content_revision, content_status, image_alt, author_id,
        full_content_review_required, full_content_review_reason FROM articles
        WHERE status='published' AND ($1='latest' OR category=$1)${districtClause}
          AND published_at >= now() - interval '3 days'
        ORDER BY published_at DESC LIMIT $${limitIndex}`,
      values
    });
    const articles = result.rows.map(persistedArticleFromRow);
    return freshSorted(articles, FRESH_NEWS_DAYS).slice(0, limit);
  } catch (error) {
    logEvent("NEWS_DATABASE_READ_FAILED", { category: cat, district: district || null, message: error.message });
    return [];
  }
}

exports.handler = async function handler(event, getDatabase) {
  const params = event.queryStringParameters || {};
  const articleId = cleanText(params.article || params.id || "").slice(0, 500);
  if (articleId) {
    try {
      const item = await persistedArticleById(articleId, getDatabase);
      if (!item) return json(404, { status: "not-found", message: "The published article is unavailable." }, 0);
      return json(200, { status: "ok", item, servedAt: new Date().toISOString() }, 0);
    } catch (error) {
      logEvent("NEWS_ARTICLE_READ_FAILED", { articleId, message: error.message });
      return json(503, { status: "database-unavailable", message: "The article could not be loaded. Please retry." }, 0);
    }
  }
  const cat = normalizeCategory(params.cat || params.category || "telangana");
  const district = cleanText(params.district || "");
  const forceRefresh = Boolean(params.refresh || params.force);
  const ingestionMode = params.ingest === "1";
  const cacheKey = district ? `${cat}:${district.toLowerCase()}` : cat;
  const feedUrl = feedFor(cat, district);

  if (!forceRefresh && CACHE[cacheKey] && Date.now() - CACHE[cacheKey].time < TTL) {
    return json(200, {
      ...CACHE[cacheKey].data,
      cache: "memory",
      servedAt: new Date().toISOString()
    });
  }

  const persisted = await persistedArticles(cat, district, 24, getDatabase);
  if (!ingestionMode && !forceRefresh && persisted.length) {
    const data = {
      status: "ok",
      provider: "newsneta-database",
      category: cat,
      district: district || null,
      freshnessWindowDays: FRESH_NEWS_DAYS,
      updatedAt: new Date().toISOString(),
      items: persisted
    };
    CACHE[cacheKey] = { time: Date.now(), data };
    return json(200, { ...data, cache: "database", servedAt: new Date().toISOString() });
  }

  try {
    let licensedItems = null;
    try {
      licensedItems = await fetchGNewsItems(cat, district);
    } catch (error) {
      logEvent("NEWS_PROVIDER_FAILED", {
        provider: "gnews",
        category: cat,
        district: district || null,
        message: error instanceof Error ? error.message : "Licensed news provider request failed"
      });
    }
    if (licensedItems) {
      const data = {
        status: "ok",
        provider: "licensed-news-api",
        category: cat,
        district: district || null,
        freshnessWindowDays: FRESH_NEWS_DAYS,
        updatedAt: new Date().toISOString(),
        items: mergeCanonicalArticles(licensedItems, persisted).slice(0, 24)
      };
      CACHE[cacheKey] = { time: Date.now(), data };
      return json(200, {...data, cache: forceRefresh ? "bypass" : "fresh", servedAt: new Date().toISOString()});
    }

    const feed = await parser.parseURL(feedUrl);
    const rawItems = freshSorted(feed.items).slice(0, 24);
    if (!rawItems.length) {
      const data = {
        status: "stale-filtered",
        provider: "rss-plus-licensed-photo-api",
        category: cat,
        district: district || null,
        freshnessWindowDays: FRESH_NEWS_DAYS,
        updatedAt: new Date().toISOString(),
        items: persisted
      };
      CACHE[cacheKey] = { time: Date.now(), data };
      return json(200, {...data, cache: forceRefresh ? "bypass" : "fresh", servedAt: new Date().toISOString()});
    }
    // Google News RSS does not normally expose enclosures. Scheduled ingestion
    // must therefore use the same rights-aware resolver as a live request;
    // otherwise text-only rows become authoritative and suppress valid media.
    const imageResults = await mapWithConcurrency(rawItems, ingestionMode ? 4 : 5, (item, index) => articleImage(item, cat, district, index));
    const items = rawItems.map((item, index) => {
      const title = publicTitle(item.title);
      const description = expandedNewsDescription(title, cat, district, item.contentSnippet || item.content || item.summary);
      const sourceName = publisherFromItem(item);
      const content = classifyProviderContent({ sourceName, title, summary: description, body: item.contentEncoded || "" });
      return {
        id: item.guid || item.link || `${cat}-${index}`,
        headline: title,
        title,
        link: item.link,
        pubDate: item.pubDate || item.isoDate,
        desk: "NewsNeta",
        source: sourceName,
        category: district || CATEGORY_LABELS[cat] || "Telugu",
        district: district || null,
        state: cat === "ap" ? "Andhra Pradesh" : cat === "telangana" ? "Telangana" : null,
        image: imageResults[index].url,
        imageUrl: imageResults[index].url,
        video: null,
        media: imageResults[index],
        imageLabel: imageResults[index].label,
        imageRelevanceScore: imageResults[index].relevanceScore,
        imageStatus: imageResults[index].visualStatus,
        views: null,
        trust: null,
        sentiment: null,
        description,
        summary: description,
        body: content.body,
        fullArticle: content.body,
        aiSummary: description,
        contentStatus: content.contentStatus,
        fullContentReviewRequired: content.fullContentReviewRequired,
        fullContentReviewReason: content.fullContentReviewReason,
        sourceUrl: item.link || null,
        publishedAt: item.pubDate || item.isoDate,
        updatedAt: item.pubDate || item.isoDate
      };
    });

    const data = {
      status: "ok",
      provider: "rss-plus-licensed-photo-api",
      category: cat,
      district: district || null,
      freshnessWindowDays: FRESH_NEWS_DAYS,
      updatedAt: new Date().toISOString(),
      items: mergeCanonicalArticles(items, persisted).slice(0, 24)
    };

    CACHE[cacheKey] = { time: Date.now(), data };
    return json(200, {...data, cache: forceRefresh ? "bypass" : "fresh", servedAt: new Date().toISOString()});
  } catch (error) {
    logEvent("NEWS_FETCH_FAILED", {
      category: cat,
      district: district || null,
      endpoint: feedUrl,
      message: String(error.message || error)
    });
    if (persisted.length) {
      return json(200, { status: "stale", provider: "newsneta-database", category: cat, district: district || null, items: persisted, cache: "database-fallback", servedAt: new Date().toISOString() }, 30);
    }
    const stale = CACHE[cacheKey]?.data;
    if (stale?.items?.length) {
      return json(200, {
        ...stale,
        status: "stale",
        cache: "stale-if-error",
        servedAt: new Date().toISOString()
      }, 30);
    }
    return json(200, {
      status: "fallback",
      category: cat,
      district: district || null,
      updatedAt: new Date().toISOString(),
      servedAt: new Date().toISOString(),
      freshnessWindowDays: FRESH_NEWS_DAYS,
      cache: forceRefresh ? "bypass-fallback" : "fallback",
      items: [],
      error: String(error.message || error)
    }, forceRefresh ? 0 : 60);
  }
};

exports._test = { approvedPersistedImage, articleImage, brandedFallbackDecision, classifyProviderContent, feedAssociatedMedia, freshSorted, imageSearchQuery, normalizeCategory, normalizeLicensedBody, persistedArticleFromRow, trustedImageUrl };
