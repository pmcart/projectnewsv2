const videoService = require('../services/videoService');
const ffmpegRenderService = require('../services/ffmpegRenderService');

class VideoController {
  /**
   * List all videos with optional filters
   * GET /api/videos
   */
  async listVideos(req, res, next) {
    try {
      const { status, userId } = req.query;
      const currentUserId = req.user.userId;
      const userRole = req.user.role;

      const videos = await videoService.listVideos({
        status,
        userId,
        currentUserId,
        userRole
      });

      res.json(videos);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new video
   * POST /api/videos
   */
  async createVideo(req, res, next) {
    try {
      const { title, sourceType, sourceText, sourceUrl } = req.body;
      const ownerUserId = req.user.userId;

      if (!title) {
        return res.status(400).json({
          error: 'Title is required',
        });
      }

      if (!sourceType || !sourceText) {
        return res.status(400).json({
          error: 'sourceType and sourceText are required',
        });
      }

      const video = await videoService.createVideo({
        title,
        sourceType,
        sourceText,
        sourceUrl,
        ownerUserId,
      });

      res.status(201).json(video);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get video by ID
   * GET /api/videos/:id
   */
  async getVideo(req, res, next) {
    try {
      const { id } = req.params;

      // Get video with pre-signed URLs for assets
      const video = await videoService.getVideoByIdWithSignedUrls(id);

      // Check permissions (similar to documents)
      const userRole = req.user.role;
      const isOwner = video.ownerUserId === req.user.userId;

      // For now, allow all authenticated users to view
      // In production, you might want stricter controls

      res.json(video);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate video plan using OpenAI
   * POST /api/videos/:id/generate
   */
  async generateVideoPlan(req, res, next) {
    try {
      const { id } = req.params;
      const {
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs
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
      const video = await videoService.getVideoById(id);
      const userRole = req.user.role;
      const isOwner = video.ownerUserId === userId;

      if (!isOwner && userRole !== 'EDITOR') {
        return res.status(403).json({
          error: 'You do not have permission to generate content for this video',
        });
      }

      if (video.status === 'IN_REVIEW' && userRole === 'READER') {
        return res.status(403).json({
          error: 'You cannot generate content while video is in review',
        });
      }

      const updatedVideo = await videoService.generateVideoPlan({
        videoId: id,
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs,
        userId,
      });

      // Enrich with signed URLs (though assets will likely still be generating)
      const enrichedVideo = await videoService.enrichWithSignedUrls(updatedVideo);

      res.json(enrichedVideo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit video for review
   * POST /api/videos/:id/submit
   */
  async submitForReview(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Check ownership or permissions
      const video = await videoService.getVideoById(id);
      const isOwner = video.ownerUserId === userId;

      if (!isOwner && req.user.role === 'READER') {
        return res.status(403).json({
          error: 'You do not have permission to submit this video',
        });
      }

      const updatedVideo = await videoService.submitForReview(id, userId);

      res.json(updatedVideo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve video
   * POST /api/videos/:id/approve
   */
  async approveVideo(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { notes } = req.body;

      // Only EDITOR or WRITER can approve
      if (req.user.role === 'READER') {
        return res.status(403).json({
          error: 'Only editors can approve videos',
        });
      }

      const updatedVideo = await videoService.approveVideo(id, userId, notes);

      res.json(updatedVideo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject video
   * POST /api/videos/:id/reject
   */
  async rejectVideo(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { notes } = req.body;

      // Only EDITOR or WRITER can reject
      if (req.user.role === 'READER') {
        return res.status(403).json({
          error: 'Only editors can reject videos',
        });
      }

      if (!notes || notes.trim().length < 10) {
        return res.status(400).json({
          error: 'Rejection notes must be at least 10 characters',
        });
      }

      const updatedVideo = await videoService.rejectVideo({
        videoId: id,
        userId,
        notes,
      });

      res.json(updatedVideo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add review note
   * POST /api/videos/:id/review-note
   */
  async addReviewNote(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { notes } = req.body;

      // Only EDITOR or WRITER can add review notes
      if (req.user.role === 'READER') {
        return res.status(403).json({
          error: 'Only editors can add review notes',
        });
      }

      const reviewEvent = await videoService.addReviewNote({
        videoId: id,
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
   * GET /api/videos/:id/review-events
   */
  async getReviewEvents(req, res, next) {
    try {
      const { id } = req.params;
      const events = await videoService.getReviewEvents(id);

      res.json(events);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update video assets (after actual video generation)
   * PUT /api/videos/:id/assets
   */
  async updateAssets(req, res, next) {
    try {
      const { id } = req.params;
      const { videoUrl, thumbnailUrl, duration } = req.body;
      const userId = req.user.userId;

      // Check permissions
      const video = await videoService.getVideoById(id);
      const isOwner = video.ownerUserId === userId;

      if (!isOwner && req.user.role !== 'EDITOR') {
        return res.status(403).json({
          error: 'You do not have permission to update this video',
        });
      }

      const updatedVideo = await videoService.updateVideoAssets({
        videoId: id,
        videoUrl,
        thumbnailUrl,
        duration,
      });

      res.json(updatedVideo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Render video using FFmpeg
   * POST /api/videos/:id/render
   */
  async renderVideo(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Check permissions
      const video = await videoService.getVideoById(id);
      const isOwner = video.ownerUserId === userId;

      if (!isOwner && req.user.role !== 'EDITOR') {
        return res.status(403).json({
          error: 'You do not have permission to render this video',
        });
      }

      // Check that assets are ready
      if (video.assetStatus !== 'COMPLETED' && video.assetStatus !== 'PARTIAL') {
        return res.status(400).json({
          error: 'Assets must be generated before rendering. Current status: ' + video.assetStatus,
        });
      }

      // Start rendering in the background (fire-and-forget)
      ffmpegRenderService.renderVideo(id).then((result) => {
        console.log(`Video ${id} rendered successfully:`, result);
      }).catch((error) => {
        console.error(`Video ${id} render failed:`, error);
      });

      // Return immediately with updated status
      const updatedVideo = await videoService.getVideoByIdWithSignedUrls(id);

      res.json({
        message: 'Video rendering started',
        video: updatedVideo,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new VideoController();
