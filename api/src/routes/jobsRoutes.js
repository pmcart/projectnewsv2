const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/auth');
const controller = require('../controllers/jobsController');

router.use(apiKeyAuth);

// GET /api/jobs?limit&offset
router.get('/', controller.listJobs);

// GET /api/jobs/:id
router.get('/:id', controller.getJobById);

// POST /api/jobs/twitter-live  body: { tweetId }
router.post('/twitter-live', controller.createTwitterLiveJob);

// POST /api/jobs/twitter-search  body: { searchTerm }
router.post('/twitter-search', controller.createTwitterSearchJob);

// POST /api/jobs/single-enrichment  body: { tweetId, tweetText }
router.post('/single-enrichment', controller.createSingleEnrichmentJob);

// POST /api/jobs/single-media  body: { tweetId, tweetText }
router.post('/single-media', controller.createSingleMediaJob);

module.exports = router;
