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
    const enrichmentCollection = db.collection('breaking_news_enrichments');
    const mediaCollection = db.collection('breaking_news_media');

    // Example: process a batch; you can remove .limit(50) in production
    const cursor = sourceCollection.find().limit(50);

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;

      // Get tweetId from the document
      const tweetId = doc.tweetId || doc._id.toString();

      // Fetch the enrichment data
      const enrichment = await enrichmentCollection.findOne({ tweetId });
      if (!enrichment) {
        console.log(`\nNo enrichment found for tweetId: ${tweetId}, skipping...`);
        continue;
      }

      // Delete existing media entry to reprocess
      const deleteResult = await mediaCollection.deleteOne({ source_tweet_id: doc._id });
      if (deleteResult.deletedCount > 0) {
        console.log(`Deleted existing media entry for _id ${doc._id.toString()}`);
      }

      console.log(doc.text || 'No context');
      const query = buildQueryFromDoc(enrichment);
      console.log('\nProcessing _id:', doc._id.toString());
      console.log('TweetId:', tweetId);
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
 * Build a focused search query using:
 * - First entity (organization or person)
 * - First location
 * - Event type
 */
function buildQueryFromDoc(enrichment) {
  const parts = [];

  // Add event_type first (most important)
  if (enrichment.event_type) {
    parts.push(enrichment.event_type.replace(/_/g, ' '));
  }

  // Add first entity (organization or person)
  if (enrichment.entities) {
    if (Array.isArray(enrichment.entities.organizations) && enrichment.entities.organizations.length > 0) {
      parts.push(enrichment.entities.organizations[0]);
    } else if (Array.isArray(enrichment.entities.people) && enrichment.entities.people.length > 0) {
      parts.push(enrichment.entities.people[0]);
    }
  }

  // Add first location
  if (Array.isArray(enrichment.locations) && enrichment.locations.length > 0) {
    const loc = enrichment.locations[0];
    if (loc.place) {
      parts.push(loc.place);
    } else if (loc.country) {
      parts.push(loc.country);
    }
  }

  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple direct search using just the query + video keyword
 */
async function searchVideoPages(query, maxResults = 20) {
  if (!query || query.trim().length === 0) {
    console.log('  Empty query, skipping search');
    return [];
  }

  const url = 'https://www.googleapis.com/customsearch/v1';

  // Simple approach: just add "video" to the query
  const searchQuery = `${query} video`;

  const params = {
    key: GOOGLE_API_KEY,
    cx: GOOGLE_CSE_ID,
    q: searchQuery,
    num: Math.min(maxResults, 10),
    safe: 'off',
    dateRestrict: 'd7', // Only results from last 7 days
  };

  try {
    const res = await axios.get(url, { params });
    const items = res.data.items || [];

    // Filter to media domains only
    const mediaResults = items.filter((item) => {
      const link = (item.link || '').toLowerCase();
      return MEDIA_DOMAINS.some((domain) => link.includes(domain));
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
    console.error('  Search error:', err.message);
    return [];
  }
}

// Run the script
main();
