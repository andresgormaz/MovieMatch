-- AlterTable
ALTER TABLE "User" ADD COLUMN "country" TEXT;

-- CreateTable
CREATE TABLE "Provider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "logoPath" TEXT
);

-- CreateTable
CREATE TABLE "TitleProvider" (
    "titleId" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,

    PRIMARY KEY ("titleId", "providerId", "countryCode"),
    CONSTRAINT "TitleProvider_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TitleProvider_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TitleProvider_countryCode_idx" ON "TitleProvider"("countryCode");
