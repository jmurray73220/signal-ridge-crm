-- CreateTable
CREATE TABLE "BookmarkCapture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageText" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "BookmarkCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookmarkCapture_userId_consumedAt_idx" ON "BookmarkCapture"("userId", "consumedAt");
