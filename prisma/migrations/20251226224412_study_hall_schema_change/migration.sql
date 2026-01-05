-- CreateEnum
CREATE TYPE "PartyStatus" AS ENUM ('LOBBY', 'ACTIVE', 'COMPLETE');

-- CreateTable
CREATE TABLE "StudyDeck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "shareId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyQuestion" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyFlashcard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyFlashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "status" "PartyStatus" NOT NULL DEFAULT 'LOBBY',
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "questionStartedAt" TIMESTAMP(3),
    "hostUserId" TEXT,
    "hostPlayerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyPlayer" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "playerToken" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "PartyPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartySubmission" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "partyPlayerId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerIndex" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyDeck_shareId_key" ON "StudyDeck"("shareId");

-- CreateIndex
CREATE INDEX "StudyQuestion_deckId_order_idx" ON "StudyQuestion"("deckId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StudyQuestion_deckId_order_key" ON "StudyQuestion"("deckId", "order");

-- CreateIndex
CREATE INDEX "StudyFlashcard_deckId_order_idx" ON "StudyFlashcard"("deckId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StudyFlashcard_deckId_order_key" ON "StudyFlashcard"("deckId", "order");

-- CreateIndex
CREATE INDEX "StudyAttempt_userId_createdAt_idx" ON "StudyAttempt"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Party_joinCode_key" ON "Party"("joinCode");

-- CreateIndex
CREATE INDEX "Party_deckId_createdAt_idx" ON "Party"("deckId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyPlayer_playerToken_key" ON "PartyPlayer"("playerToken");

-- CreateIndex
CREATE INDEX "PartyPlayer_partyId_joinedAt_idx" ON "PartyPlayer"("partyId", "joinedAt");

-- CreateIndex
CREATE INDEX "PartySubmission_partyId_questionId_idx" ON "PartySubmission"("partyId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PartySubmission_partyPlayerId_questionId_key" ON "PartySubmission"("partyPlayerId", "questionId");

-- AddForeignKey
ALTER TABLE "StudyDeck" ADD CONSTRAINT "StudyDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyQuestion" ADD CONSTRAINT "StudyQuestion_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "StudyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyFlashcard" ADD CONSTRAINT "StudyFlashcard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "StudyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAttempt" ADD CONSTRAINT "StudyAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyAttempt" ADD CONSTRAINT "StudyAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "StudyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyPlayer" ADD CONSTRAINT "PartyPlayer_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartySubmission" ADD CONSTRAINT "PartySubmission_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartySubmission" ADD CONSTRAINT "PartySubmission_partyPlayerId_fkey" FOREIGN KEY ("partyPlayerId") REFERENCES "PartyPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartySubmission" ADD CONSTRAINT "PartySubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
