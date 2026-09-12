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
    "tourSeenAt" DATETIME,
    "friendCode" TEXT
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
  `CREATE TABLE IF NOT EXISTS "NewsArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "summary" TEXT,
    "imageUrl" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "SentRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" DATETIME,
    CONSTRAINT "SentRecommendation_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SentRecommendation_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SentRecommendation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TitleReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleId" TEXT NOT NULL,
    "tmdbReviewId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorAvatarPath" TEXT,
    "authorRating" INTEGER,
    "content" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    CONSTRAINT "TitleReview_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Household_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "HouseholdMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ShoppingList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "plannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShoppingList_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "categoryId" TEXT,
    "rawName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "qty" REAL,
    "unit" TEXT,
    "checkedAt" DATETIME,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "isSuggested" BOOLEAN NOT NULL DEFAULT false,
    "clientMutationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Child" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'MarAntonia',
    "ownerUserId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Child_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ChildCaregiver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChildCaregiver_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildCaregiver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ChildActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caregiverId" TEXT,
    "mealQuality" TEXT,
    "milkOunces" REAL,
    "wakeMood" TEXT,
    "diaperContent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChildActivity_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChildActivity_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
  `CREATE UNIQUE INDEX IF NOT EXISTS "NewsArticle_link_key" ON "NewsArticle"("link")`,
  `CREATE INDEX IF NOT EXISTS "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_friendCode_key" ON "User"("friendCode")`,
  `CREATE INDEX IF NOT EXISTS "Friendship_userAId_idx" ON "Friendship"("userAId")`,
  `CREATE INDEX IF NOT EXISTS "Friendship_userBId_idx" ON "Friendship"("userBId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId")`,
  `CREATE INDEX IF NOT EXISTS "SentRecommendation_toUserId_idx" ON "SentRecommendation"("toUserId")`,
  `CREATE INDEX IF NOT EXISTS "SentRecommendation_fromUserId_idx" ON "SentRecommendation"("fromUserId")`,
  `CREATE INDEX IF NOT EXISTS "SentRecommendation_titleId_idx" ON "SentRecommendation"("titleId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "TitleReview_tmdbReviewId_key" ON "TitleReview"("tmdbReviewId")`,
  `CREATE INDEX IF NOT EXISTS "TitleReview_titleId_idx" ON "TitleReview"("titleId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Household_inviteCode_key" ON "Household"("inviteCode")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "HouseholdMember_userId_idx" ON "HouseholdMember"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Category_householdId_name_key" ON "Category"("householdId", "name")`,
  `CREATE INDEX IF NOT EXISTS "Category_householdId_idx" ON "Category"("householdId")`,
  `CREATE INDEX IF NOT EXISTS "ShoppingList_householdId_status_idx" ON "ShoppingList"("householdId", "status")`,
  `CREATE INDEX IF NOT EXISTS "ShoppingList_householdId_plannedAt_idx" ON "ShoppingList"("householdId", "plannedAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ListItem_listId_clientMutationId_key" ON "ListItem"("listId", "clientMutationId")`,
  `CREATE INDEX IF NOT EXISTS "ListItem_listId_idx" ON "ListItem"("listId")`,
  `CREATE INDEX IF NOT EXISTS "ListItem_householdId_idx" ON "ListItem"("householdId")`,
  `CREATE INDEX IF NOT EXISTS "ListItem_categoryId_idx" ON "ListItem"("categoryId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Child_inviteCode_key" ON "Child"("inviteCode")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChildCaregiver_childId_userId_key" ON "ChildCaregiver"("childId", "userId")`,
  `CREATE INDEX IF NOT EXISTS "ChildCaregiver_userId_idx" ON "ChildCaregiver"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ChildActivity_childId_occurredAt_idx" ON "ChildActivity"("childId", "occurredAt")`,
  `CREATE INDEX IF NOT EXISTS "ChildActivity_childId_type_idx" ON "ChildActivity"("childId", "type")`,
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
  `ALTER TABLE "User" ADD COLUMN "friendCode" TEXT`,
  // Backfills any pre-existing row left NULL by the ALTER above -- needs to
  // run every time (idempotent via the WHERE clause) since a plain ALTER
  // can't give a unique per-row default to a table that already has rows,
  // and the unique index on this column (see INDEX_STATEMENTS) needs every
  // row to already hold a distinct value.
  `UPDATE "User" SET "friendCode" = lower(hex(randomblob(12))) WHERE "friendCode" IS NULL`,
  `ALTER TABLE "Person" ADD COLUMN "gender" INTEGER`,
  `ALTER TABLE "Title" ADD COLUMN "reviewsFetchedAt" DATETIME`,
  `ALTER TABLE "ChildActivity" ADD COLUMN "diaperAmount" TEXT`,
  `ALTER TABLE "ChildActivity" ADD COLUMN "diaperConsistency" TEXT`,
  `ALTER TABLE "ChildActivity" ADD COLUMN "sleepType" TEXT`,
  `ALTER TABLE "ChildActivity" ADD COLUMN "sleepEndedAt" DATETIME`,
  `ALTER TABLE "ChildActivity" ADD COLUMN "sleepAchievedAt" DATETIME`,
  `ALTER TABLE "ChildActivity" ADD COLUMN "outingType" TEXT`,
  // Migrates any pre-existing single-instant NAP rows to SLEEP/SIESTA,
  // closed out immediately -- see the matching migration.sql. Idempotent:
  // a second run finds no more rows with type = 'NAP' to touch.
  `UPDATE "ChildActivity" SET "type" = 'SLEEP', "sleepType" = 'SIESTA', "sleepEndedAt" = "occurredAt" WHERE "type" = 'NAP'`,
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
