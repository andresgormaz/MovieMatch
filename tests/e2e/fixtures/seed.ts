// Run via `npx tsx tests/e2e/fixtures/seed.ts <action> ...args` from a
// spec's beforeAll/afterAll, in a separate process -- not imported directly
// into spec files, since Prisma 7's generated client is ESM-only (uses
// `import.meta.url`) and Playwright's own test transform can't load that,
// while tsx's proper ESM loader hooks handle it fine (same reason this
// repo's other manual-verification scripts always run through tsx).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../../../src/lib/prisma";
import { DEFAULT_CATEGORIES } from "../../../src/lib/miSuper/categories";

const PASSWORD = "Test1234!";

async function main() {
  const [action, ...args] = process.argv.slice(2);

  if (action === "create") {
    const [email] = args;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "E2E", passwordHash, onboardingCompletedAt: new Date(), tourSeenAt: new Date() },
    });
  } else if (action === "create-with-household") {
    // A ready-made household (with its owner already a member) for tests
    // that only care about a second user joining it -- avoids driving the
    // create-household UI just to set up a fixture for a join test.
    const [email, householdName] = args;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "E2E Owner", passwordHash, onboardingCompletedAt: new Date(), tourSeenAt: new Date() },
    });
    const household = await prisma.household.create({
      data: {
        name: householdName || null,
        ownerUserId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
        categories: { create: DEFAULT_CATEGORIES.map((name, i) => ({ name, sortOrder: i })) },
      },
      include: { categories: { orderBy: { sortOrder: "asc" } } },
    });
    // Printed so the calling test can read it back off stdout.
    console.log(
      JSON.stringify({
        inviteCode: household.inviteCode,
        householdId: household.id,
        categoryId: household.categories[0].id,
      }),
    );
  } else if (action === "delete") {
    const [email] = args;
    // Deleting the owner cascades their household (and everything under
    // it, including any joiner's membership row) -- see schema.prisma's
    // Household.owner/HouseholdMember onDelete: Cascade.
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
