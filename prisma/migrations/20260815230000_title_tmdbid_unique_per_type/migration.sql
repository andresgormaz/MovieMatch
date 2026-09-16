-- TMDB movie ids and TV ids are separate number spaces, so a movie and a
-- series can legitimately share the same tmdbId. Replace the single-column
-- unique constraint with one scoped to (tmdbId, type); the old constraint
-- made that legitimate collision crash the batched TMDB import.
DROP INDEX "Title_tmdbId_key";

-- CreateIndex
CREATE INDEX "Title_tmdbId_idx" ON "Title"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Title_tmdbId_type_key" ON "Title"("tmdbId", "type");
