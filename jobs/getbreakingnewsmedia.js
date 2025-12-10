// enrichMedia.js
require('dotenv').config();
const { MongoClient } = require('mongodb');
const axios = require('axios');

const {
  MONGODB_URI,
  MONGODB_DB,
  MONGODB_COLLECTION, // source collection (e.g. "tweets")
  GOOGLE_API_KEY,
  GOOGLE_CSE_ID,      // your CSE id: f0468327781114891
} = process.env;

if (!MONGODB_URI || !MONGODB_DB || !MONGODB_COLLECTION) {
  throw new Error('Missing MongoDB env vars (MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION).');
}

if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
  console.warn('Warning: GOOGLE_API_KEY or GOOGLE_CSE_ID missing – media search will be skipped.');
}

// Basic list of domains we consider "media/video" sources
const MEDIA_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'fb.watch',
  'x.com',
  'twitter.com',
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

      let images = [];
      let mediaLinks = [];

      if (GOOGLE_API_KEY && GOOGLE_CSE_ID) {
        try {
          images = await searchImages(query, 5);
          console.log(`  Found ${images.length} images`);

          mediaLinks = await searchMediaPages(query, 10);
          console.log(`  Found ${mediaLinks.length} media links`);
        } catch (err) {
          console.error('  Error searching media for doc', doc._id.toString(), err.message);
        }
      }

      const mediaDoc = {
        source_tweet_id: doc.tweetId,
        text: doc.text,
        entities: doc.entities || {},
        locations: doc.locations || [],
        event_type: doc.event_type,
        hash: doc.hash,

        // media info
        media_query: query,
        images,        // from image CSE
        media_links: mediaLinks,   // from general CSE (TikTok/IG/YouTube/etc)
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
 * Search images via Google Custom Search JSON API.
 * Uses searchType=image to return image results.
 */
async function searchImages(query, maxResults = 5) {
  const url = 'https://www.googleapis.com/customsearch/v1';

  const params = {
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: query,
    searchType: 'image',
    num: maxResults,
    safe: 'off',
  };

  const res = await axios.get(url, { params });
  const items = res.data.items || [];

  return items.map((item) => ({
    title: item.title,
    link: item.link,
    thumbnail: item.image?.thumbnailLink || null,
    mime: item.mime || null,
    contextLink: item.image?.contextLink || null,
  }));
}

/**
 * Search for media pages (TikTok, Instagram, YouTube, etc.) using normal CSE web search,
 * then filter results by known media domains.
 */
async function searchMediaPages(query, maxResults = 10) {
  const url = 'https://www.googleapis.com/customsearch/v1';

  const params = {
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    // Bias the query towards media by appending 'video' and 'footage'
    q: `${query} video footage`,
    num: maxResults,
    safe: 'off',
  };

  const res = await axios.get(url, { params });
  const items = res.data.items || [];

  const filtered = items.filter((item) => {
    const link = (item.link || '').toLowerCase();
    return MEDIA_DOMAINS.some((domain) => link.includes(domain));
  });

  return filtered.map((item) => ({
    title: item.title,
    link: item.link,
    displayLink: item.displayLink,
    snippet: item.snippet,
    mime: item.mime || null,
  }));
}

// Run the script
main();
