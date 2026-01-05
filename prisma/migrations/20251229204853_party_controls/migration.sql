-- CreateEnum
CREATE TYPE "PartyMode" AS ENUM ('QUIZ', 'FLASHCARDS');

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "answerRevealedAt" TIMESTAMP(3),
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" "PartyMode" NOT NULL DEFAULT 'QUIZ',
ADD COLUMN     "pauseStartedAt" TIMESTAMP(3),
ADD COLUMN     "pausedMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "questionDurationSec" INTEGER NOT NULL DEFAULT 25;

-- AlterTable
ALTER TABLE "PartyPlayer" ADD COLUMN     "bonusScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kickedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PartySubmission" ADD COLUMN     "timeMs" INTEGER;

-- CreateTable
CREATE TABLE "PartyFlashcardSubmission" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "partyPlayerId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "knewIt" BOOLEAN NOT NULL,
    "timeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyFlashcardSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyFlashcardSubmission_partyId_flashcardId_idx" ON "PartyFlashcardSubmission"("partyId", "flashcardId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyFlashcardSubmission_partyPlayerId_flashcardId_key" ON "PartyFlashcardSubmission"("partyPlayerId", "flashcardId");

-- AddForeignKey
ALTER TABLE "PartyFlashcardSubmission" ADD CONSTRAINT "PartyFlashcardSubmission_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyFlashcardSubmission" ADD CONSTRAINT "PartyFlashcardSubmission_partyPlayerId_fkey" FOREIGN KEY ("partyPlayerId") REFERENCES "PartyPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyFlashcardSubmission" ADD CONSTRAINT "PartyFlashcardSubmission_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "StudyFlashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
