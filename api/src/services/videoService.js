const prisma = require('../config/prisma');
const videoGenerationService = require('./videoGenerationService');
const videoAssetService = require('./videoAssetService');
const s3Service = require('./s3Service');

class VideoService {
  /**
   * Create a new video
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.sourceType
   * @param {string} params.sourceText
   * @param {string} params.sourceUrl
   * @param {number} params.ownerUserId
   * @returns {Promise<Object>} Created video
   */
  async createVideo({ title, sourceType, sourceText, sourceUrl, ownerUserId }) {
    const video = await prisma.video.create({
      data: {
        title,
        sourceType,
        sourceText,
        sourceUrl,
        ownerUserId,
        status: 'DRAFT',
        generationInputs: {}
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    return video;
  }

  /**
   * Generate video plan
   * @param {Object} params
   * @param {string} params.videoId
   * @param {string} params.sourceType
   * @param {string} params.sourceText
   * @param {string} params.sourceUrl
   * @param {Object} params.generationInputs
   * @param {number} params.userId
   * @returns {Promise<Object>} Updated video with plan
   */
  async generateVideoPlan({ videoId, sourceType, sourceText, sourceUrl, generationInputs, userId }) {
    // Update status to GENERATING
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'GENERATING' }
    });

    try {
      // Call OpenAI to generate the video plan
      const { videoPlan, llmMetadata } = await videoGenerationService.generateVideoPlan({
        sourceType,
        sourceText,
        sourceUrl,
        generationInputs
      });

      // Validate the plan
      if (!videoGenerationService.validateVideoPlan(videoPlan)) {
        throw new Error('Invalid video plan structure received from OpenAI');
      }

      // Update video with plan and metadata
      const updatedVideo = await prisma.video.update({
        where: { id: videoId },
        data: {
          videoPlan,
          llmMetadata,
          generationInputs,
          sourceType,
          sourceText,
          sourceUrl,
          status: 'GENERATED',
          assetStatus: 'PENDING',
          assetProgress: {
            totalScenes: videoPlan.scenes?.length || 0,
            imagesCompleted: 0,
            audioCompleted: 0,
            imagesFailed: 0,
            audioFailed: 0
          },
          updatedAt: new Date()
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          },
          images: {
            orderBy: { sceneNumber: 'asc' }
          },
          audio: {
            orderBy: { sceneNumber: 'asc' }
          }
        }
      });

      // Start asset generation asynchronously (fire-and-forget)
      // This allows the API to return immediately while assets generate in the background
      console.log(`Starting async asset generation for video ${videoId}...`);
      videoAssetService.generateAllAssets({ videoId }).then((assetResults) => {
        console.log(`Asset generation complete for video ${videoId}. Images: ${assetResults.images.length}, Audio: ${assetResults.audio.length}, Errors: ${assetResults.errors.length}`);
      }).catch((assetError) => {
        console.error(`Error generating video assets for ${videoId}:`, assetError);
        // Update status to FAILED
        prisma.video.update({
          where: { id: videoId },
          data: {
            assetStatus: 'FAILED',
            assetError: `Asset generation failed: ${assetError.message}`
          }
        }).catch(console.error);
      });

      return updatedVideo;
    } catch (error) {
      // Update status to FAILED with error message
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'FAILED',
          errorMessage: error.message
        }
      });

      throw error;
    }
  }

  /**
   * Get video by ID
   * @param {string} id
   * @returns {Promise<Object>} Video
   */
  async getVideoById(id) {
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        reviewEvents: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        images: {
          orderBy: { sceneNumber: 'asc' }
        },
        audio: {
          orderBy: { sceneNumber: 'asc' }
        }
      }
    });

    if (!video) {
      throw new Error('Video not found');
    }

    return video;
  }

  /**
   * List videos with filters
   * @param {Object} params
   * @param {string} params.status
   * @param {number} params.userId
   * @param {number} params.currentUserId
   * @param {string} params.userRole
   * @returns {Promise<Array>} List of videos
   */
  async listVideos({ status, userId, currentUserId, userRole }) {
    const where = {};

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by user if specified
    if (userId) {
      where.ownerUserId = parseInt(userId);
    } else if (userRole === 'READER' || userRole === 'WRITER') {
      // READERs and WRITERs see only their own videos
      where.ownerUserId = currentUserId;
    }
    // EDITORs see all videos (no filter)

    const videos = await prisma.video.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return videos;
  }

  /**
   * Submit video for review
   * @param {string} videoId
   * @param {number} userId
   * @returns {Promise<Object>} Updated video
   */
  async submitForReview(videoId, userId) {
    const video = await this.getVideoById(videoId);

    if (video.status !== 'DRAFT' && video.status !== 'GENERATED') {
      throw new Error('Only draft or generated videos can be submitted for review');
    }

    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: { status: 'IN_REVIEW' },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Create review event
    await prisma.videoReviewEvent.create({
      data: {
        videoId,
        eventType: 'SUBMITTED',
        createdByUserId: userId
      }
    });

    return updatedVideo;
  }

  /**
   * Approve video
   * @param {string} videoId
   * @param {number} userId
   * @param {string} notes
   * @returns {Promise<Object>} Updated video
   */
  async approveVideo(videoId, userId, notes) {
    const video = await this.getVideoById(videoId);

    if (video.status !== 'IN_REVIEW') {
      throw new Error('Only videos in review can be approved');
    }

    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: { status: 'APPROVED' },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Create review event
    await prisma.videoReviewEvent.create({
      data: {
        videoId,
        eventType: 'APPROVED',
        notes,
        createdByUserId: userId
      }
    });

    return updatedVideo;
  }

  /**
   * Reject video
   * @param {Object} params
   * @param {string} params.videoId
   * @param {number} params.userId
   * @param {string} params.notes
   * @returns {Promise<Object>} Updated video
   */
  async rejectVideo({ videoId, userId, notes }) {
    const video = await this.getVideoById(videoId);

    if (video.status !== 'IN_REVIEW') {
      throw new Error('Only videos in review can be rejected');
    }

    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: { status: 'DRAFT' },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Create review event
    await prisma.videoReviewEvent.create({
      data: {
        videoId,
        eventType: 'REJECTED',
        notes,
        createdByUserId: userId
      }
    });

    return updatedVideo;
  }

  /**
   * Add review note
   * @param {Object} params
   * @param {string} params.videoId
   * @param {string} params.notes
   * @param {number} params.userId
   * @returns {Promise<Object>} Review event
   */
  async addReviewNote({ videoId, notes, userId }) {
    const reviewEvent = await prisma.videoReviewEvent.create({
      data: {
        videoId,
        eventType: 'NOTE',
        notes,
        createdByUserId: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    return reviewEvent;
  }

  /**
   * Get review events for a video
   * @param {string} videoId
   * @returns {Promise<Array>} Review events
   */
  async getReviewEvents(videoId) {
    const events = await prisma.videoReviewEvent.findMany({
      where: { videoId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return events;
  }

  /**
   * Update video assets (after actual video generation)
   * @param {Object} params
   * @param {string} params.videoId
   * @param {string} params.videoUrl
   * @param {string} params.thumbnailUrl
   * @param {number} params.duration
   * @returns {Promise<Object>} Updated video
   */
  async updateVideoAssets({ videoId, videoUrl, thumbnailUrl, duration }) {
    const updatedVideo = await prisma.video.update({
      where: { id: videoId },
      data: {
        videoUrl,
        thumbnailUrl,
        duration
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      }
    });

    return updatedVideo;
  }

  /**
   * Enrich video with pre-signed URLs for images, audio, and rendered video
   * @param {Object} video - Video object with images and audio arrays
   * @param {number} [expiresIn=3600] - URL expiration time in seconds
   * @returns {Promise<Object>} Video with signedUrl added to each asset
   */
  async enrichWithSignedUrls(video, expiresIn = 3600) {
    if (!video) return video;

    // Enrich images with signed URLs
    if (video.images && video.images.length > 0) {
      video.images = await Promise.all(
        video.images.map(async (image) => {
          if (image.s3Key && !image.errorMessage) {
            try {
              image.signedUrl = await s3Service.getSignedUrl(image.s3Key, expiresIn);
            } catch (err) {
              console.error(`Failed to generate signed URL for image ${image.id}:`, err);
              image.signedUrl = null;
            }
          }
          return image;
        })
      );
    }

    // Enrich audio with signed URLs
    if (video.audio && video.audio.length > 0) {
      video.audio = await Promise.all(
        video.audio.map(async (audioItem) => {
          if (audioItem.s3Key && !audioItem.errorMessage) {
            try {
              audioItem.signedUrl = await s3Service.getSignedUrl(audioItem.s3Key, expiresIn);
            } catch (err) {
              console.error(`Failed to generate signed URL for audio ${audioItem.id}:`, err);
              audioItem.signedUrl = null;
            }
          }
          return audioItem;
        })
      );
    }

    // Enrich rendered video with signed URL
    if (video.videoS3Key) {
      try {
        video.videoSignedUrl = await s3Service.getSignedUrl(video.videoS3Key, expiresIn);
      } catch (err) {
        console.error(`Failed to generate signed URL for video ${video.id}:`, err);
        video.videoSignedUrl = null;
      }
    }

    // Enrich thumbnail with signed URL
    if (video.thumbnailS3Key) {
      try {
        video.thumbnailSignedUrl = await s3Service.getSignedUrl(video.thumbnailS3Key, expiresIn);
      } catch (err) {
        console.error(`Failed to generate signed URL for thumbnail ${video.id}:`, err);
        video.thumbnailSignedUrl = null;
      }
    }

    return video;
  }

  /**
   * Get video by ID with pre-signed URLs for assets
   * @param {string} id
   * @returns {Promise<Object>} Video with signed URLs
   */
  async getVideoByIdWithSignedUrls(id) {
    const video = await this.getVideoById(id);
    return this.enrichWithSignedUrls(video);
  }
}

module.exports = new VideoService();
