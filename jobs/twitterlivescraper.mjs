// twitterlivescraper.mjs
// Scrape X (x.com) Live search results via GraphQL (no HTML parsing) using an *already-open* Chrome.
// Saves results into MongoDB.
//
// Usage:
//   node twitterlivescraper.mjs <tweetId>
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
import { MongoClient, ObjectId } from "mongodb";

const CDP_ENDPOINT = process.env.CDP || "http://127.0.0.1:9222";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";

const DB_NAME = "global";
const ENRICH_COLL = "breaking_news_enrichments";
const OUT_COLL = "breaking_news_live";

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

function buildQueryFromEnrichment(enrich) {
  const parts = [];

  // Based on your example enrichment shape (entities + locations)
  const entities = enrich?.entities || {};
  for (const key of ["organizations", "people", "equipment"]) {
    const v = entities?.[key];
    if (Array.isArray(v)) parts.push(...v);
  }

  const locations = enrich?.locations;
  if (Array.isArray(locations)) {
    for (const loc of locations) {
      if (loc?.place) parts.push(loc.place);
    }
  }

  // Keep the query compact (X search can get too broad/noisy)
  const q = uniq(parts).slice(0, 8).join(" ");
  return q || String(enrich?.tweetId || "").trim();
}

function toLiveSearchUrl(q) {
  // Example requested:
  // https://x.com/search?q=liverpoolfc+klopp&f=live
  return `https://x.com/search?q=${encodeURIComponent(q)}&f=live`;
}

function isSearchTimelineUrl(url) {
  // Typical:
  // https://x.com/i/api/graphql/<hash>/SearchTimeline?...variables=...
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

  // Sometimes result is nested under .tweet
  let r = tweetResult;
  if (r.tweet) r = r.tweet;

  const typename = r.__typename;
  if (typename && typename !== "Tweet") return null;

  const legacy = r.legacy || null;
  if (!legacy) return null;

  const tweetId = r.rest_id || legacy?.id_str || null;
  const text = legacy?.full_text ?? legacy?.text ?? "";

  const user = safeGet(r, ["core", "user_results", "result"], null);
  const userLegacy = user?.legacy || null;

  const author = userLegacy?.screen_name || null;
  const authorName = userLegacy?.name || null;

  const tweetCreatedAt = legacy?.created_at ? new Date(legacy.created_at) : null;

  const { images, videos } = extractMediaFromLegacy(legacy);

  const url = author && tweetId ? `https://x.com/${author}/status/${tweetId}` : null;

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

    // Fallback for unknown shapes that still have entries
    if (Array.isArray(inst?.entries)) {
      for (const e of inst.entries) yield e;
    }
  }
}

function extractTweetsFromSearchTimelineJson(json) {
  // Typical path:
  // data.search_by_raw_query.search_timeline.timeline.instructions
  const instructions =
    safeGet(json, ["data", "search_by_raw_query", "search_timeline", "timeline", "instructions"], []) ||
    [];

  const tweets = [];

  for (const entry of walkInstructionEntries(instructions)) {
    // 1) Simple tweet entry:
    const tweetResult = safeGet(entry, ["content", "itemContent", "tweet_results", "result"], null);
    const normalized = normalizeTweetResult(tweetResult);
    if (normalized) tweets.push(normalized);

    // 2) Module entries with content.items[*].item.itemContent.tweet_results.result
    const items = safeGet(entry, ["content", "items"], null);
    if (Array.isArray(items)) {
      for (const it of items) {
        const tr = safeGet(it, ["item", "itemContent", "tweet_results", "result"], null);
        const n = normalizeTweetResult(tr);
        if (n) tweets.push(n);
      }
    }
  }

  // De-dupe inside payload
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
  const tweetId = process.argv[2]?.trim();
  const jobId = process.argv[3]?.trim() || null;
  if (!tweetId) {
    console.error("Usage: node twitterlivescraper.mjs <tweetId>");
    process.exit(1);
  }

  await cdpPreflight();

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  let browser;

  try {
    await mongo.connect();
    const db = mongo.db(DB_NAME);
    const enrichColl = db.collection(ENRICH_COLL);
    const outColl = db.collection(OUT_COLL);

    const enrichment = await enrichColl.findOne({ tweetId });
    if (!enrichment) {
      console.error(`No enrichment found in ${DB_NAME}.${ENRICH_COLL} for tweetId=${tweetId}`);
      process.exit(2);
    }

    const query = buildQueryFromEnrichment(enrichment);
    const searchUrl = toLiveSearchUrl(query);

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

    const enrichmentId =
      enrichment?._id && typeof enrichment._id === "object"
        ? enrichment._id
        : enrichment?._id
          ? new ObjectId(enrichment._id)
          : null;

    let upserts = 0;

    for (const t of deduped) {
      // IMPORTANT FIX:
      // Do NOT include 'createdAt' inside $set doc if you're also using $setOnInsert.createdAt.
      // We'll store tweet time as 'tweetCreatedAt' and DB insertion time as 'createdAt'.
      const doc = {
        enrichmentTweetId: tweetId,
        enrichmentRef: enrichmentId,
        query,
        searchUrl,
        jobId: jobId || null,
        tweetId: t.tweetId || null,
        url: t.url || null,
        author: t.author || null,
        authorName: t.authorName || null,

        tweetCreatedAt: t.tweetCreatedAt || null,

        text: t.text || "",
        images: t.images || [],
        videos: t.videos || [],

        source: "x_live_search_graphql",
        capturedAt: now,
        lastSeenAt: now,
      };

      const filter = doc.tweetId
        ? { enrichmentTweetId: tweetId, tweetId: doc.tweetId }
        : { enrichmentTweetId: tweetId, url: doc.url || null, text: doc.text };

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
      `Enrichment tweetId=${tweetId}\n` +
        `Query="${query}"\n` +
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
