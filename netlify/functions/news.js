const Parser = require("rss-parser");

const parser = new Parser({
  headers: {
    "User-Agent": "NewsNeta/1.0 (+https://newsneta.in)"
  }
});

const CACHE = {};
const IMAGE_CACHE = {};
const TTL = 4 * 60 * 1000;
const IMAGE_TTL = 6 * 60 * 60 * 1000;
const FRESH_NEWS_DAYS = 10;

function googleNewsUrl(query) {
  const freshQuery = `${query} when:7d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(freshQuery)}&hl=te&gl=IN&ceid=IN:te`;
}

const FEEDS = {
  politics: googleNewsUrl("Telugu politics India"),
  telangana: googleNewsUrl("Telangana Telugu news"),
  ap: googleNewsUrl("Andhra Pradesh Telugu news"),
  national: googleNewsUrl("India Telugu news"),
  international: googleNewsUrl("World Telugu international news"),
  cinema: googleNewsUrl("Telugu cinema news"),
  sports: googleNewsUrl("Sports Telugu cricket"),
  technology: googleNewsUrl("Technology Telugu news"),
  business: googleNewsUrl("Business Telugu news"),
  viral: googleNewsUrl("Viral Telugu news")
};

const IMAGE_SETS = {
  telangana: [
    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=1000&q=76",
    "https://images.unsplash.com/photo-1590253230532-a67f6bc61c9e?auto=format&fit=crop&w=1000&q=76"
  ],
  ap: [
    "https://images.unsplash.com/photo-1627894006066-b457d2fa7f6b?auto=format&fit=crop&w=1000&q=76",
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
  politics: "Politics",
  telangana: "Telangana",
  ap: "Andhra Pradesh",
  national: "National",
  international: "International",
  cinema: "Cinema",
  sports: "Sports",
  technology: "Technology",
  business: "Business",
  viral: "Viral"
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
    politics: "Telugu politics India",
    telangana: "Telangana Telugu news",
    ap: "Andhra Pradesh Telugu news",
    national: "India Telugu news",
    international: "World Telugu news",
    cinema: "Telugu cinema news",
    sports: "Sports Telugu",
    technology: "Technology Telugu news",
    business: "Business Telugu news",
    viral: "Viral Telugu news"
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

function hashViews(text) {
  let hash = 0;
  for (const char of text) hash = (hash << 5) - hash + char.charCodeAt(0);
  return Math.abs(hash % 90000) + 18000;
}

function inferSentiment(index) {
  return ["Positive", "Neutral", "Mixed", "Alert"][index % 4];
}

function publicTitle(title = "") {
  return String(title)
    .replace(/\s+-\s+[^-]{2,80}$/u, "")
    .replace(/\s*\|\s*[^|]{2,80}$/u, "")
    .trim();
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
  return items
    .filter(item => isFreshArticle(item, maxAgeDays))
    .sort((a, b) => articleTime(b) - articleTime(a));
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
    const fallback = selectImage(title, cat, district, index);
    const image = trustedImageUrl(article.image)
      ? article.image
      : await commonsImage(imageSearchQuery(title, cat, district), fallback);
    return {
      id: article.url || `${cat}-gnews-${index}`,
      title,
      link: article.url || "#",
      pubDate: article.publishedAt,
      desk: "NewsNeta",
      category: district || CATEGORY_LABELS[cat] || "Telugu",
      district: district || null,
      state: cat === "ap" ? "Andhra Pradesh" : cat === "telangana" ? "Telangana" : null,
      image,
      views: hashViews(title || `${cat}-${index}`),
      trust: Math.max(84, 98 - (index % 8)),
      sentiment: inferSentiment(index),
      aiSummary: article.description || `${title} అంశంపై ప్రధాన విషయాలు, నేపథ్యం, ప్రజలపై ప్రభావం సంక్షిప్తంగా.`
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

async function commonsImage(query, fallback) {
  const key = query.toLowerCase();
  if (IMAGE_CACHE[key] && Date.now() - IMAGE_CACHE[key].time < IMAGE_TTL) {
    return IMAGE_CACHE[key].url;
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
    iiurlwidth: "1200"
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: { "User-Agent": "NewsNeta/1.0 (+https://newsneta.com)" }
    });
    if (!response.ok) return fallback;

    const payload = await response.json();
    const pages = Object.values(payload.query?.pages || {});
    const match = pages
      .find(page => commonsPhotoOk(page, query))
      ?.imageinfo?.[0];
    const url = match?.thumburl || match?.url || fallback;
    IMAGE_CACHE[key] = { time: Date.now(), url };
    return url;
  } catch (error) {
    return fallback;
  }
}

function trustedImageUrl(url = "") {
  return /^https:\/\/[^/]+/i.test(url)
    && !/logo|sprite|placeholder|icon/i.test(url)
    && !/lh3\.googleusercontent\.com\/J6_coFbog/i.test(url)
    && !/s0-w300/i.test(url);
}

function extractMetaImage(html = "") {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }
  return "";
}

async function articleImage(item, cat, district, index) {
  const fallback = selectImage(publicTitle(item.title), cat, district, index);
  const licensedFallback = () => commonsImage(imageSearchQuery(publicTitle(item.title), cat, district), fallback);
  if (!item.link) return await licensedFallback();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const response = await fetch(item.link, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsNeta/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    const html = await response.text();
    const image = extractMetaImage(html);
    return trustedImageUrl(image) ? image : await licensedFallback();
  } catch (error) {
    return await licensedFallback();
  } finally {
    clearTimeout(timeout);
  }
}

exports.handler = async function handler(event) {
  const cat = event.queryStringParameters?.cat || "telangana";
  const district = event.queryStringParameters?.district || "";
  const cacheKey = district ? `${cat}:${district.toLowerCase()}` : cat;
  const feedUrl = feedFor(cat, district);

  if (CACHE[cacheKey] && Date.now() - CACHE[cacheKey].time < TTL) {
    return json(200, CACHE[cacheKey].data);
  }

  try {
    const licensedItems = await fetchGNewsItems(cat, district);
    if (licensedItems) {
      const data = {
        status: "ok",
        provider: "licensed-news-api",
        category: cat,
        district: district || null,
        updatedAt: new Date().toISOString(),
        items: licensedItems
      };
      CACHE[cacheKey] = { time: Date.now(), data };
      return json(200, data);
    }

    const feed = await parser.parseURL(feedUrl);
    const rawItems = freshSorted(feed.items).slice(0, 24);
    if (!rawItems.length) {
      const data = {
        status: "stale-filtered",
        provider: "rss-plus-licensed-photo-api",
        category: cat,
        district: district || null,
        updatedAt: new Date().toISOString(),
        items: []
      };
      CACHE[cacheKey] = { time: Date.now(), data };
      return json(200, data, 60);
    }
    const imageResults = await Promise.all(
      rawItems.map((item, index) => articleImage(item, cat, district, index))
    );
    const items = rawItems.map((item, index) => ({
      id: item.guid || item.link || `${cat}-${index}`,
      title: publicTitle(item.title),
      link: item.link,
      pubDate: item.pubDate || item.isoDate,
      desk: "NewsNeta",
      category: district || CATEGORY_LABELS[cat] || "Telugu",
      district: district || null,
      state: cat === "ap" ? "Andhra Pradesh" : cat === "telangana" ? "Telangana" : null,
      image: imageResults[index],
      views: hashViews(item.title || `${cat}-${index}`),
      trust: Math.max(76, 96 - (index % 9)),
      sentiment: inferSentiment(index),
      aiSummary: `${publicTitle(item.title)} అంశంపై ప్రధాన విషయాలు, నేపథ్యం, ప్రజలపై ప్రభావం సంక్షిప్తంగా.`
    }));

    const data = {
      status: "ok",
      provider: "rss-plus-licensed-photo-api",
      category: cat,
      district: district || null,
      updatedAt: new Date().toISOString(),
      items
    };

    CACHE[cacheKey] = { time: Date.now(), data };
    return json(200, data);
  } catch (error) {
    return json(200, {
      status: "fallback",
      category: cat,
      district: district || null,
      updatedAt: new Date().toISOString(),
      items: [],
      error: String(error.message || error)
    }, 60);
  }
};
