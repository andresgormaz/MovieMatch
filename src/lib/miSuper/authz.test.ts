import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { requireHouseholdMember, requireListAccess, MiSuperAuthzError } from "./authz";

// Synthetic user/household ids never collide with real data -- prefixed and
// cleaned up in afterAll regardless of pass/fail.
const PREFIX = "authz-test-";

let ownerId: string;
let outsiderId: string;
let viewerId: string;
let householdAId: string;
let householdBId: string;
let listAId: string;

beforeAll(async () => {
  const owner = await prisma.user.create({
    data: { email: `${PREFIX}owner@example.com`, passwordHash: "x", name: "Owner" },
  });
  const outsider = await prisma.user.create({
    data: { email: `${PREFIX}outsider@example.com`, passwordHash: "x", name: "Outsider" },
  });
  const viewer = await prisma.user.create({
    data: { email: `${PREFIX}viewer@example.com`, passwordHash: "x", name: "Viewer" },
  });
  ownerId = owner.id;
  outsiderId = outsider.id;
  viewerId = viewer.id;

  const householdA = await prisma.household.create({
    data: {
      name: "Hogar A",
      ownerUserId: ownerId,
      members: { create: [{ userId: ownerId, role: "OWNER" }, { userId: viewerId, role: "VIEWER" }] },
    },
  });
  const householdB = await prisma.household.create({
    data: { name: "Hogar B", ownerUserId: outsiderId, members: { create: { userId: outsiderId, role: "OWNER" } } },
  });
  householdAId = householdA.id;
  householdBId = householdB.id;

  const listA = await prisma.shoppingList.create({
    data: { householdId: householdAId, title: "Lista A" },
  });
  listAId = listA.id;
});

afterAll(async () => {
  await prisma.shoppingList.deleteMany({ where: { householdId: { in: [householdAId, householdBId] } } });
  await prisma.household.deleteMany({ where: { id: { in: [householdAId, householdBId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId, viewerId] } } });
});

describe("requireHouseholdMember", () => {
  test("allows a real member", async () => {
    const member = await requireHouseholdMember(ownerId, householdAId);
    expect(member.userId).toBe(ownerId);
  });

  test("rejects someone from a different household -- the negative isolation test", async () => {
    await expect(requireHouseholdMember(outsiderId, householdAId)).rejects.toBeInstanceOf(MiSuperAuthzError);
  });

  test("enforces minRole -- a VIEWER can't satisfy an EDITOR requirement", async () => {
    await expect(requireHouseholdMember(viewerId, householdAId, "EDITOR")).rejects.toBeInstanceOf(MiSuperAuthzError);
  });

  test("a VIEWER still satisfies a VIEWER requirement", async () => {
    const member = await requireHouseholdMember(viewerId, householdAId, "VIEWER");
    expect(member.role).toBe("VIEWER");
  });
});

describe("requireListAccess", () => {
  test("allows a member of the list's household", async () => {
    const list = await requireListAccess(ownerId, listAId);
    expect(list.householdId).toBe(householdAId);
  });

  test("rejects a user from a different household", async () => {
    await expect(requireListAccess(outsiderId, listAId)).rejects.toBeInstanceOf(MiSuperAuthzError);
  });

  test("rejects a nonexistent list", async () => {
    await expect(requireListAccess(ownerId, "does-not-exist")).rejects.toBeInstanceOf(MiSuperAuthzError);
  });
});
