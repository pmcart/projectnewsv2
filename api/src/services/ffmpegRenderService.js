const { spawn } = require('child_process');
const fs = require('fs').promises;
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
   * Uses -shortest to match video duration to audio duration
   * Adds visual effects (zoom, pan, ken burns) for variety
   */
  async createSceneClip({ imagePath, audioPath, outputPath, aspectRatio = '16:9', effectType = 'zoomIn' }) {
    let width = 1920, height = 1080;
    if (aspectRatio === '9:16') { width = 1080; height = 1920; }
    else if (aspectRatio === '1:1') { width = 1080; height = 1080; }

    // Settings for smooth Ken Burns effect
    // Key: scale image UP first (4x), then zoompan works on high-res image for smooth results
    const fps = 25;
    const maxFrames = 1500; // 60 seconds at 25fps
    const scaledWidth = width * 4;  // Scale up 4x for smooth zoompan
    const scaledHeight = height * 4;

    // Base zoompan settings - output at final resolution
    const baseSettings = `:d=${maxFrames}:s=${width}x${height}:fps=${fps}`;

    let zoompanFilter;
    switch (effectType) {
      case 'zoomIn':
        // Zoom into center - accumulative zoom with zoom+0.001
        zoompanFilter = `zoompan=z='min(zoom+0.0008,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'${baseSettings}`;
        break;
      case 'zoomOut':
        // Zoom out from center - start zoomed, decrease
        zoompanFilter = `zoompan=z='if(eq(on,0),1.5,max(zoom-0.0008,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'${baseSettings}`;
        break;
      case 'panLeft':
        // Pan from right to left with slight zoom
        zoompanFilter = `zoompan=z='1.2':x='if(eq(on,0),iw/5,max(x-1,0))':y='ih/2-(ih/zoom/2)'${baseSettings}`;
        break;
      case 'panRight':
        // Pan from left to right with slight zoom
        zoompanFilter = `zoompan=z='1.2':x='if(eq(on,0),0,min(x+1,iw/5))':y='ih/2-(ih/zoom/2)'${baseSettings}`;
        break;
      case 'kenBurns':
        // Classic Ken Burns: zoom in while panning
        zoompanFilter = `zoompan=z='min(zoom+0.0006,1.4)':x='if(eq(on,0),0,min(x+0.5,iw/6))':y='ih/2-(ih/zoom/2)'${baseSettings}`;
        break;
      default:
        // Default: gentle zoom to center
        zoompanFilter = `zoompan=z='min(zoom+0.0006,1.4)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'${baseSettings}`;
    }

    // Full filter: scale up first for smooth results, then apply zoompan
    const filter = `scale=${scaledWidth}:${scaledHeight}:flags=lanczos,${zoompanFilter}`;

    console.log(`Creating clip with effect: ${effectType}`);

    const args = [
      '-y',
      '-loop', '1',
      '-i', imagePath,
      '-i', audioPath,
      '-vf', filter,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
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

        // Cycle through different effects for visual variety
        const effects = ['zoomIn', 'panRight', 'zoomOut', 'panLeft', 'kenBurns'];
        const effectType = effects[i % effects.length];

        console.log(`Creating clip for scene ${sceneNumber} with effect: ${effectType}`);
        await this.createSceneClip({ imagePath, audioPath, outputPath: clipPath, aspectRatio, effectType });

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
