/*
  Warnings:

  - A unique constraint covering the columns `[userId,questionId]` on the table `Attempt` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."QuestionSource" AS ENUM ('BASELINE', 'VARIANT');

-- AlterTable
ALTER TABLE "public"."Attempt" ADD COLUMN     "concept" TEXT,
ADD COLUMN     "source" "public"."QuestionSource";

-- CreateTable
CREATE TABLE "public"."VariantQuestion" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "choicesJson" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VariantQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VariantQuestion_checksum_key" ON "public"."VariantQuestion"("checksum");

-- CreateIndex
CREATE INDEX "VariantQuestion_concept_createdAt_idx" ON "public"."VariantQuestion"("concept", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_userId_questionId_key" ON "public"."Attempt"("userId", "questionId");
