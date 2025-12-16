// enrichMedia.js
require('dotenv').config();
const { MongoClient } = require('mongodb');
const axios = require('axios');

const {
  MONGODB_URI,
  MONGODB_DB,
  MONGODB_COLLECTION, // source collection (e.g. "tweets")
  GOOGLE_API_KEY,
  GOOGLE_CSE_ID,      // your CSE id
} = process.env;

if (!MONGODB_URI || !MONGODB_DB || !MONGODB_COLLECTION) {
  throw new Error('Missing MongoDB env vars (MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION).');
}

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
  console.warn('Warning: GOOGLE_API_KEY or GOOGLE_CSE_ID missing – video search will be skipped.');
}

// Main video platforms we care most about
const PRIMARY_VIDEO_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
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

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    const sourceCollection = db.collection(MONGODB_COLLECTION);
    const mediaCollection = db.collection('breaking_news_media');

    // Example: process a batch; you can remove .limit(50) in production
    const cursor = sourceCollection.find().limit(50);

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;

      // Avoid duplicate media docs
      const existingMedia = await mediaCollection.findOne({ source_tweet_id: doc._id });
      if (existingMedia) {
        console.log(`Skipping _id ${doc._id.toString()} – media already exists.`);
        continue;
      }

      console.log(doc.text || 'No context');
      const query = buildQueryFromDoc(doc);
      console.log('\nProcessing _id:', doc._id.toString());
      console.log('Query:', query);

      let mediaLinks = [];

      if (GOOGLE_API_KEY && GOOGLE_CSE_ID) {
        try {
          mediaLinks = await searchVideoPages(query, 20);
          console.log(`  Found ${mediaLinks.length} video links`);
        } catch (err) {
          console.error('  Error searching media for doc', doc._id.toString(), err.message);
        }
      }

      const mediaDoc = {
        source_tweet_id: doc.tweetId, // NOTE: this was in your original code
        text: doc.text,
        entities: doc.entities || {},
        locations: doc.locations || [],
        event_type: doc.event_type,
        hash: doc.hash,

        // media info
        media_query: query,
        video_links: mediaLinks,   // renamed for clarity, video-only
        searchedAt: new Date(),
      };

      await mediaCollection.updateOne(
        { source_tweet_id: doc._id },
        { $set: mediaDoc },
        { upsert: true }
      );

      console.log('  Inserted/updated breaking_news_media document');
    }
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await client.close();
  }
}

/**
 * Build a search query from the tweet document.
 */
function buildQueryFromDoc(doc) {
  const parts = [];

  if (doc.entities) {
    if (Array.isArray(doc.entities.organizations)) {
      parts.push(...doc.entities.organizations);
    }
    if (Array.isArray(doc.entities.people)) {
      parts.push(...doc.entities.people);
    }
  }

  if (Array.isArray(doc.locations)) {
    for (const loc of doc.locations) {
      if (loc.place) parts.push(loc.place);
      if (loc.country) parts.push(loc.country);
    }
  }

  if (doc.event_type) {
    parts.push(doc.event_type.replace(/_/g, ' '));
  }

  if (doc.text) {
    parts.push(doc.text);
  }

  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search for *video* pages (TikTok, Instagram, YouTube, X/Twitter, etc.) using normal
 * CSE web search, then filter + prioritize results by known media domains.
 */
async function searchVideoPages(query, maxResults = 20) {
  const url = 'https://www.googleapis.com/customsearch/v1';

  // Bias the query towards video content and major platforms
  const videoQuery = `${query} (video OR footage) (tiktok OR youtube OR instagram OR "x.com" OR twitter)`;

  const params = {
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: videoQuery,
    num: Math.min(maxResults, 10), // CSE caps at 10 per request
    safe: 'off',
  };

  const res = await axios.get(url, { params });
  const items = res.data.items || [];

  // Filter to media domains
  const mediaResults = items.filter((item) => {
    const link = (item.link || '').toLowerCase();
    return MEDIA_DOMAINS.some((domain) => link.includes(domain));
  });

  // Prioritize primary platforms (TikTok, YouTube, Instagram, X/Twitter) first
  const primary = [];
  const secondary = [];

  for (const item of mediaResults) {
    const link = (item.link || '').toLowerCase();
    const target = PRIMARY_VIDEO_DOMAINS.some((domain) => link.includes(domain))
      ? primary
      : secondary;
    target.push(item);
  }

  const ordered = [...primary, ...secondary].slice(0, maxResults);

  return ordered.map((item) => ({
    title: item.title,
    link: item.link,
    displayLink: item.displayLink,
    snippet: item.snippet,
    mime: item.mime || null,
  }));
}

// Run the script
main();
