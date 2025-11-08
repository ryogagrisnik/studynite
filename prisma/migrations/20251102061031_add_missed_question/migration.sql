-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "aiExplanation" TEXT;

-- CreateTable
CREATE TABLE "MissedQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "totalMisses" INTEGER NOT NULL DEFAULT 0,
    "lastMissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastServedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissedQuestion_userId_clearedAt_lastServedAt_idx" ON "MissedQuestion"("userId", "clearedAt", "lastServedAt");

-- CreateIndex
CREATE INDEX "MissedQuestion_userId_lastMissedAt_idx" ON "MissedQuestion"("userId", "lastMissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissedQuestion_userId_questionId_key" ON "MissedQuestion"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "MissedQuestion" ADD CONSTRAINT "MissedQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissedQuestion" ADD CONSTRAINT "MissedQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
