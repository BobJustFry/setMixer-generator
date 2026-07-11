-- Backgrounds are shared across all mixes (global library).
ALTER TABLE "MixBackground" DROP CONSTRAINT IF EXISTS "MixBackground_mixId_fkey";
ALTER TABLE "MixBackground" ALTER COLUMN "mixId" DROP NOT NULL;
ALTER TABLE "MixBackground" ADD CONSTRAINT "MixBackground_mixId_fkey"
    FOREIGN KEY ("mixId") REFERENCES "Mix"("id") ON DELETE SET NULL ON UPDATE CASCADE;
