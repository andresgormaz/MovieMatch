-- AlterTable
ALTER TABLE "Title" ADD COLUMN "budget" INTEGER;
ALTER TABLE "Title" ADD COLUMN "voteCount" INTEGER;

-- CreateIndex
CREATE INDEX "Title_releaseYear_idx" ON "Title"("releaseYear");

-- CreateIndex
CREATE INDEX "Title_voteAverage_idx" ON "Title"("voteAverage");

-- CreateIndex
CREATE INDEX "Title_voteCount_idx" ON "Title"("voteCount");
