// twitter-scraper.mjs
import { chromium } from 'playwright';
import { MongoClient } from 'mongodb';

const CDP_ENDPOINT = process.env.CDP || 'http://127.0.0.1:9222';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'global';
const COLL_NAME = 'breaking_news';
const BETWEEN_TABS_MS = 10_000; // 1 minute between tabs

// ---------- small utils ----------
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function isX(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.hostname === 'x.com' || u.hostname.endsWith('.x.com');
  } catch { return false; }
}

// Match: https://x.com/i/api/graphql/<hash>/UserTweets
function isUserTweetsUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!(u.hostname === 'x.com' || u.hostname.endsWith('.x.com'))) return false;
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length >= 5 && parts[0] === 'i' && parts[1] === 'api' &&
           parts[2] === 'graphql' && parts[4] === 'UserTweets';
  } catch { return false; }
}

async function waitForXMain(page) {
  const candidates = ['main[role="main"]', 'div[data-testid="primaryColumn"]', 'section[aria-label]'];
  for (const sel of candidates) {
    try { await page.waitForSelector(sel, { timeout: 6000 }); return; } catch {}
  }
  await page.waitForTimeout(1500);
}

async function refreshViaReload(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForXMain(page);
}

// Capture responses matching UserTweets during an action; return parsed JSON payloads
async function captureUserTweetsJSON(page, actionFn, { tailMs = 2500 } = {}) {
  const responses = [];
  const onResponse = (resp) => {
    try {
      const method = resp.request().method();
      const url = resp.url();
      if ((method === 'GET' || method === 'POST') && isUserTweetsUrl(url)) {
        responses.push(resp);
      }
    } catch {}
  };

  page.on('response', onResponse);
  try {
    await actionFn();
    await page.waitForTimeout(tailMs);
  } finally {
    page.removeListener('response', onResponse); // ensure no lingering listener
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

// ---------- extraction ----------
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
  const mp4s = media.video_info.variants
    .filter(v => v.content_type === 'video/mp4' && v.url)
    .map(v => ({ url: v.url, bitrate: v.bitrate ?? 0 }));
  mp4s.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  return mp4s;
}
function extractTweetsFromUserTweets(json) {
  const out = [];
  const instructions = json?.data?.user?.result?.timeline?.timeline?.instructions || [];
  const entries = [];
  for (const instr of instructions) {
    if (instr.type === 'TimelineAddEntries' && Array.isArray(instr.entries)) {
      entries.push(...instr.entries);
    } else if (instr.type === 'TimelinePinEntry' && instr.entry) {
      entries.push(instr.entry);
    }
  }
  for (const entry of entries) {
    const item = entry?.content?.itemContent;
    if (!item || item.itemType !== 'TimelineTweet') continue;
    const tweet = item.tweet_results?.result;
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
          videos.push({
            best: variants[0].url,
            variants
          });
        }
      }
    }

    const id = legacy.id_str || tweet.rest_id;
    const created_at = legacy.created_at ? new Date(legacy.created_at).toISOString() : null;
    const url = (author_screen_name && id) ? `https://x.com/${author_screen_name}/status/${id}` : null;

    out.push({
      id,
      url,
      author: {
        id: author_id,
        screen_name: author_screen_name,
        name: author_name
      },
      created_at,
      text,
      images,
      videos
    });
  }
  return out;
}

// ---------- mapping to Mongo ----------
function toMongoTweetDoc(extracted) {
  const bestVideoUrls = extracted.videos?.map(v => v.best).filter(Boolean) || [];
  return {
    url: extracted.url || null,
    account: extracted.author?.screen_name || null,
    datetime: extracted.created_at ? new Date(extracted.created_at) : null,
    images: extracted.images || [],
    lastSeenAt: new Date(),
    text: extracted.text || '',
    tweetId: extracted.id || null,
    videos: bestVideoUrls,
    enriched: false,
    enrichedAt: null,
    enrichmentRef: null
  };
}

// ---------- main ----------
(async () => {
  let browser;
  let mongo;
  try {
    // Preflight CDP
    try {
      const res = await (await fetch(`${CDP_ENDPOINT}/json/version`)).json();
      if (!res.webSocketDebuggerUrl) throw new Error('No webSocketDebuggerUrl from /json/version');
    } catch (e) {
      throw new Error(`CDP preflight failed at ${CDP_ENDPOINT}: ${e?.message || e}`);
    }

    // Connect to Chrome & Mongo
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await mongo.connect();
    const coll = mongo.db(DB_NAME).collection(COLL_NAME);

    // Gather X tabs
    const contexts = browser.contexts();
    const allPages = contexts.flatMap(c => c.pages());
    const xPages = allPages.filter(p => isX(p.url()));

    console.log(`Found ${xPages.length} x.com tab(s).`);
    if (xPages.length === 0) {
      console.log('Open some profile tabs on x.com, then re-run.');
      return;
    }

    // Process each tab sequentially with a 1-minute wait between tabs
    const now = new Date();
    for (const [i, page] of xPages.entries()) {
      if (page.isClosed()) {
        console.warn(`Tab ${i + 1} is already closed, skipping.`);
        continue;
      }
      const title = await page.title().catch(() => '(no title)');
      console.log(`\n[Tab ${i + 1}/${xPages.length}] ${title} -> ${page.url()}`);

      // Capture payload(s) for this tab
      const payloads = await captureUserTweetsJSON(page, () => refreshViaReload(page), { tailMs: 2500 });
      console.log(`Captured ${payloads.length} UserTweets payload(s) from this tab.`);

      // Immediately drop any per-page listeners (done inside capture), do not retain page refs.

      // Extract tweets
      const extractedTweets = payloads.flatMap(extractTweetsFromUserTweets);

      // Upsert into Mongo (by tweetId)
      let upserts = 0;
      for (const t of extractedTweets) {
        const doc = toMongoTweetDoc(t);
        if (!doc.tweetId) continue;

        await coll.updateOne(
          { tweetId: doc.tweetId },
          {
            $setOnInsert: {
              fetchedAt: now,
              tiktoks_processed: doc.tiktoks_processed,
              tiktoks_count: doc.tiktoks_count,
              tiktoks_processedAt: doc.tiktoks_processedAt,
              enriched: doc.enriched,
              enrichedAt: doc.enrichedAt,
              enrichmentRef: doc.enrichmentRef
            },
            $set: {
              url: doc.url,
              account: doc.account,
              datetime: doc.datetime,
              images: doc.images,
              lastSeenAt: new Date(),
              text: doc.text,
              tweetId: doc.tweetId,
              videos: doc.videos
            }
          },
          { upsert: true }
        );
        upserts++;
      }
      console.log(`Upserted/updated ${upserts} tweet(s) into ${DB_NAME}.${COLL_NAME}.`);

      // Wait 1 minute before the next tab (unless this was the last)
      if (i < xPages.length - 1) {
        console.log(`Waiting ${Math.round(BETWEEN_TABS_MS / 1000)}s before processing the next tab...`);
        await sleep(BETWEEN_TABS_MS);
      }
    }

  } catch (err) {
    console.error(`Error: ${err?.message || err}`);
    process.exitCode = 1;
  } finally {
    // Fail-safe disconnects (no lingering connections)
    if (browser) { try { await browser.close(); } catch {} }
    if (mongo) { try { await mongo.close(); } catch {} }
  }
})();
