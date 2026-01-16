// src/controllers/rssFeedController.js
const googleNewsService = require('../services/googleNewsService');

async function getGoogleNewsFeed(req, res, next) {
  try {
    const country = req.query.country || req.query.region || 'US';
    const category = req.query.category || null;
    const topic = req.query.topic || null;
    const limitParam = req.query.limit;

    // NEW: enrichment level
    const enrich = (req.query.enrich || 'light').toLowerCase(); // none|light|full

    const { feed, items } = await googleNewsService.fetchNews({
      region: country,
      category,
      topic,
      enrich,
    });

    let limit = items.length;
    if (limitParam !== undefined) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, items.length);
      }
    }

    res.json({
      feed,
      total: items.length,
      count: limit,
      items: items.slice(0, limit),
    });
  } catch (err) {
    next(err);
  }
}

async function getRssFeedItemById(req, res, next) {
  try {
    const { id } = req.params;
    const country = req.query.country || req.query.region || 'US';
    const category = req.query.category || null;
    const topic = req.query.topic || null;
    const enrich = (req.query.enrich || 'light').toLowerCase();

    const item = await googleNewsService.findItemById({
      id,
      region: country,
      category,
      topic,
      enrich,
    });

    if (!item) {
      return res.status(404).json({ error: 'RSS feed item not found' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
}

module.exports = { getGoogleNewsFeed, getRssFeedItemById };
