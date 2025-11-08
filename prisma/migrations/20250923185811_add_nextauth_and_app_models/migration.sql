/*
  Warnings:

  - You are about to drop the column `correct` on the `Attempt` table. All the data in the column will be lost.
  - You are about to drop the column `exam` on the `Attempt` table. All the data in the column will be lost.
  - You are about to drop the column `section` on the `Attempt` table. All the data in the column will be lost.
  - You are about to drop the column `hash` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `User` table. All the data in the column will be lost.
  - Added the required column `isCorrect` to the `Attempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userAnswer` to the `Attempt` table without a default value. This is not possible if the table is not empty.
  - Made the column `timeMs` on table `Attempt` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `answer` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `explanation` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stem` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difficulty` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Attempt" DROP CONSTRAINT "Attempt_userId_fkey";

-- DropIndex
DROP INDEX "public"."Question_exam_section_topic_difficulty_idx";

-- DropIndex
DROP INDEX "public"."Question_hash_key";

-- AlterTable
ALTER TABLE "public"."Attempt" DROP COLUMN "correct",
DROP COLUMN "exam",
DROP COLUMN "section",
ADD COLUMN     "isCorrect" BOOLEAN NOT NULL,
ADD COLUMN     "userAnswer" TEXT NOT NULL,
ALTER COLUMN "timeMs" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Question" DROP COLUMN "hash",
DROP COLUMN "payload",
ADD COLUMN     "answer" TEXT NOT NULL,
ADD COLUMN     "choices" TEXT[],
ADD COLUMN     "explanation" TEXT NOT NULL,
ADD COLUMN     "stem" TEXT NOT NULL,
DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "createdAt",
DROP COLUMN "plan",
ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT;

-- DropEnum
DROP TYPE "public"."Plan";

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Attempt_userId_createdAt_idx" ON "public"."Attempt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attempt" ADD CONSTRAINT "Attempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
