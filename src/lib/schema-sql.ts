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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardingCompletedAt" DATETIME
  )`,
  `CREATE TABLE IF NOT EXISTS "Title" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tmdbId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "overview" TEXT,
    "releaseYear" INTEGER,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "popularity" REAL,
    "voteAverage" REAL,
    "voteCount" INTEGER,
    "budget" INTEGER,
    "originCountry" TEXT,
    "onboardingRank" INTEGER,
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
];

export const INDEX_STATEMENTS = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Title_tmdbId_key" ON "Title"("tmdbId")`,
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
];

// SQLite's ADD COLUMN has no IF NOT EXISTS guard, so these are run through
// ensureSchema() with per-statement "duplicate column" errors swallowed
// (see seedCatalog.ts). Needed to evolve a Turso database that was created
// before these columns existed -- CREATE TABLE IF NOT EXISTS above is a
// no-op once the table already exists.
export const ALTER_STATEMENTS = [
  `ALTER TABLE "Title" ADD COLUMN "voteCount" INTEGER`,
  `ALTER TABLE "Title" ADD COLUMN "budget" INTEGER`,
];
