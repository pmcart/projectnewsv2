const prisma = require('../config/prisma');
const contentGenerationService = require('./contentGenerationService');

class DocumentService {
  /**
   * List documents with filters
   * @param {Object} filters
   * @param {string} [filters.status] - Filter by status
   * @param {number} [filters.userId] - Filter by owner
   * @param {number} filters.currentUserId - Current user ID
   * @param {string} filters.userRole - Current user role
   * @returns {Promise<Array>}
   */
  async listDocuments({ status, userId, currentUserId, userRole }) {
    const where = {};

    // Apply status filter
    if (status) {
      where.status = status;
    }

    // Apply user filter
    if (userId) {
      where.ownerUserId = parseInt(userId);
    }

    // For READER role, only show their own documents
    if (userRole === 'READER') {
      where.ownerUserId = currentUserId;
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        reviewEvents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Transform to include latestVersion
    return documents.map(doc => ({
      ...doc,
      latestVersion: doc.versions[0] || null,
      latestReviewEvent: doc.reviewEvents[0] || null,
      versions: undefined,
      reviewEvents: undefined
    }));
  }

  /**
   * Create a new document
   * @param {Object} data
   * @param {string} data.title
   * @param {string} data.type - DocumentType enum
   * @param {number} data.ownerUserId
   * @returns {Promise<Object>} Document with initial empty version
   */
  async createDocument({ title, type, ownerUserId }) {
    const document = await prisma.document.create({
      data: {
        title,
        type,
        ownerUserId,
        status: 'DRAFT',
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        documentId: document.id,
        action: 'DOCUMENT_CREATED',
        actorUserId: ownerUserId,
        metadata: { title, type },
      },
    });

    return document;
  }

  /**
   * Get document by ID with latest version
   * @param {string} documentId
   * @returns {Promise<Object>}
   */
  async getDocumentById(documentId) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    return {
      ...document,
      latestVersion: document.versions[0] || null,
      versions: undefined,
    };
  }

  /**
   * Get all versions of a document
   * @param {string} documentId
   * @returns {Promise<Array>}
   */
  async getDocumentVersions(documentId) {
    const versions = await prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return versions;
  }

  /**
   * Get specific version
   * @param {string} versionId
   * @returns {Promise<Object>}
   */
  async getVersionById(versionId) {
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!version) {
      throw new Error('Version not found');
    }

    return version;
  }

  /**
   * Create a new version (manual save)
   * @param {Object} data
   * @param {string} data.documentId
   * @param {string} data.htmlContent
   * @param {string} [data.sourceType]
   * @param {string} [data.sourceText]
   * @param {string} [data.sourceUrl]
   * @param {Object} [data.generationInputs]
   * @param {number} data.createdByUserId
   * @returns {Promise<Object>}
   */
  async createVersion({
    documentId,
    htmlContent,
    sourceType,
    sourceText,
    sourceUrl,
    generationInputs,
    createdByUserId,
  }) {
    // Get latest version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create new version
    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        versionNumber: newVersionNumber,
        htmlContent,
        sourceType: sourceType || 'FREE_TEXT',
        sourceText: sourceText || htmlContent,
        sourceUrl,
        generationInputs,
        createdByUserId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update document's latestVersionId
    await prisma.document.update({
      where: { id: documentId },
      data: {
        latestVersionId: version.id,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        documentId,
        versionId: version.id,
        action: 'SAVED',
        actorUserId: createdByUserId,
        metadata: { versionNumber: newVersionNumber },
      },
    });

    return version;
  }

  /**
   * Generate content using OpenAI
   * @param {Object} data
   * @param {string} data.documentId
   * @param {string} data.sourceType
   * @param {string} data.sourceText
   * @param {string} [data.sourceUrl]
   * @param {Object} data.generationInputs
   * @param {string} [data.mode='new'] - 'new' or 'revise_current'
   * @param {string} [data.revisionInstructions]
   * @param {number} data.userId
   * @returns {Promise<Object>} New version
   */
  async generateContent({
    documentId,
    sourceType,
    sourceText,
    sourceUrl,
    generationInputs,
    mode = 'new',
    revisionInstructions,
    userId,
  }) {
    let result;

    if (mode === 'revise_current') {
      // Get current version
      const latestVersion = await prisma.documentVersion.findFirst({
        where: { documentId },
        orderBy: { versionNumber: 'desc' },
      });

      if (!latestVersion) {
        throw new Error('No existing version to revise');
      }

      result = await contentGenerationService.reviseContent({
        currentHtml: latestVersion.htmlContent,
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        revisionInstructions,
        model: generationInputs.model || 'gpt-4-turbo-preview',
        temperature: generationInputs.temperature || 0.6,
      });
    } else {
      result = await contentGenerationService.generateContent({
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        model: generationInputs.model || 'gpt-4-turbo-preview',
        temperature: generationInputs.temperature || 0.6,
      });
    }

    // Get next version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });

    const newVersionNumber = (latestVersion?.versionNumber || 0) + 1;

    // Create new version with generated content
    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        versionNumber: newVersionNumber,
        htmlContent: result.htmlContent,
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        llmMetadata: result.metadata,
        createdByUserId: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update document's latestVersionId
    await prisma.document.update({
      where: { id: documentId },
      data: {
        latestVersionId: version.id,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        documentId,
        versionId: version.id,
        action: 'GENERATED',
        actorUserId: userId,
        metadata: {
          mode,
          model: result.metadata.model,
          tokens: result.metadata.totalTokens,
        },
      },
    });

    return version;
  }

  /**
   * Submit document for review
   * @param {string} documentId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async submitForReview(documentId, userId) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'DRAFT') {
      throw new Error('Document must be in DRAFT status to submit for review');
    }

    // Update status
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'IN_REVIEW',
        updatedAt: new Date(),
      },
    });

    // Create review event
    await prisma.reviewEvent.create({
      data: {
        documentId,
        eventType: 'SUBMITTED',
        createdByUserId: userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        documentId,
        action: 'SUBMITTED_FOR_REVIEW',
        actorUserId: userId,
      },
    });

    return updatedDocument;
  }

  /**
   * Approve document
   * @param {string} documentId
   * @param {number} userId
   * @param {string} [notes]
   * @returns {Promise<Object>}
   */
  async approveDocument(documentId, userId, notes) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'IN_REVIEW') {
      throw new Error('Document must be in IN_REVIEW status to approve');
    }

    // Update status
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        updatedAt: new Date(),
      },
    });

    // Create review event
    await prisma.reviewEvent.create({
      data: {
        documentId,
        versionId: document.latestVersionId,
        eventType: 'APPROVED',
        notes,
        createdByUserId: userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        documentId,
        versionId: document.latestVersionId,
        action: 'APPROVED',
        actorUserId: userId,
      },
    });

    return updatedDocument;
  }

  /**
   * Reject document and create new version
   * @param {Object} data
   * @param {string} data.documentId
   * @param {number} data.userId
   * @param {string} data.notes - Required rejection notes
   * @param {string} [data.htmlContent] - Optional editor-modified HTML
   * @returns {Promise<{document: Object, newVersion: Object}>}
   */
  async rejectDocument({ documentId, userId, notes, htmlContent }) {
    if (!notes || notes.trim().length < 10) {
      throw new Error('Rejection notes must be at least 10 characters');
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'IN_REVIEW') {
      throw new Error('Document must be in IN_REVIEW status to reject');
    }

    const rejectedVersion = document.versions[0];
    if (!rejectedVersion) {
      throw new Error('No version to reject');
    }

    // Create new version with either editor-modified content or same content
    const newVersionNumber = rejectedVersion.versionNumber + 1;
    const newVersion = await prisma.documentVersion.create({
      data: {
        documentId,
        versionNumber: newVersionNumber,
        parentVersionId: rejectedVersion.id,
        htmlContent: htmlContent || rejectedVersion.htmlContent,
        sourceType: rejectedVersion.sourceType,
        sourceText: rejectedVersion.sourceText,
        sourceUrl: rejectedVersion.sourceUrl,
        generationInputs: rejectedVersion.generationInputs,
        createdByUserId: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Update document status back to DRAFT and update latest version
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'DRAFT',
        latestVersionId: newVersion.id,
        updatedAt: new Date(),
      },
    });

    // Create review event
    await prisma.reviewEvent.create({
      data: {
        documentId,
        versionId: rejectedVersion.id,
        eventType: 'REJECTED',
        notes,
        createdByUserId: userId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        documentId,
        versionId: rejectedVersion.id,
        action: 'REJECTED',
        actorUserId: userId,
        metadata: {
          rejectedVersionNumber: rejectedVersion.versionNumber,
          newVersionNumber,
        },
      },
    });

    return {
      document: updatedDocument,
      newVersion,
    };
  }

  /**
   * Add review note
   * @param {Object} data
   * @param {string} data.documentId
   * @param {string} data.versionId
   * @param {string} data.notes
   * @param {number} data.userId
   * @returns {Promise<Object>}
   */
  async addReviewNote({ documentId, versionId, notes, userId }) {
    const reviewEvent = await prisma.reviewEvent.create({
      data: {
        documentId,
        versionId,
        eventType: 'NOTE',
        notes,
        createdByUserId: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return reviewEvent;
  }

  /**
   * Get review events for a document
   * @param {string} documentId
   * @returns {Promise<Array>}
   */
  async getReviewEvents(documentId) {
    const events = await prisma.reviewEvent.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return events;
  }

  /**
   * Get audit log for a document
   * @param {string} documentId
   * @returns {Promise<Array>}
   */
  async getAuditLog(documentId) {
    const logs = await prisma.auditLog.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return logs;
  }
}

module.exports = new DocumentService();
