-- AlterTable
ALTER TABLE "ChildActivity" ADD COLUMN "sleepType" TEXT;
ALTER TABLE "ChildActivity" ADD COLUMN "sleepEndedAt" DATETIME;

-- Migrate existing NAP entries (single-instant naps, no start/end split) to
-- the new SLEEP type under the SIESTA subtype, closed out immediately
-- (sleepEndedAt = occurredAt) so they don't linger as a stuck "open" session
-- blocking a real siesta from being started.
UPDATE "ChildActivity" SET "type" = 'SLEEP', "sleepType" = 'SIESTA', "sleepEndedAt" = "occurredAt" WHERE "type" = 'NAP';
