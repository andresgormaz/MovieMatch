-- AlterTable
ALTER TABLE "UserTitleRating" ADD COLUMN "notInterested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserTitleRating" ADD COLUMN "watchProgress" TEXT;
