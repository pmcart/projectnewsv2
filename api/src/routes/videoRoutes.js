const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// List videos
router.get('/', videoController.listVideos.bind(videoController));

// Create video
router.post('/', videoController.createVideo.bind(videoController));

// Get video by ID
router.get('/:id', videoController.getVideo.bind(videoController));

// Generate video plan
router.post('/:id/generate', videoController.generateVideoPlan.bind(videoController));

// Submit for review
router.post('/:id/submit', videoController.submitForReview.bind(videoController));

// Approve video
router.post('/:id/approve', videoController.approveVideo.bind(videoController));

// Reject video
router.post('/:id/reject', videoController.rejectVideo.bind(videoController));

// Add review note
router.post('/:id/review-note', videoController.addReviewNote.bind(videoController));

// Get review events
router.get('/:id/review-events', videoController.getReviewEvents.bind(videoController));

// Update video assets
router.put('/:id/assets', videoController.updateAssets.bind(videoController));

// Render video using FFmpeg
router.post('/:id/render', videoController.renderVideo.bind(videoController));

module.exports = router;
