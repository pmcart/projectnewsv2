// src/routes/rssFeedRoutes.js
const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/auth');
const rssFeedController = require('../controllers/rssFeedController');

// Protect all RSS routes with API key auth
router.use(apiKeyAuth);

// Example: GET /api/rss/google-news?country=IE&category=technology&limit=20
// Example: GET /api/rss/google-news?country=GB&topic=bitcoin&limit=10
router.get('/', rssFeedController.getGoogleNewsFeed);

module.exports = router;
