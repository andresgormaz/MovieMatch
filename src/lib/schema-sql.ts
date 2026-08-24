// Idempotent copy of the migrations under prisma/migrations/, used by the
// /api/admin/seed route to create/evolve the schema on Turso without a
// computer/terminal to run `prisma migrate deploy`. Keep in sync with the
// Prisma schema by hand. Run in this order (see ensureSchema() in
// seedCatalog.ts): TABLE_STATEMENTS, then ALTER_STATEMENTS (new columns on
// tables that already existed), then INDEX_STATEMENTS -- indexes on a
// column that was just ALTERed in would fail if created first.
export const TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "country" TEXT,
    "originalTitles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardingCompletedAt" DATETIME,
    "homeVisitedAt" DATETIME,
    "tourSeenAt" DATETIME
  )`,
  `CREATE TABLE IF NOT EXISTS "Title" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tmdbId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "overview" TEXT,
    "releaseYear" INTEGER,
    "releaseDate" DATETIME,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "popularity" REAL,
    "voteAverage" REAL,
    "voteCount" INTEGER,
    "budget" INTEGER,
    "runtime" INTEGER,
    "seasonsCount" INTEGER,
    "episodesCount" INTEGER,
    "nextEpisodeAirDate" DATETIME,
    "status" TEXT,
    "inProduction" BOOLEAN,
    "lastAirDate" DATETIME,
    "collectionId" INTEGER,
    "originCountry" TEXT,
    "onboardingRank" INTEGER,
    "trailerKey" TEXT,
    "trailerFetchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Genre" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleGenre" (
    "titleId" TEXT NOT NULL,
    "genreId" INTEGER NOT NULL,
    PRIMARY KEY ("titleId", "genreId"),
    CONSTRAINT "TitleGenre_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TitleGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tmdbId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "profilePath" TEXT,
    "knownForDepartment" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleCast" (
    "titleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "character" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("titleId", "personId"),
    CONSTRAINT "TitleCast_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TitleCast_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleCrew" (
    "titleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    PRIMARY KEY ("titleId", "personId", "job"),
    CONSTRAINT "TitleCrew_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TitleCrew_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserTitleRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT true,
    "score" INTEGER,
    "notInterested" BOOLEAN NOT NULL DEFAULT false,
    "watchProgress" TEXT,
    "ratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTitleRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTitleRating_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserPersonRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    CONSTRAINT "UserPersonRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserPersonRating_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserGenrePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "genreId" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserGenrePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGenrePreference_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserCountryPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserCountryPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Provider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "logoPath" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleProvider" (
    "titleId" TEXT NOT NULL,
    "providerId" INTEGER NOT NULL,
    "countryCode" TEXT NOT NULL,
    PRIMARY KEY ("titleId", "providerId", "countryCode"),
    CONSTRAINT "TitleProvider_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TitleProvider_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleSimilar" (
    "titleId" TEXT NOT NULL,
    "relatedTmdbId" INTEGER NOT NULL,
    "relatedType" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    PRIMARY KEY ("titleId", "relatedTmdbId", "relatedType"),
    CONSTRAINT "TitleSimilar_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Wishlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wishlist_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "OnboardingChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "titleAId" TEXT NOT NULL,
    "titleBId" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserTypePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserTypePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserAudiencePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserAudiencePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserBudgetPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserBudgetPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserRuntimePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserRuntimePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserPopularityPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserPopularityPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SavedFilter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserPageTourSeen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPageTourSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
];

export const INDEX_STATEMENTS = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  // No plain unique index on tmdbId alone -- TMDB movie ids and TV ids are
  // separate number spaces, so a movie and a series can legitimately share
  // one. See DROP_INDEX_STATEMENTS below for dropping the old constraint on
  // a database created before this.
  `CREATE INDEX IF NOT EXISTS "Title_tmdbId_idx" ON "Title"("tmdbId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Title_tmdbId_type_key" ON "Title"("tmdbId", "type")`,
  `CREATE INDEX IF NOT EXISTS "Title_onboardingRank_idx" ON "Title"("onboardingRank")`,
  `CREATE INDEX IF NOT EXISTS "Title_type_idx" ON "Title"("type")`,
  `CREATE INDEX IF NOT EXISTS "Title_releaseYear_idx" ON "Title"("releaseYear")`,
  `CREATE INDEX IF NOT EXISTS "Title_voteAverage_idx" ON "Title"("voteAverage")`,
  `CREATE INDEX IF NOT EXISTS "Title_voteCount_idx" ON "Title"("voteCount")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Genre_name_key" ON "Genre"("name")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Person_tmdbId_key" ON "Person"("tmdbId")`,
  `CREATE INDEX IF NOT EXISTS "Person_knownForDepartment_idx" ON "Person"("knownForDepartment")`,
  `CREATE INDEX IF NOT EXISTS "TitleCast_personId_idx" ON "TitleCast"("personId")`,
  `CREATE INDEX IF NOT EXISTS "TitleCrew_personId_idx" ON "TitleCrew"("personId")`,
  `CREATE INDEX IF NOT EXISTS "UserTitleRating_userId_idx" ON "UserTitleRating"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserTitleRating_userId_titleId_key" ON "UserTitleRating"("userId", "titleId")`,
  `CREATE INDEX IF NOT EXISTS "UserPersonRating_userId_idx" ON "UserPersonRating"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserPersonRating_userId_personId_key" ON "UserPersonRating"("userId", "personId")`,
  `CREATE INDEX IF NOT EXISTS "UserGenrePreference_userId_idx" ON "UserGenrePreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserGenrePreference_userId_genreId_key" ON "UserGenrePreference"("userId", "genreId")`,
  `CREATE INDEX IF NOT EXISTS "UserCountryPreference_userId_idx" ON "UserCountryPreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserCountryPreference_userId_countryCode_key" ON "UserCountryPreference"("userId", "countryCode")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Group_inviteCode_key" ON "Group"("inviteCode")`,
  `CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "TitleProvider_countryCode_idx" ON "TitleProvider"("countryCode")`,
  `CREATE INDEX IF NOT EXISTS "TitleSimilar_relatedTmdbId_relatedType_idx" ON "TitleSimilar"("relatedTmdbId", "relatedType")`,
  `CREATE INDEX IF NOT EXISTS "Wishlist_userId_idx" ON "Wishlist"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Wishlist_userId_titleId_key" ON "Wishlist"("userId", "titleId")`,
  `CREATE INDEX IF NOT EXISTS "OnboardingChoice_userId_idx" ON "OnboardingChoice"("userId")`,
  `CREATE INDEX IF NOT EXISTS "UserTypePreference_userId_idx" ON "UserTypePreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserTypePreference_userId_type_key" ON "UserTypePreference"("userId", "type")`,
  `CREATE INDEX IF NOT EXISTS "UserAudiencePreference_userId_idx" ON "UserAudiencePreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserAudiencePreference_userId_tier_key" ON "UserAudiencePreference"("userId", "tier")`,
  `CREATE INDEX IF NOT EXISTS "UserBudgetPreference_userId_idx" ON "UserBudgetPreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserBudgetPreference_userId_tier_key" ON "UserBudgetPreference"("userId", "tier")`,
  `CREATE INDEX IF NOT EXISTS "UserRuntimePreference_userId_idx" ON "UserRuntimePreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserRuntimePreference_userId_bucket_key" ON "UserRuntimePreference"("userId", "bucket")`,
  `CREATE INDEX IF NOT EXISTS "UserPopularityPreference_userId_idx" ON "UserPopularityPreference"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserPopularityPreference_userId_range_key" ON "UserPopularityPreference"("userId", "range")`,
  `CREATE INDEX IF NOT EXISTS "SavedFilter_userId_idx" ON "SavedFilter"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SavedFilter_userId_name_key" ON "SavedFilter"("userId", "name")`,
  // `orderBy: popularity desc` is the most common query shape in the app
  // (recommendations, search, import/backfill, onboarding) -- without this
  // it sorts the whole catalog from scratch on every request.
  `CREATE INDEX IF NOT EXISTS "Title_popularity_idx" ON "Title"("popularity")`,
  // TitleGenre's composite primary key (titleId, genreId) only serves
  // "titleId -> its genres" lookups -- filtering "titles with genre X"
  // needs genreId as its own leading column.
  `CREATE INDEX IF NOT EXISTS "TitleGenre_genreId_idx" ON "TitleGenre"("genreId")`,
  `CREATE INDEX IF NOT EXISTS "UserPageTourSeen_userId_idx" ON "UserPageTourSeen"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UserPageTourSeen_userId_pageKey_key" ON "UserPageTourSeen"("userId", "pageKey")`,
];

// SQLite's ADD COLUMN has no IF NOT EXISTS guard, so these are run through
// ensureSchema() with per-statement "duplicate column" errors swallowed
// (see seedCatalog.ts). Needed to evolve a Turso database that was created
// before these columns existed -- CREATE TABLE IF NOT EXISTS above is a
// no-op once the table already exists.
export const ALTER_STATEMENTS = [
  `ALTER TABLE "Title" ADD COLUMN "voteCount" INTEGER`,
  `ALTER TABLE "Title" ADD COLUMN "budget" INTEGER`,
  `ALTER TABLE "User" ADD COLUMN "country" TEXT`,
  `ALTER TABLE "User" ADD COLUMN "originalTitles" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "OnboardingChoice" ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Title" ADD COLUMN "releaseDate" DATETIME`,
  `ALTER TABLE "User" ADD COLUMN "homeVisitedAt" DATETIME`,
  `ALTER TABLE "Title" ADD COLUMN "runtime" INTEGER`,
  `ALTER TABLE "Title" ADD COLUMN "collectionId" INTEGER`,
  `ALTER TABLE "Person" ADD COLUMN "biography" TEXT`,
  `ALTER TABLE "Person" ADD COLUMN "birthday" DATETIME`,
  `ALTER TABLE "Person" ADD COLUMN "deathday" DATETIME`,
  `ALTER TABLE "Person" ADD COLUMN "placeOfBirth" TEXT`,
  `ALTER TABLE "Person" ADD COLUMN "detailsFetchedAt" DATETIME`,
  `ALTER TABLE "User" ADD COLUMN "tourSeenAt" DATETIME`,
  `ALTER TABLE "Title" ADD COLUMN "seasonsCount" INTEGER`,
  `ALTER TABLE "Title" ADD COLUMN "episodesCount" INTEGER`,
  `ALTER TABLE "Title" ADD COLUMN "status" TEXT`,
  `ALTER TABLE "Title" ADD COLUMN "inProduction" BOOLEAN`,
  `ALTER TABLE "Title" ADD COLUMN "lastAirDate" DATETIME`,
  `ALTER TABLE "UserTitleRating" ADD COLUMN "notInterested" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "UserTitleRating" ADD COLUMN "watchProgress" TEXT`,
  `ALTER TABLE "Title" ADD COLUMN "nextEpisodeAirDate" DATETIME`,
  `ALTER TABLE "Title" ADD COLUMN "trailerKey" TEXT`,
  `ALTER TABLE "Title" ADD COLUMN "trailerFetchedAt" DATETIME`,
];

// Drops indexes from an older version of the schema that INDEX_STATEMENTS no
// longer creates. "IF EXISTS" makes these safe to run against a database
// that never had them (fresh installs) as well as one that does (existing
// Turso databases) -- run once, before INDEX_STATEMENTS, in ensureSchema().
export const DROP_INDEX_STATEMENTS = [
  // Replaced by "Title_tmdbId_type_key": a plain unique index on tmdbId
  // alone rejected the legitimate case of a movie and a series sharing a
  // TMDB id (movie/TV ids are separate number spaces on TMDB).
  `DROP INDEX IF EXISTS "Title_tmdbId_key"`,
];
