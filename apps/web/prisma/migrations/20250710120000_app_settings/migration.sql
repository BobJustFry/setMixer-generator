-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "encryptionKey" TEXT NOT NULL,
    "youtubeClientId" TEXT,
    "youtubeClientSecret" TEXT,
    "replicateApiToken" TEXT,
    "replicateConnected" BOOLEAN NOT NULL DEFAULT false,
    "replicateLastError" TEXT,
    "appUrl" TEXT NOT NULL DEFAULT 'http://localhost:3000',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
