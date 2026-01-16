// src/services/googleNewsService.js
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const { fetch } = require('undici');
const crypto = require('crypto');

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['enclosure', 'enclosure'],
      ['source', 'source'],
      ['guid', 'guid'],
      ['content:encoded', 'contentEncoded'],
    ],
    feed: [['image', 'feedImage']],
  },
});

/** ---------------------------
 *  Enrichment cache (in-memory)
 *  Swap to Redis later.
 *  --------------------------*/
const ENRICH_TTL_MS = 60 * 60 * 1000; // 1 hour
const NEGATIVE_TTL_MS = 10 * 60 * 1000; // 10 min
const enrichCache = new Map(); // key -> { expiresAt, value }

function cacheGet(key) {
  const hit = enrichCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    enrichCache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value, ttlMs) {
  enrichCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function shaKey(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/** ---------------------------
 *  URL safety / normalization
 *  --------------------------*/
function normalizeUrl(raw) {
  const u = new URL(raw);
  // strip common tracking params
  [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'igshid',
  ].forEach((p) => u.searchParams.delete(p));
  return u.toString();
}

function assertSafeUrl(raw) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error(`Blocked protocol: ${u.protocol}`);
  }
  const host = u.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '127.0.0.1'
  ) {
    throw new Error('Blocked host');
  }
  // NOTE: For strong SSRF protection, also resolve DNS and block private IP ranges.
}

/** ---------------------------
 *  Google News RSS URL builder
 *  --------------------------*/
function buildGoogleNewsRssUrl({ region = 'US', category, topic }) {
  const upperRegion = String(region || 'US').toUpperCase();
  const hl = `en-${upperRegion}`;
  const gl = upperRegion;
  const ceid = `${upperRegion}:en`;

  if (topic) {
    const encoded = encodeURIComponent(topic);
    return `https://news.google.com/rss/search?q=${encoded}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  }

  if (!category) {
    return `https://news.google.com/rss?hl=${hl}&gl=${gl}&ceid=${ceid}`;
  }

  const topicMap = {
    world: 'WORLD',
    nation: 'NATION',
    business: 'BUSINESS',
    technology: 'TECHNOLOGY',
    entertainment: 'ENTERTAINMENT',
    science: 'SCIENCE',
    sports: 'SPORTS',
    health: 'HEALTH',
  };

  const code =
    topicMap[String(category).toLowerCase()] ||
    String(category).toUpperCase();

  return `https://news.google.com/rss/headlines/section/topic/${code}?hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/** ---------------------------
 *  Concurrency runner
 *  --------------------------*/
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  let inFlight = 0;

  return new Promise((resolve) => {
    const next = () => {
      if (i >= items.length && inFlight === 0) return resolve(results);

      while (inFlight < limit && i < items.length) {
        const idx = i++;
        inFlight++;
        Promise.resolve(worker(items[idx], idx))
          .then((val) => {
            results[idx] = val;
          })
          .catch((err) => {
            results[idx] = { error: err?.message || String(err) };
          })
          .finally(() => {
            inFlight--;
            next();
          });
      }
    };
    next();
  });
}

/** ---------------------------
 *  RSS helpers
 *  --------------------------*/
function pickImageUrlFromRSS(item) {
  const mc = item.mediaContent;
  if (Array.isArray(mc)) {
    for (const m of mc) {
      const attrs = m?.$ || m;
      if (attrs?.url) return attrs.url;
      if (Array.isArray(m)) {
        for (const mm of m) {
          const a = mm?.$ || mm;
          if (a?.url) return a.url;
        }
      }
    }
  }

  const mt = item.mediaThumbnail;
  if (Array.isArray(mt)) {
    for (const t of mt) {
      const attrs = t?.$ || t;
      if (attrs?.url) return attrs.url;
    }
  }

  if (item.enclosure?.url) return item.enclosure.url;

  const blob = [
    item.contentEncoded,
    item.content,
    item.contentSnippet,
    item.description,
  ]
    .filter(Boolean)
    .join('\n');

  const m = blob.match(/https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp)/i);
  if (m) return m[0];

  return null;
}

function extractSummaryFromGoogleDescription(descHtml) {
  if (!descHtml) return null;
  try {
    const $ = cheerio.load(descHtml);
    const firstLi = $('li').first();
    if (!firstLi.length) return null;
    const headline = firstLi.find('a').first().text().trim();
    const source = firstLi.find('font').first().text().trim();
    return headline || (source ? `From ${source}` : null);
  } catch {
    return null;
  }
}

/** ---------------------------
 *  HTML fetch with limits
 *  --------------------------*/
async function fetchHtml(url, { timeoutMs = 8000, maxBytes = 1_500_000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; NewsIngest/2.0; +https://example.com/bot)',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const finalUrl = res.url || url;
    const contentType = res.headers.get('content-type') || '';

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { finalUrl, contentType, html: null };
    }

    // Stream and cap size
    const reader = res.body?.getReader?.();
    if (!reader) {
      // fallback
      const htmlText = await res.text();
      return { finalUrl, contentType, html: htmlText.slice(0, maxBytes) };
    }

    let received = 0;
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) break;
      chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString('utf-8');
    return { finalUrl, contentType, html };
  } finally {
    clearTimeout(t);
  }
}

/** ---------------------------
 *  Meta extraction (OG/canonical/favicon/JSON-LD)
 *  --------------------------*/
function extractOg($) {
  const ogImageURL =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('meta[property="og:image:secure_url"]').attr('content') ||
    null;

  const ogTitle =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('title').text()?.trim() ||
    null;

  const ogDescription =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    null;

  const ogSiteName =
    $('meta[property="og:site_name"]').attr('content') ||
    null;

  return { ogImageURL, ogTitle, ogDescription, ogSiteName };
}

function extractCanonical($, baseUrl) {
  const c = $('link[rel="canonical"]').attr('href') || null;
  if (!c) return null;
  try {
    return new URL(c, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractFavicon($, baseUrl) {
  const href =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href') ||
    null;

  if (!href) {
    const domain = new URL(baseUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function coerceArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function extractJsonLd($) {
  const scripts = $('script[type="application/ld+json"]');
  if (!scripts.length) return null;

  const blobs = [];
  scripts.each((_, el) => {
    const txt = $(el).text();
    if (txt && txt.trim()) blobs.push(txt.trim());
  });

  const parsed = [];
  for (const b of blobs) {
    try {
      parsed.push(JSON.parse(b));
    } catch {
      // ignore invalid JSON-LD
    }
  }

  const flatten = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.flatMap(flatten);
    if (obj['@graph']) return flatten(obj['@graph']);
    return [obj];
  };

  const all = parsed.flatMap(flatten).filter(Boolean);

  const isArticleType = (t) => {
    if (!t) return false;
    if (typeof t === 'string') return t === 'NewsArticle' || t === 'Article';
    if (Array.isArray(t)) return t.includes('NewsArticle') || t.includes('Article');
    return false;
  };

  const article = all.find((x) => isArticleType(x['@type']));
  if (!article) return null;

  const authors = coerceArray(article.author)
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);

  const keywords = Array.isArray(article.keywords)
    ? article.keywords
    : (typeof article.keywords === 'string'
      ? article.keywords.split(',').map((s) => s.trim()).filter(Boolean)
      : []);

  const image =
    Array.isArray(article.image) ? article.image[0] :
    (article.image?.url || article.image || null);

  return {
    headline: article.headline || null,
    description: article.description || null,
    datePublished: article.datePublished || null,
    dateModified: article.dateModified || null,
    authors,
    section: article.articleSection || null,
    keywords,
    image: image || null,
  };
}

/** ---------------------------
 *  Enrich a URL: resolve + meta scrape + cache
 *  --------------------------*/
async function enrichUrl(googleRedirectUrl, enrichLevel = 'light') {
  if (enrichLevel === 'none') {
    return { resolvedLink: null };
  }

  assertSafeUrl(googleRedirectUrl);

  // Cache by normalized redirect URL first (good enough). If you want, you can also cache by canonical later.
  const normalizedInput = normalizeUrl(googleRedirectUrl);
  const cacheKey = shaKey(normalizedInput + '::' + enrichLevel);
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const { finalUrl, html } = await fetchHtml(normalizedInput, {
      timeoutMs: 8000,
      maxBytes: enrichLevel === 'full' ? 2_500_000 : 1_500_000,
    });

    if (!html) {
      const minimal = { resolvedLink: finalUrl, canonicalLink: null, normalizedLink: normalizeUrl(finalUrl), meta: null };
      cacheSet(cacheKey, minimal, NEGATIVE_TTL_MS);
      return minimal;
    }

    const $ = cheerio.load(html);

    const { ogImageURL, ogTitle, ogDescription, ogSiteName } = extractOg($);
    const canonicalLink = extractCanonical($, finalUrl);
    const normalizedLink = normalizeUrl(canonicalLink || finalUrl);
    const favicon = extractFavicon($, finalUrl);
    const jsonld = extractJsonLd($);

    // “full” is where you’d add readability extraction if you want later.
    // For now, we keep "full" same as light but allow bigger HTML cap.

    const result = {
      resolvedLink: finalUrl,
      canonicalLink,
      normalizedLink,
      favicon,
      meta: {
        ogImageURL,
        ogTitle,
        ogDescription,
        ogSiteName,
      },
      jsonld, // may be null
    };

    cacheSet(cacheKey, result, ENRICH_TTL_MS);
    return result;
  } catch (e) {
    const fail = { resolvedLink: null, error: e?.message || String(e) };
    cacheSet(cacheKey, fail, NEGATIVE_TTL_MS);
    return fail;
  }
}

/** ---------------------------
 *  Main fetch + enrich
 *  --------------------------*/
async function fetchNews({ region, category, topic, enrich = 'light' }) {
  const enrichLevel = (enrich || 'light').toLowerCase(); // none|light|full
  const url = buildGoogleNewsRssUrl({ region, category, topic });
  const feed = await parser.parseURL(url);

  const now = new Date();
  const regionUpper = String(region || 'US').toUpperCase();
  const categoryNorm = category ? String(category).toLowerCase() : null;
  const topicNorm = topic || null;

  const baseItems =
    (feed.items || [])
      .map((item) => {
        let sourceName = null;
        let sourceUrl = null;
        if (item.source) {
          if (typeof item.source === 'string') {
            sourceName = item.source;
          } else if (item.source?._ || item.source?.$) {
            sourceName = (item.source._ || '').trim() || null;
            sourceUrl = item.source.$?.url || null;
          }
        }

        const imageFromRSS = pickImageUrlFromRSS(item);
        const shortSummary = extractSummaryFromGoogleDescription(item.description);

        return {
          title: item.title || null,
          link: item.link || null, // Google News redirect
          description: item.contentSnippet || shortSummary || null,
          rawDescriptionHtml: item.description || null,
          imageURL: imageFromRSS,
          pubDate: item.isoDate
            ? new Date(item.isoDate)
            : item.pubDate
              ? new Date(item.pubDate)
              : null,
          guid: item.guid || null,
          sourceName,
          sourceUrl,
          region: regionUpper,
          category: categoryNorm,
          topic: topicNorm,
          fetchedAt: now,
          _raw: { feedTitle: feed.title || null },
        };
      })
      .filter((x) => x.link);

  const enrichedItems = await mapWithConcurrency(
    baseItems,
    5,
    async (doc) => {
      if (enrichLevel === 'none') return doc;

      const enriched = await enrichUrl(doc.link, enrichLevel);

      if (enriched?.resolvedLink) doc.resolvedLink = enriched.resolvedLink;
      if (enriched?.canonicalLink) doc.canonicalLink = enriched.canonicalLink;
      if (enriched?.normalizedLink) doc.normalizedLink = enriched.normalizedLink;
      if (enriched?.favicon) doc.favicon = enriched.favicon;

      // Prefer OG image if RSS didn’t have one
      const og = enriched?.meta;
      if (!doc.imageURL && og?.ogImageURL) doc.imageURL = og.ogImageURL;

      // Improve title/description from OG where needed
      if ((!doc.title || doc.title.length < 5) && og?.ogTitle) doc.title = og.ogTitle;
      if ((!doc.description || doc.description.length < 20) && og?.ogDescription) doc.description = og.ogDescription;

      // Pull extra context from JSON-LD if present
      const ld = enriched?.jsonld;
      if (ld) {
        doc.siteName = doc.siteName || og?.ogSiteName || null;
        doc.publishedAt = ld.datePublished ? new Date(ld.datePublished) : null;
        doc.modifiedAt = ld.dateModified ? new Date(ld.dateModified) : null;
        doc.authors = ld.authors || [];
        doc.section = ld.section || null;
        doc.keywords = ld.keywords || [];
        // If still no image, JSON-LD sometimes has one
        if (!doc.imageURL && ld.image) doc.imageURL = ld.image;
        // If description is still weak, JSON-LD can help
        if ((!doc.description || doc.description.length < 20) && ld.description) doc.description = ld.description;
      }

      return doc;
    }
  );

  return {
    feed: {
      title: feed.title || null,
      link: feed.link || null,
      description: feed.description || null,
      region: regionUpper,
      category: categoryNorm,
      topic: topicNorm,
      enrich: enrichLevel,
      fetchedAt: now,
    },
    items: enrichedItems,
  };
}

/**
 * Find a specific news item by guid or normalizedLink
 * Searches across the specified feed
 */
async function findItemById({ id, region, category, topic, enrich = 'light' }) {
  const { items } = await fetchNews({ region, category, topic, enrich });

  // Try to find by guid first, then by normalizedLink, then by link
  const item = items.find(
    (item) =>
      item.guid === id ||
      item.normalizedLink === id ||
      item.link === id ||
      item.canonicalLink === id ||
      item.resolvedLink === id
  );

  return item || null;
}

module.exports = {
  fetchNews,
  findItemById,
  buildGoogleNewsRssUrl,
};
