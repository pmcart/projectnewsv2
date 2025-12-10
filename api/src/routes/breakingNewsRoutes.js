// src/routes/breakingNewsRoutes.js
const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/auth');
const controller = require('../controllers/breakingNewsController');

// Apply API key auth to all routes in this router
router.use(apiKeyAuth);

router.get('/', controller.listBreakingNews);          // GET /api/breaking-news
router.get('/:id/enrichment', controller.getBreakingNewsEnrichmentById); // GET /api/breaking-news/:id/enrichment   
router.get('/:id/media', controller.getBreakingNewsMediaById); // GET /api/breaking-news/:id/media
router.get('/:id', controller.getBreakingNewsById);    // GET /api/breaking-news/:id

module.exports = router;
