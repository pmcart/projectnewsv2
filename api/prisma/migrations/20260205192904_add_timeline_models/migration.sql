-- CreateEnum
CREATE TYPE "TimelineStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "TimelineEventCategory" AS ENUM ('INCIDENT', 'SIGNAL', 'PATTERN', 'RESPONSE', 'ESCALATION', 'CONTEXT');

-- CreateTable
CREATE TABLE "timelines" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TimelineStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "sourceTweetId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceAccount" TEXT,
    "llmMetadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "id" TEXT NOT NULL,
    "timelineId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "eventDate" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TimelineEventCategory" NOT NULL DEFAULT 'INCIDENT',
    "significance" INTEGER NOT NULL DEFAULT 3,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_notes" (
    "id" TEXT NOT NULL,
    "timelineEventId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timelines_organizationId_idx" ON "timelines"("organizationId");

-- CreateIndex
CREATE INDEX "timelines_ownerUserId_idx" ON "timelines"("ownerUserId");

-- CreateIndex
CREATE INDEX "timelines_createdAt_idx" ON "timelines"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "timeline_events_timelineId_idx" ON "timeline_events"("timelineId");

-- CreateIndex
CREATE INDEX "timeline_notes_timelineEventId_idx" ON "timeline_notes"("timelineEventId");

-- AddForeignKey
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timelines" ADD CONSTRAINT "timelines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_notes" ADD CONSTRAINT "timeline_notes_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "timeline_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_notes" ADD CONSTRAINT "timeline_notes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
