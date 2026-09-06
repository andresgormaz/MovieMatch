import { prisma } from "@/lib/prisma";
import type { HouseholdRole } from "@/generated/prisma/enums";

// Thrown instead of returning a discriminated result so a caller that
// forgets to check gets a loud failure (an uncaught throw) instead of a
// silently-ignored "not authorized" value -- see api routes for the
// try/catch that maps this to an HTTP response.
export class MiSuperAuthzError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MiSuperAuthzError";
    this.status = status;
  }
}

const ROLE_RANK: Record<HouseholdRole, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

// The one place household isolation is enforced -- every mutating route
// calls this (or requireListAccess) before touching data, rather than
// filtering ad hoc per query. Throws MiSuperAuthzError if the user isn't a
// member of the household, or is but doesn't hold at least `minRole`.
export async function requireHouseholdMember(userId: string, householdId: string, minRole: HouseholdRole = "VIEWER") {
  const member = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!member) throw new MiSuperAuthzError("No perteneces a este hogar", 403);
  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
    throw new MiSuperAuthzError("No tienes permiso para esta acción", 403);
  }
  return member;
}

// Same idea for a specific list -- resolves the list's household first
// (list.householdId is the source of truth; ListItem.householdId is only a
// denormalized copy for its own fast lookups) then delegates to the same
// membership/role check.
export async function requireListAccess(userId: string, listId: string, minRole: HouseholdRole = "VIEWER") {
  const list = await prisma.shoppingList.findUnique({
    where: { id: listId },
    select: { id: true, householdId: true },
  });
  if (!list) throw new MiSuperAuthzError("Lista no encontrada", 404);
  await requireHouseholdMember(userId, list.householdId, minRole);
  return list;
}
