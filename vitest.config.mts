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
  },
});
