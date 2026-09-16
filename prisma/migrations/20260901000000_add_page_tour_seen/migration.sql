-- CreateTable
CREATE TABLE "UserPageTourSeen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPageTourSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserPageTourSeen_userId_idx" ON "UserPageTourSeen"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPageTourSeen_userId_pageKey_key" ON "UserPageTourSeen"("userId", "pageKey");
