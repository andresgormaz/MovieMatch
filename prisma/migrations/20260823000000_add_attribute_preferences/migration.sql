-- AlterTable
ALTER TABLE "Title" ADD COLUMN "runtime" INTEGER;
ALTER TABLE "Title" ADD COLUMN "collectionId" INTEGER;

-- CreateTable
CREATE TABLE "UserAudiencePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserAudiencePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBudgetPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserBudgetPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRuntimePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserRuntimePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserAudiencePreference_userId_idx" ON "UserAudiencePreference"("userId");
CREATE UNIQUE INDEX "UserAudiencePreference_userId_tier_key" ON "UserAudiencePreference"("userId", "tier");

CREATE INDEX "UserBudgetPreference_userId_idx" ON "UserBudgetPreference"("userId");
CREATE UNIQUE INDEX "UserBudgetPreference_userId_tier_key" ON "UserBudgetPreference"("userId", "tier");

CREATE INDEX "UserRuntimePreference_userId_idx" ON "UserRuntimePreference"("userId");
CREATE UNIQUE INDEX "UserRuntimePreference_userId_bucket_key" ON "UserRuntimePreference"("userId", "bucket");
