-- CreateTable
CREATE TABLE "video_images" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "openaiImageId" TEXT,
    "model" TEXT,
    "revisedPrompt" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_audio" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "narrationText" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT NOT NULL,
    "duration" DOUBLE PRECISION,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "voice" TEXT,
    "model" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_audio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_images_videoId_idx" ON "video_images"("videoId");

-- CreateIndex
CREATE INDEX "video_images_sceneNumber_idx" ON "video_images"("sceneNumber");

-- CreateIndex
CREATE INDEX "video_audio_videoId_idx" ON "video_audio"("videoId");

-- CreateIndex
CREATE INDEX "video_audio_sceneNumber_idx" ON "video_audio"("sceneNumber");

-- AddForeignKey
ALTER TABLE "video_images" ADD CONSTRAINT "video_images_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_audio" ADD CONSTRAINT "video_audio_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
