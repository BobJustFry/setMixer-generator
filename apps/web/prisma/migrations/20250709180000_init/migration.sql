-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mix" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "title" TEXT,
    "durationSec" DOUBLE PRECISION,
    "fileSize" BIGINT,
    "waveformPath" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL,
    "mixId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'kenburns_fade',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT,
    "stylePrompt" TEXT,
    "errorMessage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "videoJobId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startSec" DOUBLE PRECISION NOT NULL,
    "endSec" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "label" TEXT,
    "thumbPrompt" TEXT,
    "thumbPath" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedVideo" (
    "id" TEXT NOT NULL,
    "videoJobId" TEXT NOT NULL,
    "outputPath" TEXT NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "previewPath" TEXT,
    "ffmpegLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeUpload" (
    "id" TEXT NOT NULL,
    "videoJobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "categoryId" TEXT NOT NULL DEFAULT '10',
    "privacyStatus" TEXT NOT NULL DEFAULT 'private',
    "publishAt" TIMESTAMP(3),
    "uploadStatus" TEXT NOT NULL DEFAULT 'draft',
    "youtubeVideoId" TEXT,
    "errorMessage" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeCredential" (
    "id" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "channelTitle" TEXT,
    "channelId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Mix_filepath_key" ON "Mix"("filepath");

-- CreateIndex
CREATE INDEX "VideoJob_status_idx" ON "VideoJob"("status");

-- CreateIndex
CREATE INDEX "VideoJob_mixId_idx" ON "VideoJob"("mixId");

-- CreateIndex
CREATE INDEX "Segment_videoJobId_idx" ON "Segment"("videoJobId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedVideo_videoJobId_key" ON "GeneratedVideo"("videoJobId");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeUpload_videoJobId_key" ON "YouTubeUpload"("videoJobId");

-- AddForeignKey
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_mixId_fkey" FOREIGN KEY ("mixId") REFERENCES "Mix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_videoJobId_fkey" FOREIGN KEY ("videoJobId") REFERENCES "VideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedVideo" ADD CONSTRAINT "GeneratedVideo_videoJobId_fkey" FOREIGN KEY ("videoJobId") REFERENCES "VideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeUpload" ADD CONSTRAINT "YouTubeUpload_videoJobId_fkey" FOREIGN KEY ("videoJobId") REFERENCES "VideoJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
