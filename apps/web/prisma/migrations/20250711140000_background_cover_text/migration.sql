-- Optional text overlay applied after AI generation (Pillow post-process).
ALTER TABLE "MixBackground" ADD COLUMN IF NOT EXISTS "coverText" TEXT;
