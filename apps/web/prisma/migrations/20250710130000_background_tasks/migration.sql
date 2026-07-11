-- AlterTable
ALTER TABLE "VideoJob" ADD COLUMN "cancelRequested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BackgroundTask" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "videoJobId" TEXT,
    "uploadId" TEXT,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundTask_status_idx" ON "BackgroundTask"("status");

-- CreateIndex
CREATE INDEX "BackgroundTask_videoJobId_idx" ON "BackgroundTask"("videoJobId");
