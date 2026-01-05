-- Add share edit fields for deck sharing
ALTER TABLE "StudyDeck"
ADD COLUMN "shareEditId" TEXT,
ADD COLUMN "shareExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "StudyDeck_shareEditId_key" ON "StudyDeck"("shareEditId");
