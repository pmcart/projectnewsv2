const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// Document CRUD
router.get('/', documentController.listDocuments);
router.post('/', documentController.createDocument);
router.get('/:id', documentController.getDocument);

// Versions
router.get('/:id/versions', documentController.getVersions);
router.get('/:id/versions/:versionId', documentController.getVersion);
router.post('/:id/versions', documentController.createVersion);

// Content generation
router.post('/:id/generate', documentController.generateContent);

// Review workflow
router.post('/:id/submit', documentController.submitForReview);
router.post('/:id/approve', documentController.approveDocument);
router.post('/:id/reject', documentController.rejectDocument);
router.post('/:id/review-note', documentController.addReviewNote);
router.get('/:id/review-events', documentController.getReviewEvents);

// Audit
router.get('/:id/audit-log', documentController.getAuditLog);

module.exports = router;
