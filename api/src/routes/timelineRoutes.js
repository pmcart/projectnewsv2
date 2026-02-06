const express = require('express');
const router = express.Router();
const timelineController = require('../controllers/timelineController');
const { requireAuth, requireOrganization } = require('../middleware/auth');

// All routes require authentication and organization membership
router.use(requireAuth);
router.use(requireOrganization);

// Create timeline (triggers AI generation)
router.post('/', timelineController.createTimeline.bind(timelineController));

// Look up existing timeline by source tweet ID
router.get('/by-tweet/:tweetId', timelineController.getByTweetId.bind(timelineController));

// Get timeline by ID
router.get('/:id', timelineController.getTimeline.bind(timelineController));

// Delete timeline
router.delete('/:id', timelineController.deleteTimeline.bind(timelineController));

// Add note to a timeline event
router.post('/:id/events/:eventId/notes', timelineController.addNote.bind(timelineController));

// Update a note
router.put('/:id/events/:eventId/notes/:noteId', timelineController.updateNote.bind(timelineController));

// Delete a note
router.delete('/:id/events/:eventId/notes/:noteId', timelineController.deleteNote.bind(timelineController));

module.exports = router;
