const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const prisma = require('../config/prisma');
const s3Service = require('./s3Service');

class FFmpegRenderService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'video-render');
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {}
  }

  async createWorkingDir(videoId) {
    const workDir = path.join(this.tempDir, `render-${videoId}-${Date.now()}`);
    await fs.mkdir(workDir, { recursive: true });
    return workDir;
  }

  async cleanupWorkDir(workDir) {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup working directory:', error);
    }
  }

  async downloadFromS3(s3Key, localPath) {
    const signedUrl = await s3Service.getSignedUrl(s3Key, 3600);
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download from S3: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(arrayBuffer));
  }

  async getAudioDuration(audioPath) {
    return new Promise((resolve) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audioPath
      ]);

      let output = '';
      ffprobe.stdout.on('data', (data) => { output += data.toString(); });
      ffprobe.on('close', (code) => {
        const duration = parseFloat(output.trim());
        resolve(code === 0 && !isNaN(duration) ? duration : 5);
      });
      ffprobe.on('error', () => resolve(5));
    });
  }

  runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      console.log('FFmpeg command:', 'ffmpeg', args.join(' '));
      const ffmpeg = spawn('ffmpeg', args);

      let errorOutput = '';
      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
        process.stdout.write(data);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}: ${errorOutput}`));
      });
      ffmpeg.on('error', (error) => reject(error));
    });
  }

  /**
   * Create a video clip from image + audio
   * Simple approach: use audio as the duration source with -shortest
   */
  async createSceneClip({ imagePath, audioPath, outputPath, aspectRatio = '16:9' }) {
    let width = 1920, height = 1080;
    if (aspectRatio === '9:16') { width = 1080; height = 1920; }
    else if (aspectRatio === '1:1') { width = 1080; height = 1080; }

    const args = [
      '-y',
      '-loop', '1',
      '-i', imagePath,
      '-i', audioPath,
      '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-pix_fmt', 'yuv420p',
      '-shortest',
      '-movflags', '+faststart',
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  async concatenateClips(clipPaths, outputPath) {
    if (clipPaths.length === 1) {
      await fs.copyFile(clipPaths[0], outputPath);
      return;
    }

    const concatFilePath = path.join(path.dirname(outputPath), 'concat.txt');
    const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(concatFilePath, concatContent);

    const args = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath
    ];

    await this.runFFmpeg(args);
  }

  async generateThumbnail(videoPath, outputPath) {
    const args = ['-y', '-i', videoPath, '-ss', '1', '-vframes', '1', '-q:v', '2', outputPath];
    await this.runFFmpeg(args);
  }

  async updateRenderProgress(videoId, progress) {
    await prisma.video.update({
      where: { id: videoId },
      data: { renderProgress: progress, updatedAt: new Date() }
    });
  }

  async renderVideo(videoId) {
    let workDir = null;

    try {
      const video = await prisma.video.findUnique({
        where: { id: videoId },
        include: {
          images: { orderBy: { sceneNumber: 'asc' } },
          audio: { orderBy: { sceneNumber: 'asc' } }
        }
      });

      if (!video) throw new Error('Video not found');
      if (!video.videoPlan?.scenes) throw new Error('Video plan not found');

      const validImages = video.images.filter(img => img.s3Key && !img.errorMessage);
      if (validImages.length === 0) throw new Error('No valid images to render');

      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'GENERATING', renderProgress: { stage: 'PREPARING', progress: 0 }, errorMessage: null }
      });

      await this.ensureTempDir();
      workDir = await this.createWorkingDir(videoId);

      const { videoPlan, generationInputs } = video;
      const scenes = videoPlan.scenes;
      const aspectRatio = generationInputs?.aspectRatio || '16:9';

      // Build maps
      const audioMap = new Map();
      video.audio.forEach(a => { if (a.s3Key && !a.errorMessage) audioMap.set(a.sceneNumber, a); });

      const imageMap = new Map();
      video.images.forEach(img => { if (img.s3Key && !img.errorMessage) imageMap.set(img.sceneNumber, img); });

      const clipPaths = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneNumber = scene.sceneNumber;

        await this.updateRenderProgress(videoId, {
          stage: 'RENDERING_SCENES',
          currentScene: sceneNumber,
          totalScenes: scenes.length,
          progress: Math.round((i / scenes.length) * 80)
        });

        const image = imageMap.get(sceneNumber);
        const audio = audioMap.get(sceneNumber);

        if (!image) {
          console.warn(`No image for scene ${sceneNumber}, skipping`);
          continue;
        }

        if (!audio) {
          console.warn(`No audio for scene ${sceneNumber}, skipping`);
          continue;
        }

        const imagePath = path.join(workDir, `scene_${sceneNumber}_image.png`);
        const audioPath = path.join(workDir, `scene_${sceneNumber}_audio.mp3`);
        const clipPath = path.join(workDir, `scene_${sceneNumber}_clip.mp4`);

        console.log(`Downloading assets for scene ${sceneNumber}...`);
        await this.downloadFromS3(image.s3Key, imagePath);
        await this.downloadFromS3(audio.s3Key, audioPath);

        console.log(`Creating clip for scene ${sceneNumber}...`);
        await this.createSceneClip({ imagePath, audioPath, outputPath: clipPath, aspectRatio });

        // Verify the clip duration
        const clipDuration = await this.getAudioDuration(clipPath);
        console.log(`Scene ${sceneNumber} clip duration: ${clipDuration.toFixed(2)}s`);

        clipPaths.push(clipPath);
      }

      if (clipPaths.length === 0) throw new Error('No clips were generated');

      await this.updateRenderProgress(videoId, { stage: 'CONCATENATING', progress: 85 });

      const finalVideoPath = path.join(workDir, 'final_video.mp4');
      console.log('Concatenating clips...');
      await this.concatenateClips(clipPaths, finalVideoPath);

      await this.updateRenderProgress(videoId, { stage: 'GENERATING_THUMBNAIL', progress: 90 });

      const thumbnailPath = path.join(workDir, 'thumbnail.jpg');
      await this.generateThumbnail(finalVideoPath, thumbnailPath);

      await this.updateRenderProgress(videoId, { stage: 'UPLOADING', progress: 95 });

      console.log('Uploading to S3...');
      const videoBuffer = await fs.readFile(finalVideoPath);
      const videoKey = s3Service.generateKey('videos/rendered', videoId, 'mp4');
      const { s3Url: videoS3Url } = await s3Service.uploadBuffer({
        buffer: videoBuffer,
        key: videoKey,
        contentType: 'video/mp4',
        metadata: { videoId }
      });

      const thumbnailBuffer = await fs.readFile(thumbnailPath);
      const thumbnailKey = s3Service.generateKey('videos/thumbnails', videoId, 'jpg');
      const { s3Url: thumbnailS3Url } = await s3Service.uploadBuffer({
        buffer: thumbnailBuffer,
        key: thumbnailKey,
        contentType: 'image/jpeg',
        metadata: { videoId }
      });

      const totalDuration = await this.getAudioDuration(finalVideoPath);

      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'GENERATED',
          videoUrl: videoS3Url,
          videoS3Key: videoKey,
          thumbnailUrl: thumbnailS3Url,
          thumbnailS3Key: thumbnailKey,
          duration: Math.round(totalDuration),
          renderProgress: { stage: 'COMPLETED', progress: 100 },
          errorMessage: null
        }
      });

      await this.cleanupWorkDir(workDir);
      console.log('Video rendering complete!');

      return { videoUrl: videoS3Url, thumbnailUrl: thumbnailS3Url, duration: Math.round(totalDuration) };

    } catch (error) {
      console.error('Video rendering failed:', error);

      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'FAILED', errorMessage: error.message, renderProgress: { stage: 'FAILED', error: error.message } }
      });

      if (workDir) await this.cleanupWorkDir(workDir);
      throw error;
    }
  }
}

module.exports = new FFmpegRenderService();
