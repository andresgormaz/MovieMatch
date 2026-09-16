import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { requireChildCaregiver, requireAnyChild, MarAntoniaAuthzError } from "./authz";

// Synthetic user/child ids never collide with real data -- prefixed and
// cleaned up in afterAll regardless of pass/fail.
const PREFIX = "marantonia-authz-test-";

let mamaId: string;
let outsiderId: string;
let childAId: string;
let childBId: string;

beforeAll(async () => {
  const mama = await prisma.user.create({
    data: { email: `${PREFIX}mama@example.com`, passwordHash: "x", name: "Mamá" },
  });
  const outsider = await prisma.user.create({
    data: { email: `${PREFIX}outsider@example.com`, passwordHash: "x", name: "Outsider" },
  });
  mamaId = mama.id;
  outsiderId = outsider.id;

  const childA = await prisma.child.create({
    data: {
      name: "Niña A",
      ownerUserId: mamaId,
      caregivers: { create: { userId: mamaId, role: "MAMA" } },
    },
  });
  const childB = await prisma.child.create({
    data: {
      name: "Niña B",
      ownerUserId: outsiderId,
      caregivers: { create: { userId: outsiderId, role: "PAPA" } },
    },
  });
  childAId = childA.id;
  childBId = childB.id;
});

afterAll(async () => {
  await prisma.child.deleteMany({ where: { id: { in: [childAId, childBId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [mamaId, outsiderId] } } });
});

describe("requireChildCaregiver", () => {
  test("allows a real caregiver", async () => {
    const caregiver = await requireChildCaregiver(mamaId, childAId);
    expect(caregiver.userId).toBe(mamaId);
  });

  test("rejects someone who isn't a caregiver of this child -- the negative isolation test", async () => {
    await expect(requireChildCaregiver(outsiderId, childAId)).rejects.toBeInstanceOf(MarAntoniaAuthzError);
  });
});

describe("requireAnyChild", () => {
  test("resolves the caller's own child", async () => {
    const caregiver = await requireAnyChild(mamaId);
    expect(caregiver.childId).toBe(childAId);
  });

  test("rejects a user with no child at all", async () => {
    await expect(requireAnyChild("does-not-exist")).rejects.toBeInstanceOf(MarAntoniaAuthzError);
  });
});
