// src/repositories/breakingNewsMongoRepository.js
const BreakingNews = require('../models/BreakingNews');
const BreakingNewsEnrichment = require('../models/BreakingNewsEnrichment');

class BreakingNewsRepo {
  async getAll({ limit = 50, offset = 0 } = {}) {
    return BreakingNews.find()
      .sort({ publishedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async getById(id) {
    return BreakingNews.findById(id).lean().exec();
  }

  async getEnrichmentById(id) {
    return BreakingNewsEnrichment.findOne({ tweetId: id }).lean().exec();
  }

  async getMediaById(id) {
    const BreakingNewsMedia = require('../models/BreakingNewsMedia');
    return BreakingNewsMedia.findOne({ source_tweet_id: id }).lean().exec();
  }
}

module.exports = new BreakingNewsRepo();
