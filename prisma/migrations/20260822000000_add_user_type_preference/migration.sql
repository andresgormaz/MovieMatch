-- CreateTable
CREATE TABLE "UserTypePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    CONSTRAINT "UserTypePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserTypePreference_userId_idx" ON "UserTypePreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTypePreference_userId_type_key" ON "UserTypePreference"("userId", "type");
