/*
  Warnings:

  - Made the column `friendCode` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Child" ADD COLUMN "birthDate" DATETIME;
ALTER TABLE "Child" ADD COLUMN "sex" TEXT;

-- CreateTable
CREATE TABLE "ChildGrowthMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caregiverId" TEXT,
    "weightKg" REAL,
    "heightCm" REAL,
    "headCircumferenceCm" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChildGrowthMeasurement_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildGrowthMeasurement_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChildVaccineDose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "vaccineKey" TEXT NOT NULL,
    "givenAt" DATETIME,
    "caregiverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChildVaccineDose_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildVaccineDose_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "country" TEXT,
    "originalTitles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardingCompletedAt" DATETIME,
    "homeVisitedAt" DATETIME,
    "tourSeenAt" DATETIME,
    "friendCode" TEXT NOT NULL
);
INSERT INTO "new_User" ("country", "createdAt", "email", "friendCode", "homeVisitedAt", "id", "name", "onboardingCompletedAt", "originalTitles", "passwordHash", "tourSeenAt") SELECT "country", "createdAt", "email", "friendCode", "homeVisitedAt", "id", "name", "onboardingCompletedAt", "originalTitles", "passwordHash", "tourSeenAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ChildGrowthMeasurement_childId_occurredAt_idx" ON "ChildGrowthMeasurement"("childId", "occurredAt");

-- CreateIndex
CREATE INDEX "ChildVaccineDose_childId_idx" ON "ChildVaccineDose"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildVaccineDose_childId_vaccineKey_key" ON "ChildVaccineDose"("childId", "vaccineKey");
