const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h

// Simple in-memory cache to start; swap for Redis later
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function normalizeUrl(u) {
  const url = new URL(u);
  // strip common tracking params
  const strip = [
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'gclid','fbclid','igshid'
  ];
  strip.forEach(p => url.searchParams.delete(p));
  return url.toString();
}

// Minimal SSRF guard (add stronger DNS/IP checks if you can)
function assertSafeUrl(u) {
  const url = new URL(u);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('Blocked host');
  // NOTE: For robust SSRF defense, also resolve DNS and block private IP ranges.
}

async function fetchHtml(url, { timeoutMs = 8000, maxBytes = 1_500_000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    redirect: 'follow',
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FeedEnricher/1.0; +https://yourdomain.example)',
      'Accept': 'text/html,application/xhtml+xml',
    }
  }).finally(() => clearTimeout(t));

  const ctype = res.headers.get('content-type') || '';
  if (!ctype.includes('text/html') && !ctype.includes('application/xhtml+xml')) {
    return { finalUrl: res.url, html: null, contentType: ctype };
  }

  // Cap bytes: stream + stop early
  const reader = res.body.getReader();
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
  return { finalUrl: res.url, html, contentType: ctype };
}

function getMeta(doc, selector) {
  const el = doc.querySelector(selector);
  return el?.getAttribute('content') || el?.getAttribute('href') || null;
}

function extractOg(doc) {
  const og = {
    title: getMeta(doc, 'meta[property="og:title"]') || getMeta(doc, 'meta[name="twitter:title"]'),
    description: getMeta(doc, 'meta[property="og:description"]') || getMeta(doc, 'meta[name="description"]') || getMeta(doc, 'meta[name="twitter:description"]'),
    image: getMeta(doc, 'meta[property="og:image"]') || getMeta(doc, 'meta[name="twitter:image"]'),
    siteName: getMeta(doc, 'meta[property="og:site_name"]'),
  };
  return og;
}

function extractCanonical(doc) {
  return getMeta(doc, 'link[rel="canonical"]');
}

function extractFavicon(doc, baseUrl) {
  const href =
    getMeta(doc, 'link[rel="icon"]') ||
    getMeta(doc, 'link[rel="shortcut icon"]') ||
    getMeta(doc, 'link[rel="apple-touch-icon"]');

  if (!href) {
    // fallback
    const domain = new URL(baseUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  }
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractJsonLd(doc) {
  const nodes = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const parsed = [];
  for (const n of nodes) {
    try {
      const json = JSON.parse(n.textContent.trim());
      parsed.push(json);
    } catch {}
  }

  // Find best NewsArticle-like object
  const flat = parsed.flatMap(x => (Array.isArray(x) ? x : [x]))
    .flatMap(x => (x && x['@graph'] ? x['@graph'] : [x]))
    .filter(Boolean);

  const article = flat.find(x => {
    const t = x['@type'];
    return t === 'NewsArticle' || t === 'Article' || (Array.isArray(t) && (t.includes('NewsArticle') || t.includes('Article')));
  });

  if (!article) return null;

  return {
    headline: article.headline || null,
    description: article.description || null,
    datePublished: article.datePublished || null,
    dateModified: article.dateModified || null,
    author: Array.isArray(article.author)
      ? article.author.map(a => a?.name).filter(Boolean)
      : (article.author?.name ? [article.author.name] : []),
    section: article.articleSection || null,
    keywords: Array.isArray(article.keywords)
      ? article.keywords
      : (typeof article.keywords === 'string'
          ? article.keywords.split(',').map(s => s.trim()).filter(Boolean)
          : []),
    image: Array.isArray(article.image) ? article.image[0] : (article.image?.url || article.image || null),
  };
}

function stableKey(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

async function enrichUrl(rawUrl, mode = 'light') {
  assertSafeUrl(rawUrl);
  const normalized = normalizeUrl(rawUrl);
  const key = stableKey(normalized);

  const cached = cacheGet(key);
  if (cached) return cached;

  const { finalUrl, html } = await fetchHtml(normalized);
  if (!html) {
    const minimal = { url: normalized, finalUrl, normalizedUrl: normalized, mode, ok: false };
    cacheSet(key, minimal, 10 * 60 * 1000);
    return minimal;
  }

  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  const canonical = extractCanonical(doc);
  const og = extractOg(doc);
  const jsonld = extractJsonLd(doc);
  const favicon = extractFavicon(doc, finalUrl);

  // If canonical differs, you can re-key + cache under canonical too (optional)
  const result = {
    ok: true,
    inputUrl: rawUrl,
    normalizedUrl: normalized,
    finalUrl,
    canonicalUrl: canonical ? new URL(canonical, finalUrl).toString() : null,
    og,
    jsonld,
    favicon,
  };

  // If mode === 'full', add readability extraction here (optional)
  // - excerpt, wordCount, readTimeMinutes

  cacheSet(key, result);
  return result;
}

module.exports = { enrichUrl };
