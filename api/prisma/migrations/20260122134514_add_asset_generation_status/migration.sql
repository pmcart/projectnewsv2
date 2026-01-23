-- CreateEnum
CREATE TYPE "AssetGenerationStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "assetError" TEXT,
ADD COLUMN     "assetProgress" JSONB,
ADD COLUMN     "assetStatus" "AssetGenerationStatus" NOT NULL DEFAULT 'PENDING';
