-- CreateTable
CREATE TABLE "UserPopularityPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserPopularityPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserPopularityPreference_userId_idx" ON "UserPopularityPreference"("userId");
CREATE UNIQUE INDEX "UserPopularityPreference_userId_range_key" ON "UserPopularityPreference"("userId", "range");
