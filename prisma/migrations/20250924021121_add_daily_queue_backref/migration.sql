-- CreateTable
CREATE TABLE "public"."DailyQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "servedAt" TIMESTAMP(3),

    CONSTRAINT "DailyQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyQueueItem_userId_date_servedAt_idx" ON "public"."DailyQueueItem"("userId", "date", "servedAt");

-- CreateIndex
CREATE INDEX "DailyQueueItem_questionId_idx" ON "public"."DailyQueueItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQueueItem_userId_date_order_key" ON "public"."DailyQueueItem"("userId", "date", "order");

-- AddForeignKey
ALTER TABLE "public"."DailyQueueItem" ADD CONSTRAINT "DailyQueueItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
