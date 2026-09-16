-- Nullable, plain column: no per-row default needed, so this is the simple
-- ALTER TABLE case (no backfill/unique-index dance required).
ALTER TABLE "Person" ADD COLUMN "gender" INTEGER;
