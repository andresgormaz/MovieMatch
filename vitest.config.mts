import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Same DATABASE_URL/.env loading tsx scripts use (see prisma/seed.ts) --
    // tests run against the real local dev.db, same as this repo's existing
    // manual-verification scripts, just checked in and repeatable.
    setupFiles: ["dotenv/config"],
    // Every *.test.ts file hits the same local SQLite file through its own
    // Prisma Client instance -- running test files in separate parallel
    // workers races concurrent writers against that one file and reliably
    // times out as soon as a second suite exists. Sequential is fine at this
    // suite's size.
    fileParallelism: false,
  },
});
