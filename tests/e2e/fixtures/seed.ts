// Run via `npx tsx tests/e2e/fixtures/seed.ts <action> <email>` from a spec's
// beforeAll/afterAll, in a separate process -- not imported directly into
// spec files, since Prisma 7's generated client is ESM-only (uses
// `import.meta.url`) and Playwright's own test transform can't load that,
// while tsx's proper ESM loader hooks handle it fine (same reason this
// repo's other manual-verification scripts always run through tsx).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../../../src/lib/prisma";

const PASSWORD = "Test1234!";

async function main() {
  const [action, email] = process.argv.slice(2);
  if (action === "create") {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "E2E", passwordHash, onboardingCompletedAt: new Date(), tourSeenAt: new Date() },
    });
  } else if (action === "delete") {
    await prisma.user.deleteMany({ where: { email } });
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
