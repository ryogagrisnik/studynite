-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('FREE', 'PRO');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "plan" "public"."Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exam" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "timeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Question" (
    "id" TEXT NOT NULL,
    "exam" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "topic" TEXT,
    "difficulty" TEXT,
    "payload" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Question_hash_key" ON "public"."Question"("hash");

-- CreateIndex
CREATE INDEX "Question_exam_section_topic_difficulty_idx" ON "public"."Question"("exam", "section", "topic", "difficulty");

-- AddForeignKey
ALTER TABLE "public"."Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
