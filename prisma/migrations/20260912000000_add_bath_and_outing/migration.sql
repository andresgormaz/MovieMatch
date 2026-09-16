-- AlterTable
-- BATH needs no new column (no detail field of its own, just occurredAt +
-- caregiver, reusing the existing "type" column). OUTING needs one.
ALTER TABLE "ChildActivity" ADD COLUMN "outingType" TEXT;
