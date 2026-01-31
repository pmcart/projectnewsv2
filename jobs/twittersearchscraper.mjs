// twittersearchscraper.mjs
// Scrape X (x.com) Live search results via GraphQL using an *already-open* Chrome.
// This version accepts a raw search term (no enrichment lookup required).
// Saves results into MongoDB.
//
// Usage:
//   node twittersearchscraper.mjs <searchTerm> [jobId]
//
// Env (optional):
//   CDP=http://127.0.0.1:9222
//   MONGO_URI=mongodb://127.0.0.1:27017
//   NAV_TIMEOUT_MS=45000
//   WAIT_FOR_GQL_MS=20000
//   EXTRA_SCROLLS=2
//   SCROLL_WAIT_MS=1200
//
// Requires:
//   npm i playwright mongodb
//
// Notes:
// - You must start Chrome with: --remote-debugging-port=9222
// - You must be logged into X in that Chrome profile/session.

import { chromium } from "playwright";
import { MongoClient } from "mongodb";

const CDP_ENDPOINT = process.env.CDP || "http://127.0.0.1:9222";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

const DB_NAME = "global";
const OUT_COLL = "breaking_news_search";

const NAV_TIMEOUT_MS = Number(process.env.NAV_TIMEOUT_MS || 45_000);
const WAIT_FOR_GQL_MS = Number(process.env.WAIT_FOR_GQL_MS || 20_000);

const EXTRA_SCROLLS = Number(process.env.EXTRA_SCROLLS || 2);
const SCROLL_WAIT_MS = Number(process.env.SCROLL_WAIT_MS || 1200);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function uniq(arr) {
  return [...new Set((arr || []).map((x) => String(x).trim()).filter(Boolean))];
}

function safeGet(obj, path, fallback = undefined) {
  let cur = obj;
  for (const p of path) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return fallback;
  }
  return cur;
}

function toLiveSearchUrl(q) {
  return `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;
}

function isSearchTimelineUrl(url) {
  return (
    typeof url === "string" &&
    url.includes("/i/api/graphql/") &&
    (url.includes("/SearchTimeline") || url.includes("SearchTimeline"))
  );
}

function looksJsonResponse(resp) {
  const ct = resp.headers()?.["content-type"] || resp.headers()?.["Content-Type"] || "";
  return typeof ct === "string" && ct.includes("application/json");
}

function extractMediaFromLegacy(legacy) {
  const media = legacy?.extended_entities?.media || legacy?.entities?.media || [];

  const images = [];
  const videos = [];

  for (const m of media) {
    const type = m?.type;

    if (type === "photo") {
      const u = m?.media_url_https || m?.media_url;
      if (u) images.push(u);
    } else if (type === "video" || type === "animated_gif") {
      const poster = m?.media_url_https || m?.media_url || null;

      const variants = (m?.video_info?.variants || [])
        .map((v) => ({
          content_type: v?.content_type || null,
          bitrate: v?.bitrate ?? null,
          url: v?.url || null,
        }))
        .filter((v) => v.url);

      videos.push({ type, poster, variants });
    }
  }

  return { images: uniq(images), videos };
}

function normalizeTweetResult(tweetResult) {
  if (!tweetResult || typeof tweetResult !== "object") return null;

  let r = tweetResult;

  // Handle various wrapper types (TweetWithVisibilityResults, etc.)
  if (r.tweet) r = r.tweet;
  if (r.result) r = r.result;
  if (r.tweet) r = r.tweet; // Check again in case of nested wrappers

  const typename = r.__typename;
  // Allow Tweet and similar tweet types
  if (typename && !["Tweet", "TweetTombstone"].includes(typename) && !typename.includes("Tweet")) {
    return null;
  }

  const legacy = r.legacy || null;
  if (!legacy) return null;

  const tweetId = r.rest_id || legacy?.id_str || null;
  const text = legacy?.full_text ?? legacy?.text ?? "";

  // Try multiple paths for user data - X changes these frequently
  let user = null;
  let userLegacy = null;

  // Path 1: core.user_results.result (most common)
  user = safeGet(r, ["core", "user_results", "result"], null);

  // Path 2: core.user_results.result might have another result wrapper
  if (user?.result) user = user.result;

  // Path 3: Try legacy path on user
  if (user) userLegacy = user.legacy || null;

  // Path 4: user_results directly on tweet
  if (!user) {
    user = safeGet(r, ["user_results", "result"], null);
    if (user?.result) user = user.result;
    if (user) userLegacy = user.legacy || null;
  }

  // Path 5: author field
  if (!user) {
    user = safeGet(r, ["author"], null);
    if (user?.result) user = user.result;
    if (user) userLegacy = user.legacy || null;
  }

  // Extract screen_name and name from various possible locations
  let author =
    userLegacy?.screen_name ||
    user?.legacy?.screen_name ||
    user?.screen_name ||
    legacy?.user?.screen_name ||
    null;

  let authorName =
    userLegacy?.name ||
    user?.legacy?.name ||
    user?.name ||
    legacy?.user?.name ||
    null;

  // Build URL - try to extract username from existing URL if author is missing
  let url = null;
  if (author && tweetId) {
    url = `https://x.com/${author}/status/${tweetId}`;
  } else if (tweetId) {
    // Try to find URL in legacy entities
    const urls = legacy?.entities?.urls || [];
    for (const u of urls) {
      const expanded = u?.expanded_url || u?.url || "";
      const match = expanded.match(/x\.com\/([^\/]+)\/status\//i) || expanded.match(/twitter\.com\/([^\/]+)\/status\//i);
      if (match && match[1]) {
        author = author || match[1];
        url = `https://x.com/${match[1]}/status/${tweetId}`;
        break;
      }
    }
  }

  // If still no author, use user_id_str as last resort (displays as number)
  if (!author) {
    author = legacy?.user_id_str || null;
  }

  const tweetCreatedAt = legacy?.created_at ? new Date(legacy.created_at) : null;

  const { images, videos } = extractMediaFromLegacy(legacy);

  return {
    tweetId,
    url,
    author,
    authorName,
    tweetCreatedAt,
    text,
    images,
    videos,
  };
}

function* walkInstructionEntries(instructions) {
  for (const inst of instructions || []) {
    const type = inst?.type;

    if (type === "TimelineAddEntries" && Array.isArray(inst.entries)) {
      for (const e of inst.entries) yield e;
      continue;
    }

    if (type === "TimelineReplaceEntry" && inst.entry) {
      yield inst.entry;
      continue;
    }

    if (Array.isArray(inst?.entries)) {
      for (const e of inst.entries) yield e;
    }
  }
}

function extractTweetsFromSearchTimelineJson(json) {
  const instructions =
    safeGet(json, ["data", "search_by_raw_query", "search_timeline", "timeline", "instructions"], []) ||
    [];

  const tweets = [];

  for (const entry of walkInstructionEntries(instructions)) {
    const tweetResult = safeGet(entry, ["content", "itemContent", "tweet_results", "result"], null);
    const normalized = normalizeTweetResult(tweetResult);
    if (normalized) tweets.push(normalized);

    const items = safeGet(entry, ["content", "items"], null);
    if (Array.isArray(items)) {
      for (const it of items) {
        const tr = safeGet(it, ["item", "itemContent", "tweet_results", "result"], null);
        const n = normalizeTweetResult(tr);
        if (n) tweets.push(n);
      }
    }
  }

  const seen = new Set();
  const out = [];
  for (const t of tweets) {
    const k = t.tweetId || t.url || t.text;
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }

  return out;
}

async function cdpPreflight() {
  try {
    const res = await (await fetch(`${CDP_ENDPOINT}/json/version`)).json();
    if (!res.webSocketDebuggerUrl) throw new Error("No webSocketDebuggerUrl in /json/version response");
  } catch (e) {
    console.error(
      `CDP preflight failed at ${CDP_ENDPOINT}.\n` +
        `Start Chrome with: --remote-debugging-port=9222\n` +
        `Error: ${e?.message || e}`
    );
    process.exit(1);
  }
}

async function main() {
  const searchTerm = process.argv[2]?.trim();
  const jobId = process.argv[3]?.trim() || null;

  if (!searchTerm) {
    console.error("Usage: node twittersearchscraper.mjs <searchTerm> [jobId]");
    process.exit(1);
  }

  await cdpPreflight();

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  let browser;

  try {
    await mongo.connect();
    const db = mongo.db(DB_NAME);
    const outColl = db.collection(OUT_COLL);

    // Build search URL directly from the search term (no enrichment lookup)
    const searchUrl = toLiveSearchUrl(searchTerm);

    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    const ctx = browser.contexts()[0];
    if (!ctx) throw new Error("No browser context found (is Chrome running with remote debugging?)");

    const page = await ctx.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // Capture SearchTimeline GraphQL JSON payloads
    const captured = [];
    const onResponse = async (resp) => {
      const url = resp.url();
      if (!isSearchTimelineUrl(url)) return;
      if (!looksJsonResponse(resp)) return;

      try {
        const json = await resp.json();
        captured.push({ url, json, at: new Date() });
      } catch {
        // ignore
      }
    };

    page.on("response", onResponse);

    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });

    // Wait for at least one SearchTimeline payload
    const start = Date.now();
    while (captured.length === 0 && Date.now() - start < WAIT_FOR_GQL_MS) {
      await sleep(250);
    }

    // If none, try to trigger additional loads
    if (captured.length === 0) {
      for (let i = 0; i < EXTRA_SCROLLS && captured.length === 0; i++) {
        await page.mouse.wheel(0, 1400);
        await sleep(SCROLL_WAIT_MS);
      }
    }

    if (captured.length === 0) {
      console.error(
        `No SearchTimeline GraphQL JSON captured.\n` +
          `Common causes:\n` +
          `- Not logged into X in that Chrome profile\n` +
          `- Consent/login interstitial\n` +
          `- X changed endpoints/response types\n`
      );
      process.exit(3);
    }

    // Parse tweets from all captured payloads
    const allTweets = [];
    for (const c of captured) {
      const tweets = extractTweetsFromSearchTimelineJson(c.json);
      allTweets.push(...tweets);
    }

    // De-dupe across payloads
    const seen = new Set();
    const deduped = [];
    for (const t of allTweets) {
      const k = t.tweetId || t.url || t.text;
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(t);
    }

    const now = new Date();

    let upserts = 0;

    for (const t of deduped) {
      const doc = {
        searchTerm,
        jobId: jobId || null,
        tweetId: t.tweetId || null,
        url: t.url || null,
        author: t.author || null,
        authorName: t.authorName || null,

        tweetCreatedAt: t.tweetCreatedAt || null,

        text: t.text || "",
        images: t.images || [],
        videos: t.videos || [],

        source: "x_search_graphql",
        capturedAt: now,
        lastSeenAt: now,
      };

      // Filter by jobId and tweetId for deduplication
      const filter = doc.tweetId
        ? { jobId, tweetId: doc.tweetId }
        : { jobId, url: doc.url || null, text: doc.text };

      await outColl.updateOne(
        filter,
        {
          $setOnInsert: { createdAt: now },
          $set: doc,
        },
        { upsert: true }
      );

      upserts++;
    }

    console.log(
      `SearchTerm="${searchTerm}"\n` +
        `JobId=${jobId || 'none'}\n` +
        `URL=${searchUrl}\n` +
        `CapturedPayloads=${captured.length}\n` +
        `TweetsParsed=${deduped.length}\n` +
        `Upserts=${upserts} -> ${DB_NAME}.${OUT_COLL}`
    );

    page.off("response", onResponse);
    await page.close().catch(() => {});
  } finally {
    if (browser) await browser.close().catch(() => {});
    await mongo.close().catch(() => {});
  }
}

main().catch((e) => {
  console.error(`Fatal: ${e?.stack || e?.message || e}`);
  process.exit(1);
});
