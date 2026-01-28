// twitter-home-scraper.mjs
import { chromium } from 'playwright';
import { MongoClient } from 'mongodb';

const CDP_ENDPOINT = process.env.CDP || 'http://127.0.0.1:9222';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'global';
const COLL_NAME = 'breaking_news';

const HOME_URL = 'https://x.com/home';
const TAKE_LATEST = 20;

// ---------- small utils ----------
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function isHomeLatestTimelineUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== 'x.com' && !u.hostname.endsWith('.x.com')) return false;
    const parts = u.pathname.split('/').filter(Boolean);
    // /i/api/graphql/<hash>/HomeLatestTimeline
    return (
      parts.length >= 5 &&
      parts[0] === 'i' &&
      parts[1] === 'api' &&
      parts[2] === 'graphql' &&
      parts[4] === 'HomeLatestTimeline'
    );
  } catch {
    return false;
  }
}

async function waitForXMain(page) {
  const candidates = ['main[role="main"]', 'div[data-testid="primaryColumn"]'];
  for (const sel of candidates) {
    try {
      await page.waitForSelector(sel, { timeout: 8000 });
      return;
    } catch {}
  }
  await page.waitForTimeout(1500);
}

async function ensureHomePage(browser) {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((c) => c.pages());

  const existing = pages.find((p) => {
    try {
      const u = new URL(p.url());
      return (u.hostname === 'x.com' || u.hostname.endsWith('.x.com')) && u.pathname === '/home';
    } catch {
      return false;
    }
  });

  if (existing && !existing.isClosed()) {
    await waitForXMain(existing);
    return existing;
  }

  const ctx = contexts[0] || (await browser.newContext());
  const page = await ctx.newPage();
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
  await waitForXMain(page);
  return page;
}

async function captureHomeLatestJSON(page, actionFn, { tailMs = 2500 } = {}) {
  const responses = [];

  const onResponse = (resp) => {
    try {
      const req = resp.request();
      const url = resp.url();
      if (isHomeLatestTimelineUrl(url)) {
        responses.push(resp);
      }
    } catch {}
  };

  page.on('response', onResponse);
  try {
    await actionFn();
    await page.waitForTimeout(tailMs);
  } finally {
    page.removeListener('response', onResponse);
  }

  const payloads = [];
  for (const r of responses) {
    try {
      const json = await r.json().catch(() => null);
      if (json) payloads.push(json);
    } catch {}
  }
  return payloads;
}

// ---------- extraction helpers ----------
function expandUrlsInText(text, entities) {
  if (!text || !entities || !Array.isArray(entities.urls)) return text;
  let out = text;
  for (const u of entities.urls) {
    if (u.url && u.expanded_url) out = out.split(u.url).join(u.expanded_url);
  }
  return out;
}

function pickVideoVariants(media) {
  if (!media?.video_info?.variants) return [];
  return media.video_info.variants
    .filter((v) => v.content_type === 'video/mp4' && v.url)
    .map((v) => ({ url: v.url, bitrate: v.bitrate ?? 0 }))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
}

function unwrapTweetResult(tweetResult) {
  if (!tweetResult) return null;
  if (tweetResult.__typename === 'Tweet') return tweetResult;
  if (tweetResult.__typename === 'TweetWithVisibilityResults') return tweetResult.tweet || null;
  return null;
}

/**
 * Extract tweets from HomeLatestTimeline response.
 * Also captures entry sortIndex so we can select "latest" reliably.
 */
function extractTweetsFromHomeLatest(json) {
  const out = [];
  const instructions = json?.data?.home?.home_timeline_urt?.instructions || [];
  const entries = [];

  for (const instr of instructions) {
    if (instr?.type === 'TimelineAddEntries' && Array.isArray(instr.entries)) {
      entries.push(...instr.entries);
    } else if (instr?.type === 'TimelinePinEntry' && instr.entry) {
      entries.push(instr.entry);
    }
  }

  for (const entry of entries) {
    const item = entry?.content?.itemContent;
    if (!item || item.itemType !== 'TimelineTweet') continue;

    const tweet = unwrapTweetResult(item?.tweet_results?.result);
    if (!tweet || tweet.__typename !== 'Tweet') continue;

    const legacy = tweet.legacy || {};
    const coreUser = tweet.core?.user_results?.result;

    const author_screen_name = coreUser?.core?.screen_name;
    const author_name = coreUser?.core?.name;
    const author_id = coreUser?.rest_id;

    const noteText = tweet.note_tweet?.note_tweet_results?.result?.text;
    const textRaw = noteText || legacy.full_text || '';
    const text = expandUrlsInText(textRaw, legacy.entities);

    const media = legacy.extended_entities?.media || legacy.entities?.media || [];
    const images = [];
    const videos = [];

    for (const m of media) {
      if (m.type === 'photo' && m.media_url_https) {
        images.push(m.media_url_https);
      } else if (m.type === 'video' || m.type === 'animated_gif') {
        const variants = pickVideoVariants(m);
        if (variants.length) {
          videos.push({ best: variants[0].url, variants });
        }
      }
    }

    const id = legacy.id_str || tweet.rest_id;
    const created_at = legacy.created_at ? new Date(legacy.created_at).toISOString() : null;
    const url =
      author_screen_name && id ? `https://x.com/${author_screen_name}/status/${id}` : null;

    out.push({
      id,
      url,
      sortIndex: entry?.sortIndex || null,
      author: { id: author_id, screen_name: author_screen_name, name: author_name },
      created_at,
      text,
      images,
      videos,
    });
  }

  return out;
}

// ---------- mapping to Mongo ----------
function toMongoTweetDoc(extracted) {
  const bestVideoUrls = extracted.videos?.map((v) => v.best).filter(Boolean) || [];
  return {
    url: extracted.url || null,
    account: extracted.author?.screen_name || null,
    authorId: extracted.author?.id || null, // suggested addition
    datetime: extracted.created_at ? new Date(extracted.created_at) : null,
    images: extracted.images || [],
    lastSeenAt: new Date(),
    text: extracted.text || '',
    tweetId: extracted.id || null,
    videos: bestVideoUrls,
    enriched: false,
    enrichedAt: null,
    enrichmentRef: null,
  };
}

// ---------- pick latest 20 ----------
function pickLatestN(tweets, n = 20) {
  // De-dupe within run
  const byId = new Map();
  for (const t of tweets) if (t?.id) byId.set(t.id, t);
  const uniq = [...byId.values()];

  // Prefer sortIndex (string number). Bigger = newer.
  const haveSort = uniq.some((t) => t.sortIndex && /^\d+$/.test(String(t.sortIndex)));

  if (haveSort) {
    uniq.sort((a, b) => {
      const ai = BigInt(a.sortIndex || '0');
      const bi = BigInt(b.sortIndex || '0');
      return bi > ai ? 1 : bi < ai ? -1 : 0;
    });
    return uniq.slice(0, n);
  }

  // Fallback: created_at
  uniq.sort((a, b) => {
    const at = a.created_at ? Date.parse(a.created_at) : 0;
    const bt = b.created_at ? Date.parse(b.created_at) : 0;
    return bt - at;
  });
  return uniq.slice(0, n);
}

// ---------- main ----------
(async () => {
  let browser;
  let mongo;

  try {
    // CDP preflight
    try {
      const res = await (await fetch(`${CDP_ENDPOINT}/json/version`)).json();
      if (!res.webSocketDebuggerUrl) throw new Error('No webSocketDebuggerUrl from /json/version');
    } catch (e) {
      throw new Error(`CDP preflight failed at ${CDP_ENDPOINT}: ${e?.message || e}`);
    }

    browser = await chromium.connectOverCDP(CDP_ENDPOINT);

    mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await mongo.connect();
    const coll = mongo.db(DB_NAME).collection(COLL_NAME);

    // ---- indexes (suggested additions) ----
    await coll.createIndex({ tweetId: 1 }, { unique: true }); // dedupe guarantee
    await coll.createIndex({ datetime: -1 });
    await coll.createIndex({ lastSeenAt: -1 });
    await coll.createIndex({ account: 1, datetime: -1 }); // useful for per-account timelines

    const page = await ensureHomePage(browser);
    console.log(`Using page: ${page.url()}`);

    // Capture HomeLatestTimeline triggered by reload
    const payloads = await captureHomeLatestJSON(
      page,
      async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForXMain(page);
        // small settle so the timeline request actually fires
        await sleep(750);
      },
      { tailMs: 3000 }
    );

    console.log(`Captured ${payloads.length} HomeLatestTimeline payload(s).`);

    const extractedAll = payloads.flatMap(extractTweetsFromHomeLatest);
    const extracted = pickLatestN(extractedAll, TAKE_LATEST);

    console.log(`Selected latest ${extracted.length} tweet(s) for storage.`);

    const now = new Date();

    const ops = extracted
      .map((t) => toMongoTweetDoc(t))
      .filter((doc) => doc.tweetId)
      .map((doc) => ({
        updateOne: {
          filter: { tweetId: doc.tweetId },
          update: {
            $setOnInsert: {
              fetchedAt: now,
              enriched: doc.enriched,
              enrichedAt: doc.enrichedAt,
              enrichmentRef: doc.enrichmentRef,
            },
            // Always update lastSeenAt; update content fields too
            $set: {
              url: doc.url,
              account: doc.account,
              authorId: doc.authorId,
              datetime: doc.datetime,
              images: doc.images,
              lastSeenAt: new Date(),
              text: doc.text,
              videos: doc.videos,
            },
          },
          upsert: true,
        },
      }));

    if (!ops.length) {
      console.log('No docs to upsert.');
      return;
    }

    const r = await coll.bulkWrite(ops, { ordered: false });
    console.log(
      `Mongo: upserted=${r.upsertedCount}, modified=${r.modifiedCount}, matched=${r.matchedCount}`
    );
  } catch (err) {
    console.error(`Error: ${err?.message || err}`);
    process.exitCode = 1;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    if (mongo) {
      try {
        await mongo.close();
      } catch {}
    }
  }
})();
