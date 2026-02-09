// src/repositories/breakingNewsMongoRepository.js
const BreakingNews = require('../models/BreakingNews');
const BreakingNewsEnrichment = require('../models/BreakingNewsEnrichment');
const BreakingNewsMedia = require('../models/BreakingNewsMedia');
const BreakingNewsLive = require('../models/BreakingNewsLive');
const BreakingNewsSearch = require('../models/BreakingNewsSearch'); 

class BreakingNewsRepo {
  async getAll({ limit = 50, offset = 0, category } = {}) {
    let filter = {};

    if (category) {
      const enrichments = await BreakingNewsEnrichment.find(
        { category },
        { tweetId: 1 }
      ).lean().exec();
      const tweetIds = enrichments.map(e => e.tweetId);
      filter = { tweetId: { $in: tweetIds } };
    }

    return BreakingNews.find(filter)
      .sort({ datetime: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }

  async getById(id) {
    return BreakingNews.findOne({ tweetId: id }).lean().exec();
  }

  async getEnrichmentById(id) {
    return BreakingNewsEnrichment.findOne({ tweetId: id }).lean().exec();
  }

  async getMediaById(id) {

    return BreakingNewsMedia.findOne({ source_tweet_id: id }).lean().exec();
  }

  async getLiveByJobId({ jobId, limit = 50, offset = 0, since } = {}) {
  const q = { jobId };
  return BreakingNewsLive.find(q)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean()
    .exec();
  }

  async getSearchResultsByJobId({ jobId, limit = 50, offset = 0 } = {}) {
    return BreakingNewsSearch.find({ jobId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
      .exec();
  }
}

module.exports = new BreakingNewsRepo();
