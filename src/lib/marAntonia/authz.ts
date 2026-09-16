import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Thrown instead of returning a discriminated result so a caller that
// forgets to check gets a loud failure (an uncaught throw) instead of a
// silently-ignored "not authorized" value -- same shape as
// lib/miSuper/authz.ts's MiSuperAuthzError.
export class MarAntoniaAuthzError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MarAntoniaAuthzError";
    this.status = status;
  }
}

// No OWNER/EDITOR/VIEWER hierarchy here (unlike MiSuper's Household) -- both
// caregivers have equal rights over their child's data, so this is just a
// membership check.
export async function requireChildCaregiver(userId: string, childId: string) {
  const caregiver = await prisma.childCaregiver.findUnique({
    where: { childId_userId: { childId, userId } },
  });
  if (!caregiver) throw new MarAntoniaAuthzError("No tienes acceso a este perfil", 403);
  return caregiver;
}

// For routes that aren't scoped to a specific child id in the URL (e.g.
// logging an activity) -- resolves the caller's own child the same way
// mar-antonia/(guarded)/layout.tsx does (first caregiver relationship; this
// app only ever guides a user through one child).
export async function requireAnyChild(userId: string) {
  const caregiver = await prisma.childCaregiver.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  if (!caregiver) throw new MarAntoniaAuthzError("No perteneces a ningún perfil", 404);
  return caregiver;
}

export function authzErrorResponse(e: unknown): NextResponse {
  if (e instanceof MarAntoniaAuthzError) return NextResponse.json({ error: e.message }, { status: e.status });
  throw e;
}
