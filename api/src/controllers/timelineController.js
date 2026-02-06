const timelineService = require('../services/timelineService');

class TimelineController {
  /**
   * Create a timeline from a breaking news item and trigger AI generation
   * POST /api/timelines
   * Body: { tweetId, text, account }
   */
  async createTimeline(req, res, next) {
    try {
      const { tweetId, text, account } = req.body;
      const ownerUserId = req.user.userId;
      const organizationId = req.user.organizationId;

      if (!tweetId || !text) {
        return res.status(400).json({
          error: 'tweetId and text are required',
        });
      }

      const timeline = await timelineService.createAndGenerate({
        tweetId,
        text,
        account,
        ownerUserId,
        organizationId,
      });

      res.status(201).json(timeline);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get existing timeline for a tweet ID (if one exists)
   * GET /api/timelines/by-tweet/:tweetId
   */
  async getByTweetId(req, res, next) {
    try {
      const { tweetId } = req.params;
      const organizationId = req.user.organizationId;

      const timeline = await timelineService.getByTweetId(tweetId, organizationId);

      if (!timeline) {
        return res.json(null);
      }

      res.json(timeline);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get timeline by ID with events and notes
   * GET /api/timelines/:id
   */
  async getTimeline(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationId;

      const timeline = await timelineService.getTimelineById(id, organizationId);

      res.json(timeline);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Delete a timeline
   * DELETE /api/timelines/:id
   */
  async deleteTimeline(req, res, next) {
    try {
      const { id } = req.params;
      const organizationId = req.user.organizationId;

      await timelineService.deleteTimeline(id, organizationId);

      res.status(204).send();
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Add a note to a timeline event
   * POST /api/timelines/:id/events/:eventId/notes
   * Body: { content }
   */
  async addNote(req, res, next) {
    try {
      const { id: timelineId, eventId } = req.params;
      const { content } = req.body;
      const userId = req.user.userId;
      const organizationId = req.user.organizationId;

      if (!content || !content.trim()) {
        return res.status(400).json({
          error: 'Note content is required',
        });
      }

      const note = await timelineService.addNote({
        timelineId,
        timelineEventId: eventId,
        content: content.trim(),
        userId,
        organizationId,
      });

      res.status(201).json(note);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Update a note
   * PUT /api/timelines/:id/events/:eventId/notes/:noteId
   * Body: { content }
   */
  async updateNote(req, res, next) {
    try {
      const { id: timelineId, noteId } = req.params;
      const { content } = req.body;
      const userId = req.user.userId;
      const organizationId = req.user.organizationId;

      if (!content || !content.trim()) {
        return res.status(400).json({
          error: 'Note content is required',
        });
      }

      // Validate org access
      await timelineService.getTimelineById(timelineId, organizationId);

      const note = await timelineService.updateNote({
        noteId,
        content: content.trim(),
        userId,
      });

      res.json(note);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Delete a note
   * DELETE /api/timelines/:id/events/:eventId/notes/:noteId
   */
  async deleteNote(req, res, next) {
    try {
      const { id: timelineId, noteId } = req.params;
      const userId = req.user.userId;
      const organizationId = req.user.organizationId;

      // Validate org access
      await timelineService.getTimelineById(timelineId, organizationId);

      await timelineService.deleteNote(noteId, userId);

      res.status(204).send();
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new TimelineController();
