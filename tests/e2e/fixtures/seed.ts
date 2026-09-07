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
import type { ListStatus, CaregiverRole } from "../../../src/generated/prisma/enums";

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
  } else if (action === "add-list") {
    // Seeds a list directly in a given status -- e2e coverage for the
    // "completadas" section can't drive that transition through the UI yet
    // (that's PR7's "Terminar compra"), so this fixture stands in for it.
    const [householdId, title, status] = args;
    const list = await prisma.shoppingList.create({
      data: { householdId, title, status: status as ListStatus },
    });
    console.log(JSON.stringify({ listId: list.id }));
  } else if (action === "add-item") {
    // Seeds an item directly, bypassing the quick-add UI -- item CRUD
    // itself is already covered by list-items.spec.ts; tests that only
    // care about checking/unchecking don't need to drive that flow too.
    const [listId, householdId, rawName] = args;
    const item = await prisma.listItem.create({
      data: { listId, householdId, rawName, displayName: rawName },
    });
    console.log(JSON.stringify({ itemId: item.id }));
  } else if (action === "create-with-child") {
    // A ready-made child profile (with its owner already a caregiver) for
    // tests that only care about a second caregiver joining it -- avoids
    // driving the create-profile UI just to set up a fixture for a join
    // test.
    const [email, childName, role] = args;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: "E2E Caregiver", passwordHash, onboardingCompletedAt: new Date(), tourSeenAt: new Date() },
    });
    const child = await prisma.child.create({
      data: {
        name: childName || undefined,
        ownerUserId: user.id,
        caregivers: { create: { userId: user.id, role: (role || "MAMA") as CaregiverRole } },
      },
    });
    console.log(JSON.stringify({ inviteCode: child.inviteCode, childId: child.id }));
  } else if (action === "get-item-checked") {
    // Reads server-side state directly -- for the offline sync test, this
    // is how we confirm a queued mutation actually reached the database
    // rather than trusting the UI's own (possibly still-optimistic) view.
    const [itemId] = args;
    const item = await prisma.listItem.findUniqueOrThrow({ where: { id: itemId } });
    console.log(JSON.stringify({ checked: item.checkedAt !== null }));
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
