// src/controllers/breakingNewsController.js
const breakingNewsRepo = require('../mongo/breakingNews');
async function listBreakingNews(req, res, next) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const items = await breakingNewsRepo.getAll({ limit, offset });
    res.json(items);
  } catch (err) {
    next(err);
  }
}

async function getBreakingNewsById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await breakingNewsRepo.getById(id);

    if (!item) {
      return res.status(404).json({ error: 'Breaking news not found' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function getBreakingNewsEnrichmentById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await breakingNewsRepo.getEnrichmentById(id);

    if (!item) {
      return res.status(404).json({ error: 'Breaking news enrichment not found' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function getBreakingNewsMediaById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await breakingNewsRepo.getMediaById(id);

    if (!item) {
      return res.status(404).json({ error: 'Breaking news media not found' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
}

async function listBreakingNewsLive(req, res, next) {
  try {
    const { id } = req.params;
    console.log('jobId:', id);
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const since = req.query.since; // ISO string (optional)

    const items = await breakingNewsRepo.getLiveByJobId({
      id,
      limit,
      offset,
      since,
    });

    res.json(items);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  listBreakingNews,
  getBreakingNewsById,
  getBreakingNewsEnrichmentById,
  getBreakingNewsMediaById,
  listBreakingNewsLive
};
