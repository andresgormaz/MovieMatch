-- CreateTable
CREATE TABLE "TitleSimilar" (
    "titleId" TEXT NOT NULL,
    "relatedTmdbId" INTEGER NOT NULL,
    "relatedType" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    PRIMARY KEY ("titleId", "relatedTmdbId", "relatedType"),
    CONSTRAINT "TitleSimilar_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TitleSimilar_relatedTmdbId_relatedType_idx" ON "TitleSimilar"("relatedTmdbId", "relatedType");

-- CreateTable
CREATE TABLE "Wishlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wishlist_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Wishlist_userId_idx" ON "Wishlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wishlist_userId_titleId_key" ON "Wishlist"("userId", "titleId");
