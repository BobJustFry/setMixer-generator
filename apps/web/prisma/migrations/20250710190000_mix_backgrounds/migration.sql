CREATE TABLE IF NOT EXISTS "MixBackground" (
    "id" TEXT NOT NULL,
    "mixId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "prompt" TEXT,
    "label" TEXT,
    "imagePath" TEXT,
    "width" INTEGER NOT NULL DEFAULT 1920,
    "height" INTEGER NOT NULL DEFAULT 1080,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MixBackground_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MixBackground_mixId_idx" ON "MixBackground"("mixId");

ALTER TABLE "MixBackground" ADD CONSTRAINT "MixBackground_mixId_fkey"
    FOREIGN KEY ("mixId") REFERENCES "Mix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "backgroundId" TEXT;

ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_backgroundId_fkey"
    FOREIGN KEY ("backgroundId") REFERENCES "MixBackground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BackgroundTask" ADD COLUMN IF NOT EXISTS "mixBackgroundId" TEXT;
