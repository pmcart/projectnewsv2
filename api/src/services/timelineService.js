const prisma = require('../config/prisma');
const timelineGenerationService = require('./timelineGenerationService');

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true
};

class TimelineService {
  /**
   * Create a timeline and immediately start AI generation
   * @param {Object} params
   * @param {string} params.tweetId - Source tweet ID from breaking news
   * @param {string} params.text - Source tweet text
   * @param {string} [params.account] - Source account name
   * @param {number} params.ownerUserId
   * @param {number} params.organizationId
   * @returns {Promise<Object>} Created timeline (status will be GENERATING)
   */
  async createAndGenerate({ tweetId, text, account, ownerUserId, organizationId }) {
    // Create the timeline record
    const timeline = await prisma.timeline.create({
      data: {
        title: `Timeline: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`,
        status: 'GENERATING',
        ownerUserId,
        organizationId,
        sourceTweetId: tweetId,
        sourceText: text,
        sourceAccount: account || null,
      },
      include: {
        owner: { select: USER_SELECT },
        events: true
      }
    });

    // Fire-and-forget: generate in background
    this.generateTimelineEvents(timeline.id, text, account)
      .then(() => console.log(`Timeline ${timeline.id} generated successfully`))
      .catch((err) => {
        console.error(`Timeline ${timeline.id} generation failed:`, err);
        prisma.timeline.update({
          where: { id: timeline.id },
          data: { status: 'FAILED', errorMessage: err.message }
        }).catch(console.error);
      });

    return timeline;
  }

  /**
   * Generate timeline events using OpenAI (called internally)
   */
  async generateTimelineEvents(timelineId, sourceText, sourceAccount) {
    const { events, llmMetadata } = await timelineGenerationService.generateTimeline({
      sourceText,
      sourceAccount,
    });

    if (!timelineGenerationService.validateTimelineResponse(events)) {
      throw new Error('Invalid timeline structure received from OpenAI');
    }

    // Use a transaction to create all events and update the timeline
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        await tx.timelineEvent.create({
          data: {
            timelineId,
            sortOrder: i,
            eventDate: event.date,
            title: event.title.substring(0, 255),
            description: event.description,
            category: event.category.toUpperCase(),
            significance: Math.min(5, Math.max(1, event.significance || 3)),
            sources: event.sources || [],
          }
        });
      }

      await tx.timeline.update({
        where: { id: timelineId },
        data: {
          status: 'GENERATED',
          llmMetadata,
        }
      });
    });
  }

  /**
   * Get timeline by ID with events and notes
   * @param {string} id
   * @param {number} [organizationId] - If provided, validates org access
   * @returns {Promise<Object>} Timeline with events and notes
   */
  async getTimelineById(id, organizationId = null) {
    const timeline = await prisma.timeline.findUnique({
      where: { id },
      include: {
        owner: { select: USER_SELECT },
        events: {
          orderBy: { sortOrder: 'asc' },
          include: {
            notes: {
              include: {
                createdBy: { select: USER_SELECT }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!timeline) {
      const error = new Error('Timeline not found');
      error.status = 404;
      throw error;
    }

    if (organizationId !== null && timeline.organizationId !== organizationId) {
      const error = new Error('Access denied: Timeline belongs to a different organization');
      error.status = 403;
      throw error;
    }

    return timeline;
  }

  /**
   * Find an existing timeline by source tweet ID within an organization
   * @param {string} tweetId
   * @param {number} organizationId
   * @returns {Promise<Object|null>} Timeline if found, null otherwise
   */
  async getByTweetId(tweetId, organizationId) {
    const timeline = await prisma.timeline.findFirst({
      where: {
        sourceTweetId: tweetId,
        organizationId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: { select: USER_SELECT },
        _count: { select: { events: true } }
      }
    });

    return timeline;
  }

  /**
   * Delete a timeline
   * @param {string} id
   * @param {number} organizationId
   */
  async deleteTimeline(id, organizationId) {
    await this.getTimelineById(id, organizationId);
    await prisma.timeline.delete({ where: { id } });
  }

  /**
   * Add a note to a timeline event
   * @param {Object} params
   * @param {string} params.timelineId - Timeline ID (for org validation)
   * @param {string} params.timelineEventId - Event to attach note to
   * @param {string} params.content - Note content
   * @param {number} params.userId - User creating the note
   * @param {number} params.organizationId - For access validation
   * @returns {Promise<Object>} Created note
   */
  async addNote({ timelineId, timelineEventId, content, userId, organizationId }) {
    // Validate org access
    await this.getTimelineById(timelineId, organizationId);

    return prisma.timelineNote.create({
      data: {
        timelineEventId,
        content,
        createdByUserId: userId,
      },
      include: {
        createdBy: { select: USER_SELECT }
      }
    });
  }

  /**
   * Update a note
   * @param {Object} params
   * @param {string} params.noteId
   * @param {string} params.content
   * @param {number} params.userId
   * @returns {Promise<Object>} Updated note
   */
  async updateNote({ noteId, content, userId }) {
    const note = await prisma.timelineNote.findUnique({ where: { id: noteId } });

    if (!note) {
      const error = new Error('Note not found');
      error.status = 404;
      throw error;
    }

    if (note.createdByUserId !== userId) {
      const error = new Error('You can only edit your own notes');
      error.status = 403;
      throw error;
    }

    return prisma.timelineNote.update({
      where: { id: noteId },
      data: { content },
      include: {
        createdBy: { select: USER_SELECT }
      }
    });
  }

  /**
   * Delete a note
   * @param {string} noteId
   * @param {number} userId
   */
  async deleteNote(noteId, userId) {
    const note = await prisma.timelineNote.findUnique({ where: { id: noteId } });

    if (!note) {
      const error = new Error('Note not found');
      error.status = 404;
      throw error;
    }

    if (note.createdByUserId !== userId) {
      const error = new Error('You can only delete your own notes');
      error.status = 403;
      throw error;
    }

    await prisma.timelineNote.delete({ where: { id: noteId } });
  }
}

module.exports = new TimelineService();
