const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

class S3Service {
  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET;

    if (!this.bucketName) {
      console.warn('AWS_S3_BUCKET environment variable is not set');
    }
  }

  /**
   * Generate a unique S3 key for a file
   * @param {string} prefix - Folder prefix (e.g., 'videos/images' or 'videos/audio')
   * @param {string} videoId - Video UUID
   * @param {string} extension - File extension (e.g., 'png', 'mp3')
   * @returns {string} S3 key
   */
  generateKey(prefix, videoId, extension) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${prefix}/${videoId}/${timestamp}-${randomString}.${extension}`;
  }

  /**
   * Upload a buffer to S3
   * @param {Object} params
   * @param {Buffer} params.buffer - File buffer
   * @param {string} params.key - S3 key
   * @param {string} params.contentType - MIME type
   * @param {Object} [params.metadata] - Optional metadata
   * @returns {Promise<Object>} Upload result with s3Key and s3Url
   */
  async uploadBuffer({ buffer, key, contentType, metadata = {} }) {
    if (!this.bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    await this.client.send(command);

    const s3Url = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    return {
      s3Key: key,
      s3Url,
    };
  }

  /**
   * Upload image buffer to S3
   * @param {Object} params
   * @param {Buffer} params.buffer - Image buffer
   * @param {string} params.videoId - Video UUID
   * @param {number} params.sceneNumber - Scene number
   * @param {Object} [params.metadata] - Optional metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadImage({ buffer, videoId, sceneNumber, metadata = {} }) {
    const key = this.generateKey('videos/images', videoId, 'png');
    const enhancedMetadata = {
      ...metadata,
      videoId,
      sceneNumber: sceneNumber.toString(),
    };

    return this.uploadBuffer({
      buffer,
      key,
      contentType: 'image/png',
      metadata: enhancedMetadata,
    });
  }

  /**
   * Upload audio buffer to S3
   * @param {Object} params
   * @param {Buffer} params.buffer - Audio buffer
   * @param {string} params.videoId - Video UUID
   * @param {number} params.sceneNumber - Scene number
   * @param {Object} [params.metadata] - Optional metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadAudio({ buffer, videoId, sceneNumber, metadata = {} }) {
    const key = this.generateKey('videos/audio', videoId, 'mp3');
    const enhancedMetadata = {
      ...metadata,
      videoId,
      sceneNumber: sceneNumber.toString(),
    };

    return this.uploadBuffer({
      buffer,
      key,
      contentType: 'audio/mpeg',
      metadata: enhancedMetadata,
    });
  }

  /**
   * Delete a file from S3
   * @param {string} key - S3 key to delete
   * @returns {Promise<void>}
   */
  async deleteFile(key) {
    if (!this.bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Delete multiple files from S3
   * @param {string[]} keys - Array of S3 keys to delete
   * @returns {Promise<void>}
   */
  async deleteFiles(keys) {
    const deletePromises = keys.map((key) => this.deleteFile(key));
    await Promise.all(deletePromises);
  }

  /**
   * Generate a pre-signed URL for reading an object
   * @param {string} key - S3 object key
   * @param {number} [expiresIn=3600] - URL expiration time in seconds (default 1 hour)
   * @returns {Promise<string>} Pre-signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    if (!this.bucketName) {
      throw new Error('S3 bucket name is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
    return signedUrl;
  }

  /**
   * Generate pre-signed URLs for multiple objects
   * @param {string[]} keys - Array of S3 object keys
   * @param {number} [expiresIn=3600] - URL expiration time in seconds
   * @returns {Promise<Object>} Map of key to signed URL
   */
  async getSignedUrls(keys, expiresIn = 3600) {
    const urlPromises = keys.map(async (key) => {
      const signedUrl = await this.getSignedUrl(key, expiresIn);
      return { key, signedUrl };
    });

    const results = await Promise.all(urlPromises);
    return results.reduce((acc, { key, signedUrl }) => {
      acc[key] = signedUrl;
      return acc;
    }, {});
  }
}

module.exports = new S3Service();
