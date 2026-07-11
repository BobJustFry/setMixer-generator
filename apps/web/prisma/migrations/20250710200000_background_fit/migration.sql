ALTER TABLE "MixBackground" ADD COLUMN "sourceWidth" INTEGER;
ALTER TABLE "MixBackground" ADD COLUMN "sourceHeight" INTEGER;
ALTER TABLE "MixBackground" ADD COLUMN "fitMode" TEXT NOT NULL DEFAULT 'cover';
