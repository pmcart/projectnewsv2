const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/auth');
const controller = require('../controllers/statsController');

router.use(apiKeyAuth);

// GET /api/stats/dashboard
router.get('/dashboard', controller.getDashboardStats);

module.exports = router;
