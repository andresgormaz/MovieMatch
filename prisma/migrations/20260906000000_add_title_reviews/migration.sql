-- AlterTable
ALTER TABLE "Title" ADD COLUMN "reviewsFetchedAt" DATETIME;

-- CreateTable
CREATE TABLE "TitleReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleId" TEXT NOT NULL,
    "tmdbReviewId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorAvatarPath" TEXT,
    "authorRating" INTEGER,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    CONSTRAINT "TitleReview_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TitleReview_tmdbReviewId_key" ON "TitleReview"("tmdbReviewId");

-- CreateIndex
CREATE INDEX "TitleReview_titleId_idx" ON "TitleReview"("titleId");
