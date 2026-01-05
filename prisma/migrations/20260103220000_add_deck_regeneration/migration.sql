-- Add deck regeneration fields
ALTER TABLE "StudyDeck"
ADD COLUMN "sourceText" TEXT,
ADD COLUMN "regenerateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRegeneratedAt" TIMESTAMP(3);
