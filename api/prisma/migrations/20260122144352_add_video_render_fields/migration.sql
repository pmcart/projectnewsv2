-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "renderProgress" JSONB,
ADD COLUMN     "thumbnailS3Key" TEXT,
ADD COLUMN     "videoS3Key" TEXT;
