const documentService = require('../services/documentService');

class DocumentController {
  /**
   * List all documents with optional filters
   * GET /api/documents
   */
  async listDocuments(req, res, next) {
    try {
      const { status, userId } = req.query;
      const currentUserId = req.user.userId;
      const userRole = req.user.role;

      const documents = await documentService.listDocuments({
        status,
        userId,
        currentUserId,
        userRole
      });

      res.json(documents);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new document
   * POST /api/documents
   */
  async createDocument(req, res, next) {
    try {
      const { title, type } = req.body;
      const ownerUserId = req.user.userId;

      if (!title || !type) {
        return res.status(400).json({
          error: 'Title and type are required',
        });
      }

      const document = await documentService.createDocument({
        title,
        type,
        ownerUserId,
      });

      res.status(201).json(document);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get document by ID
   * GET /api/documents/:id
   */
  async getDocument(req, res, next) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocumentById(id);

      // Check permissions
      const userRole = req.user.role;
      const isOwner = document.ownerUserId === req.user.userId;

      // For now, allow all authenticated users to view
      // In production, you might want stricter controls

      res.json(document);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all versions of a document
   * GET /api/documents/:id/versions
   */
  async getVersions(req, res, next) {
    try {
      const { id } = req.params;
      const versions = await documentService.getDocumentVersions(id);

      res.json(versions);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific version
   * GET /api/documents/:id/versions/:versionId
   */
  async getVersion(req, res, next) {
    try {
      const { versionId } = req.params;
      const version = await documentService.getVersionById(versionId);

      res.json(version);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new version (manual save)
   * POST /api/documents/:id/versions
   */
  async createVersion(req, res, next) {
    try {
      const { id } = req.params;
      const { htmlContent, sourceType, sourceText, sourceUrl, generationInputs } = req.body;
      const userId = req.user.userId;

      if (!htmlContent) {
        return res.status(400).json({
          error: 'htmlContent is required',
        });
      }

      // Check document status and permissions
      const document = await documentService.getDocumentById(id);
      const userRole = req.user.role;
      const isOwner = document.ownerUserId === userId;

      // If document is IN_REVIEW, only EDITOR or WRITER can edit
      if (document.status === 'IN_REVIEW' && userRole === 'READER') {
        return res.status(403).json({
          error: 'You do not have permission to edit this document while in review',
        });
      }

      // If APPROVED, only EDITOR can edit (or you can block entirely)
      if (document.status === 'APPROVED' && userRole !== 'EDITOR') {
        return res.status(403).json({
          error: 'This document is approved and locked',
        });
      }

      const version = await documentService.createVersion({
        documentId: id,
        htmlContent,
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        createdByUserId: userId,
      });

      // If editor made changes during review, log inline edit
      if (document.status === 'IN_REVIEW' && userRole !== 'READER') {
        await documentService.addReviewNote({
          documentId: id,
          versionId: version.id,
          notes: 'Editor made inline edits',
          userId,
        });
      }

      res.status(201).json(version);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate content using OpenAI
   * POST /api/documents/:id/generate
   */
  async generateContent(req, res, next) {
    try {
      const { id } = req.params;
      const {
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        mode = 'new',
        revisionInstructions,
      } = req.body;
      const userId = req.user.userId;

      if (!sourceType || !sourceText) {
        return res.status(400).json({
          error: 'sourceType and sourceText are required',
        });
      }

      if (!generationInputs) {
        return res.status(400).json({
          error: 'generationInputs are required',
        });
      }

      // Check permissions
      const document = await documentService.getDocumentById(id);
      const userRole = req.user.role;

      if (document.status === 'IN_REVIEW' && userRole === 'READER') {
        return res.status(403).json({
          error: 'You cannot generate content while document is in review',
        });
      }

      const version = await documentService.generateContent({
        documentId: id,
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        mode,
        revisionInstructions,
        userId,
      });

      res.status(201).json(version);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit document for review
   * POST /api/documents/:id/submit
   */
  async submitForReview(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Check ownership or permissions
      const document = await documentService.getDocumentById(id);
      const isOwner = document.ownerUserId === userId;

      if (!isOwner && req.user.role === 'READER') {
        return res.status(403).json({
          error: 'You do not have permission to submit this document',
        });
      }

      const updatedDocument = await documentService.submitForReview(id, userId);

      res.json(updatedDocument);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve document
   * POST /api/documents/:id/approve
   */
  async approveDocument(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { notes } = req.body;

      // Only EDITOR or WRITER can approve
      if (req.user.role === 'READER') {
        return res.status(403).json({
          error: 'Only editors can approve documents',
        });
      }

      const updatedDocument = await documentService.approveDocument(id, userId, notes);

      res.json(updatedDocument);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject document
   * POST /api/documents/:id/reject
   */
  async rejectDocument(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { notes, htmlContent } = req.body;

      // Only EDITOR or WRITER can reject
      if (req.user.role === 'READER') {
        return res.status(403).json({
          error: 'Only editors can reject documents',
        });
      }

      if (!notes || notes.trim().length < 10) {
        return res.status(400).json({
          error: 'Rejection notes must be at least 10 characters',
        });
      }

      const result = await documentService.rejectDocument({
        documentId: id,
        userId,
        notes,
        htmlContent,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add review note
   * POST /api/documents/:id/review-note
   */
  async addReviewNote(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { versionId, notes } = req.body;

      // Only EDITOR or WRITER can add review notes
      if (req.user.role === 'READER') {
        return res.status(403).json({
          error: 'Only editors can add review notes',
        });
      }

      const reviewEvent = await documentService.addReviewNote({
        documentId: id,
        versionId,
        notes,
        userId,
      });

      res.status(201).json(reviewEvent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get review events
   * GET /api/documents/:id/review-events
   */
  async getReviewEvents(req, res, next) {
    try {
      const { id } = req.params;
      const events = await documentService.getReviewEvents(id);

      res.json(events);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit log
   * GET /api/documents/:id/audit-log
   */
  async getAuditLog(req, res, next) {
    try {
      const { id } = req.params;
      const logs = await documentService.getAuditLog(id);

      res.json(logs);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DocumentController();
