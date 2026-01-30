/*
  Warnings:

  - Added the required column `organizationId` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `videos` table without a default value. This is not possible if the table is not empty.

  MIGRATION STRATEGY: Delete existing data and start fresh with multi-tenancy support.

*/

-- Delete existing data to enable clean migration
DELETE FROM "audit_logs";
DELETE FROM "review_events";
DELETE FROM "document_versions";
DELETE FROM "documents";
DELETE FROM "video_review_events";
DELETE FROM "video_audio";
DELETE FROM "video_images";
DELETE FROM "videos";

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "organizationId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "organizationId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");

-- CreateIndex
CREATE INDEX "videos_organizationId_idx" ON "videos"("organizationId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
