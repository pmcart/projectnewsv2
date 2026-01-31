// getsinglemedia.mjs
// On-demand single-tweet media search using Google Custom Search API.
// Accepts tweetId, tweetText, and optional jobId as arguments.
//
// Usage:
//   node getsinglemedia.mjs <tweetId> <tweetText> [jobId]
//
// Env:
//   MONGODB_URI=mongodb://127.0.0.1:27017
//   MONGODB_DB=global
//   GOOGLE_API_KEY=...
//   GOOGLE_CSE_ID=...

import 'dotenv/config';
import { MongoClient } from 'mongodb';

// ---------- config ----------
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'global';
const MEDIA_COLL = 'breaking_news_media';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

// Main video platforms we care most about
const PRIMARY_VIDEO_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'x.com',
  'twitter.com',
];

// Extended list of domains we consider "media/video" sources
const MEDIA_DOMAINS = [
  ...PRIMARY_VIDEO_DOMAINS,
  'facebook.com',
  'fb.watch',
  'vimeo.com',
  'dailymotion.com',
  'reddit.com',
  'redd.it',
  'telegram.me',
  'telegram.org',
  'vk.com',
];

// ---------- utilities ----------

/**
 * Build a search query from tweet text.
 * Extract meaningful words and append "video".
 */
function buildQueryFromText(text) {
  if (!text) return '';

  // Remove URLs
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();

  // Extract words with 3+ chars, skip common words
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this', 'that',
    'with', 'they', 'from', 'will', 'would', 'there', 'their', 'what', 'about',
    'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'into',
    'year', 'your', 'good', 'some', 'could', 'them', 'than', 'then', 'look',
    'only', 'come', 'its', 'over', 'also', 'back', 'after', 'use', 'two',
    'how', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
    'these', 'give', 'day', 'most', 'see', 'being', 'breaking', 'just'
  ]);

  const words = cleaned
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  // Take first 5 meaningful words
  const queryWords = words.slice(0, 5);

  if (queryWords.length === 0) return '';

  return queryWords.join(' ') + ' video';
}

/**
 * Check if a TikTok result is relevant to the query.
 */
function isTikTokResultRelevant(item, query) {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 3 && word !== 'video');

  const title = (item.title || '').toLowerCase();
  const snippet = (item.snippet || '').toLowerCase();
  const combined = `${title} ${snippet}`;

  const matchCount = keywords.filter(keyword => combined.includes(keyword)).length;
  return matchCount >= 1;
}

/**
 * Search for video pages using Google Custom Search API.
 */
async function searchVideoPages(query, maxResults = 10) {
  if (!query || query.trim().length === 0) {
    console.log('Empty query, skipping search');
    return [];
  }

  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.log('Missing GOOGLE_API_KEY or GOOGLE_CSE_ID, skipping search');
    return [];
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', GOOGLE_API_KEY);
  url.searchParams.set('cx', GOOGLE_CSE_ID);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.min(maxResults, 10)));
  url.searchParams.set('safe', 'off');
  url.searchParams.set('dateRestrict', 'd7'); // Only results from last 7 days

  try {
    const res = await fetch(url.toString());

    if (!res.ok) {
      console.error('Google CSE error:', res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    const items = data.items || [];

    // Filter to media domains only
    let mediaResults = items.filter((item) => {
      const link = (item.link || '').toLowerCase();
      return MEDIA_DOMAINS.some((domain) => link.includes(domain));
    });

    // Extra filtering for TikTok - check relevance
    mediaResults = mediaResults.filter((item) => {
      const link = (item.link || '').toLowerCase();
      if (link.includes('tiktok.com')) {
        const isRelevant = isTikTokResultRelevant(item, query);
        if (!isRelevant) {
          console.log(`Filtered out irrelevant TikTok: ${item.title}`);
        }
        return isRelevant;
      }
      return true;
    });

    // Prioritize primary video platforms
    const primary = [];
    const secondary = [];

    for (const item of mediaResults) {
      const link = (item.link || '').toLowerCase();
      const target = PRIMARY_VIDEO_DOMAINS.some((domain) => link.includes(domain))
        ? primary
        : secondary;
      target.push(item);
    }

    const ordered = [...primary, ...secondary];

    return ordered.map((item) => ({
      title: item.title,
      link: item.link,
      displayLink: item.displayLink,
      snippet: item.snippet,
    }));
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

// ---------- main ----------
async function main() {
  const tweetId = process.argv[2]?.trim();
  const tweetText = process.argv[3]?.trim() || '';
  const jobId = process.argv[4]?.trim() || null;

  if (!tweetId) {
    console.error('Usage: node getsinglemedia.mjs <tweetId> <tweetText> [jobId]');
    process.exit(1);
  }

  const mongo = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  try {
    await mongo.connect();
    const db = mongo.db(DB_NAME);
    const mediaColl = db.collection(MEDIA_COLL);

    // Check if media already exists
    const existing = await mediaColl.findOne({ source_tweet_id: tweetId });
    if (existing) {
      console.log(`Media already exists for tweetId=${tweetId}, skipping.`);
      process.exit(0);
    }

    // Build query from tweet text
    const query = buildQueryFromText(tweetText);
    console.log(`Searching media for tweetId=${tweetId}`);
    console.log(`Query: "${query}"`);

    let mediaLinks = [];
    if (query) {
      mediaLinks = await searchVideoPages(query, 10);
      console.log(`Found ${mediaLinks.length} media links`);
    } else {
      console.log('Could not build query from tweet text');
    }

    const now = new Date();

    const mediaDoc = {
      source_tweet_id: tweetId,
      text: tweetText,
      media_query: query,
      video_links: mediaLinks,
      searchedAt: now,
      source: 'on_demand_search',
      jobId,
    };

    await mediaColl.updateOne(
      { source_tweet_id: tweetId },
      { $set: mediaDoc },
      { upsert: true }
    );

    console.log(`Media search complete for tweetId=${tweetId}, found ${mediaLinks.length} links`);
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
