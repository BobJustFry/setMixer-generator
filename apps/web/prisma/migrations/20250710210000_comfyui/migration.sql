ALTER TABLE "AppSettings" DROP COLUMN IF EXISTS "replicateApiToken";
ALTER TABLE "AppSettings" DROP COLUMN IF EXISTS "replicateConnected";
ALTER TABLE "AppSettings" DROP COLUMN IF EXISTS "replicateLastError";

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "comfyuiUrl" TEXT DEFAULT 'http://host.docker.internal:8188';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "comfyuiCheckpoint" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "comfyuiConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "comfyuiLastError" TEXT;
