-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" INTEGER NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "generationInputs" JSONB NOT NULL,
    "videoPlan" JSONB,
    "llmMetadata" JSONB,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_review_events" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "eventType" "ReviewEventType" NOT NULL,
    "notes" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_review_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "videos_ownerUserId_idx" ON "videos"("ownerUserId");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_createdAt_idx" ON "videos"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "video_review_events_videoId_idx" ON "video_review_events"("videoId");

-- CreateIndex
CREATE INDEX "video_review_events_createdAt_idx" ON "video_review_events"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_review_events" ADD CONSTRAINT "video_review_events_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_review_events" ADD CONSTRAINT "video_review_events_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
