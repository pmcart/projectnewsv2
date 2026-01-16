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

module.exports = router;
