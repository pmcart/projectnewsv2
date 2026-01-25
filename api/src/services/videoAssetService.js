const OpenAI = require('openai');
const prisma = require('../config/prisma');
const s3Service = require('./s3Service');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class VideoAssetService {
  /**
   * Map generation inputs voice to OpenAI TTS voice
   * OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
   * - alloy: neutral, balanced
   * - echo: deeper male voice
   * - fable: warm, British accent
   * - onyx: deep, authoritative male
   * - nova: warm, friendly female
   * - shimmer: clear, professional female
   * @param {string} voiceInput - Voice from generationInputs
   * @returns {string} OpenAI voice name
   */
  mapVoiceToOpenAI(voiceInput) {
    const voiceMap = {
      // Neutral voices
      neutral_male: 'alloy',
      neutral_female: 'nova',
      // Authoritative voices
      authoritative_male: 'onyx',
      authoritative_female: 'shimmer',
      // Friendly voices
      friendly_male: 'fable',
      friendly_female: 'nova',
      // Legacy mappings (kept for backwards compatibility)
      professional_male: 'echo',
      professional_female: 'shimmer',
      calm_male: 'onyx',
      calm_female: 'nova',
      energetic_male: 'fable',
      energetic_female: 'shimmer',
    };

    return voiceMap[voiceInput] || 'alloy';
  }

  /**
   * Sanitize a prompt to avoid content filter blocks
   * Makes the prompt more generic and removes potentially problematic content
   * @param {string} prompt - Original prompt
   * @param {number} level - Sanitization level (1-3, higher = more aggressive)
   * @returns {string} Sanitized prompt
   */
  sanitizePrompt(prompt, level = 1) {
    let sanitized = prompt;

    // Level 1: Basic cleanup - remove potentially violent/sensitive terms
    if (level >= 1) {
      const removeTerms = [
        /\b(blood|bloody|gore|gory|violent|violence|death|dead|dying|kill|murder|weapon|gun|knife|attack|war|battle|fight|explosion|bomb|terrorist|terror)\b/gi,
        /\b(nude|naked|sexual|erotic|explicit|nsfw)\b/gi,
        /\b(hate|racist|discrimination)\b/gi,
      ];
      removeTerms.forEach(regex => {
        sanitized = sanitized.replace(regex, '');
      });
    }

    // Level 2: Make it more artistic/abstract
    if (level >= 2) {
      sanitized = `Professional news broadcast style illustration: ${sanitized}. Clean, corporate, appropriate for all audiences.`;
    }

    // Level 3: Very generic fallback
    if (level >= 3) {
      // Extract key nouns/topics and create abstract prompt
      sanitized = `Abstract professional illustration representing news and current events. Modern, clean design with blue and neutral tones. Suitable for news broadcast.`;
    }

    return sanitized.replace(/\s+/g, ' ').trim();
  }

  /**
   * Generate image using DALL-E with retry logic for content filter blocks
   * @param {Object} params
   * @param {string} params.prompt - Image prompt
   * @param {string} [params.size] - Image size (1024x1024, 1792x1024, 1024x1792)
   * @param {number} [params.maxRetries] - Maximum retry attempts
   * @returns {Promise<Object>} Image data with buffer and metadata
   */
  async generateImage({ prompt, size = '1024x1024', maxRetries = 3 }) {
    let lastError = null;
    let currentPrompt = prompt;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Image generation attempt ${attempt + 1}/${maxRetries + 1} with prompt: "${currentPrompt.substring(0, 100)}..."`);

        const response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: currentPrompt,
          n: 1,
          size: size,
          quality: 'hd',
          response_format: 'url',
        });

        const imageData = response.data[0];
        const imageUrl = imageData.url;

        // Download the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.statusText}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (attempt > 0) {
          console.log(`Image generation succeeded on retry ${attempt} with sanitized prompt`);
        }

        return {
          buffer,
          revisedPrompt: imageData.revised_prompt,
          model: 'dall-e-3',
          originalPrompt: prompt,
          usedPrompt: currentPrompt,
          retryAttempt: attempt,
        };
      } catch (error) {
        lastError = error;
        console.error(`Image generation attempt ${attempt + 1} failed:`, error.message);

        // Check if it's a content filter block (400 error)
        const isContentFilter = error.status === 400 ||
          error.message?.includes('content') ||
          error.message?.includes('filter') ||
          error.message?.includes('policy') ||
          error.message?.includes('blocked');

        if (isContentFilter && attempt < maxRetries) {
          // Sanitize prompt with increasing aggressiveness
          const sanitizationLevel = attempt + 1;
          currentPrompt = this.sanitizePrompt(prompt, sanitizationLevel);
          console.log(`Content filter detected. Retrying with sanitization level ${sanitizationLevel}`);
        } else if (attempt < maxRetries) {
          // For other errors, wait briefly and retry with same prompt
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // Max retries reached
          break;
        }
      }
    }

    throw new Error(`Image generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Generate audio using OpenAI TTS with retry logic
   * @param {Object} params
   * @param {string} params.text - Text to convert to speech
   * @param {string} [params.voice] - Voice to use
   * @param {number} [params.maxRetries] - Maximum retry attempts
   * @returns {Promise<Object>} Audio data with buffer and metadata
   */
  async generateAudio({ text, voice = 'alloy', maxRetries = 3 }) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Audio generation attempt ${attempt + 1}/${maxRetries + 1}`);

        const mp3 = await openai.audio.speech.create({
          model: 'tts-1-hd',
          voice: voice,
          input: text,
        });

        const arrayBuffer = await mp3.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (attempt > 0) {
          console.log(`Audio generation succeeded on retry ${attempt}`);
        }

        return {
          buffer,
          voice,
          model: 'tts-1-hd',
        };
      } catch (error) {
        lastError = error;
        console.error(`Audio generation attempt ${attempt + 1} failed:`, error.message);

        if (attempt < maxRetries) {
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`Audio generation failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Generate and store a single image for a scene
   * @param {Object} params
   * @param {string} params.videoId - Video UUID
   * @param {Object} params.scene - Scene object from video plan
   * @param {string} [params.aspectRatio] - Aspect ratio for sizing
   * @returns {Promise<Object>} Created VideoImage record
   */
  async generateAndStoreImage({ videoId, scene, aspectRatio = '16:9' }) {
    const { sceneNumber, imagePrompt } = scene;

    // Map aspect ratio to DALL-E size
    let size = '1024x1024';
    if (aspectRatio === '16:9') {
      size = '1792x1024';
    } else if (aspectRatio === '9:16') {
      size = '1024x1792';
    }

    try {
      // Generate image
      const { buffer, revisedPrompt, model } = await this.generateImage({
        prompt: imagePrompt,
        size,
      });

      // Upload to S3
      const { s3Key, s3Url } = await s3Service.uploadImage({
        buffer,
        videoId,
        sceneNumber,
        metadata: {
          prompt: imagePrompt,
          revisedPrompt,
        },
      });

      // Determine dimensions from size
      const [width, height] = size.split('x').map(Number);

      // Store in database
      const videoImage = await prisma.videoImage.create({
        data: {
          videoId,
          sceneNumber,
          imagePrompt,
          s3Key,
          s3Url,
          width,
          height,
          fileSize: buffer.length,
          mimeType: 'image/png',
          model,
          revisedPrompt,
        },
      });

      return videoImage;
    } catch (error) {
      console.error(`Error generating image for scene ${sceneNumber}:`, error);

      // Store error in database
      const videoImage = await prisma.videoImage.create({
        data: {
          videoId,
          sceneNumber,
          imagePrompt,
          s3Key: '',
          s3Url: '',
          errorMessage: error.message,
        },
      });

      return videoImage;
    }
  }

  /**
   * Generate and store a single audio clip for a scene
   * @param {Object} params
   * @param {string} params.videoId - Video UUID
   * @param {Object} params.scene - Scene object from video plan
   * @param {string} [params.voice] - OpenAI voice name
   * @returns {Promise<Object>} Created VideoAudio record
   */
  async generateAndStoreAudio({ videoId, scene, voice = 'alloy' }) {
    const { sceneNumber, narration } = scene;

    // Skip if no narration
    if (!narration || narration.trim().length === 0) {
      return null;
    }

    try {
      // Generate audio
      const { buffer, voice: usedVoice, model } = await this.generateAudio({
        text: narration,
        voice,
      });

      // Upload to S3
      const { s3Key, s3Url } = await s3Service.uploadAudio({
        buffer,
        videoId,
        sceneNumber,
        metadata: {
          narration,
          voice: usedVoice,
        },
      });

      // Store in database
      const videoAudio = await prisma.videoAudio.create({
        data: {
          videoId,
          sceneNumber,
          narrationText: narration,
          s3Key,
          s3Url,
          fileSize: buffer.length,
          mimeType: 'audio/mpeg',
          voice: usedVoice,
          model,
        },
      });

      return videoAudio;
    } catch (error) {
      console.error(`Error generating audio for scene ${sceneNumber}:`, error);

      // Store error in database
      const videoAudio = await prisma.videoAudio.create({
        data: {
          videoId,
          sceneNumber,
          narrationText: narration,
          s3Key: '',
          s3Url: '',
          errorMessage: error.message,
        },
      });

      return videoAudio;
    }
  }

  /**
   * Update asset generation progress on the video
   * @param {string} videoId
   * @param {Object} progress
   */
  async updateProgress(videoId, progress) {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        assetProgress: progress,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Generate all assets (images and audio) for a video
   * @param {Object} params
   * @param {string} params.videoId - Video UUID
   * @returns {Promise<Object>} Result with generated assets and errors
   */
  async generateAllAssets({ videoId }) {
    // Fetch video with plan
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new Error('Video not found');
    }

    if (!video.videoPlan || !video.videoPlan.scenes) {
      throw new Error('Video plan not found. Generate a plan first.');
    }

    const { videoPlan, generationInputs } = video;
    const scenes = videoPlan.scenes;
    const totalScenes = scenes.length;

    // Extract settings
    const aspectRatio = generationInputs.aspectRatio || '16:9';
    const voiceInput = generationInputs.voice || 'neutral_male';
    const openaiVoice = this.mapVoiceToOpenAI(voiceInput);

    // Initialize progress tracking
    const progress = {
      totalScenes,
      imagesCompleted: 0,
      audioCompleted: 0,
      imagesFailed: 0,
      audioFailed: 0,
    };

    // Update status to GENERATING
    await prisma.video.update({
      where: { id: videoId },
      data: {
        assetStatus: 'GENERATING',
        assetProgress: progress,
        assetError: null,
      },
    });

    const results = {
      images: [],
      audio: [],
      errors: [],
    };

    // Generate ALL images in parallel
    console.log(`Generating ${totalScenes} images in parallel...`);
    const imagePromises = scenes.map(async (scene) => {
      try {
        const imageRecord = await this.generateAndStoreImage({
          videoId,
          scene,
          aspectRatio,
        });

        if (imageRecord.errorMessage) {
          progress.imagesFailed++;
          results.errors.push({
            scene: scene.sceneNumber,
            type: 'image',
            error: imageRecord.errorMessage,
          });
        } else {
          progress.imagesCompleted++;
        }

        // Update progress after each image completes
        await this.updateProgress(videoId, progress);
        return imageRecord;
      } catch (error) {
        progress.imagesFailed++;
        results.errors.push({
          scene: scene.sceneNumber,
          type: 'image',
          error: error.message,
        });
        await this.updateProgress(videoId, progress);
        return null;
      }
    });

    // Wait for all images to complete
    const imageResults = await Promise.all(imagePromises);
    results.images = imageResults.filter((img) => img !== null);

    // Skip audio generation if voice is "none"
    if (voiceInput === 'none') {
      console.log('Voice set to "none", skipping audio generation');
      // Mark all audio as completed (since we're intentionally skipping)
      progress.audioCompleted = totalScenes;
      await this.updateProgress(videoId, progress);
    } else {
      // Generate ALL audio in parallel
      console.log(`Generating ${totalScenes} audio clips in parallel...`);
      const audioPromises = scenes.map(async (scene) => {
        try {
          const audioRecord = await this.generateAndStoreAudio({
            videoId,
            scene,
            voice: openaiVoice,
          });

          if (audioRecord) {
            if (audioRecord.errorMessage) {
              progress.audioFailed++;
              results.errors.push({
                scene: scene.sceneNumber,
                type: 'audio',
                error: audioRecord.errorMessage,
              });
            } else {
              progress.audioCompleted++;
            }
          } else {
            // No narration for this scene, count as completed
            progress.audioCompleted++;
          }

          // Update progress after each audio completes
          await this.updateProgress(videoId, progress);
          return audioRecord;
        } catch (error) {
          progress.audioFailed++;
          results.errors.push({
            scene: scene.sceneNumber,
            type: 'audio',
            error: error.message,
          });
          await this.updateProgress(videoId, progress);
          return null;
        }
      });

      // Wait for all audio to complete
      const audioResults = await Promise.all(audioPromises);
      results.audio = audioResults.filter((aud) => aud !== null);
    }

    // Determine final status
    let finalStatus = 'COMPLETED';
    let assetError = null;

    if (progress.imagesCompleted === 0 && progress.audioCompleted === 0) {
      finalStatus = 'FAILED';
      assetError = `All asset generation failed: ${results.errors.map((e) => `Scene ${e.scene} (${e.type}): ${e.error}`).join('; ')}`;
    } else if (progress.imagesFailed > 0 || progress.audioFailed > 0) {
      finalStatus = 'PARTIAL';
      assetError = `Some assets failed: ${results.errors.map((e) => `Scene ${e.scene} (${e.type}): ${e.error}`).join('; ')}`;
    }

    // Update final status
    await prisma.video.update({
      where: { id: videoId },
      data: {
        assetStatus: finalStatus,
        assetProgress: progress,
        assetError,
      },
    });

    return results;
  }

  /**
   * Delete all assets for a video (cleanup)
   * @param {string} videoId - Video UUID
   * @returns {Promise<void>}
   */
  async deleteVideoAssets(videoId) {
    // Get all images and audio for this video
    const images = await prisma.videoImage.findMany({
      where: { videoId },
    });

    const audio = await prisma.videoAudio.findMany({
      where: { videoId },
    });

    // Collect S3 keys
    const s3Keys = [
      ...images.filter((img) => img.s3Key).map((img) => img.s3Key),
      ...audio.filter((aud) => aud.s3Key).map((aud) => aud.s3Key),
    ];

    // Delete from S3
    if (s3Keys.length > 0) {
      await s3Service.deleteFiles(s3Keys);
    }

    // Delete from database (cascade will handle this)
    await prisma.videoImage.deleteMany({
      where: { videoId },
    });

    await prisma.videoAudio.deleteMany({
      where: { videoId },
    });
  }
}

module.exports = new VideoAssetService();
