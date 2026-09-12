import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Read-only usage snapshot per registered account -- how far they got in
// onboarding, how much they've rated, when they last opened the app. Gated
// the same way as the rest of /api/admin/* (SEED_SECRET as a query param,
// no login), not a destructive endpoint so no `confirm=` needed.
//
// There's no analytics/session-tracking in this app -- no event log, no
// "time spent" anywhere in the schema -- so this reports what's actually
// stored (counts of rated titles, last visit timestamp, etc) rather than
// fabricating a duration metric nothing here measures.
export async function GET(request: Request) {
  const secret = process.env.SEED_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SEED_SECRET no está configurada en el servidor. Agrégala en las variables de entorno." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Secreto incorrecto." }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      onboardingCompletedAt: true,
      homeVisitedAt: true,
      titleRatings: { select: { seen: true, score: true, notInterested: true } },
      personRatings: { select: { id: true } },
      wishlist: { select: { id: true } },
      onboardingChoices: { select: { skipped: true } },
      groupMemberships: { select: { group: { select: { name: true, id: true } } } },
    },
  });

  const result = users.map((u) => {
    const scored = u.titleRatings.filter((r) => r.score != null);
    const seenUnrated = u.titleRatings.filter((r) => r.seen && r.score == null).length;
    const notInterested = u.titleRatings.filter((r) => r.notInterested).length;
    const avgScore = scored.length > 0 ? scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length : null;
    const vsSkipped = u.onboardingChoices.filter((c) => c.skipped).length;

    // A single composite count of every rating/preference action taken --
    // the closest thing to "engagement" this schema actually tracks, framed
    // as actions rather than a fabricated duration.
    const totalActions = u.titleRatings.length + u.personRatings.length + u.onboardingChoices.length + u.wishlist.length;

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      onboardingCompletedAt: u.onboardingCompletedAt,
      lastVisitAt: u.homeVisitedAt,
      titlesRated: scored.length,
      titlesSeenUnrated: seenUnrated,
      notInterestedCount: notInterested,
      avgScore,
      personRatings: u.personRatings.length,
      wishlistCount: u.wishlist.length,
      vsTotal: u.onboardingChoices.length,
      vsSkipped,
      totalActions,
      groups: u.groupMemberships.map((m) => m.group.name || "Grupo sin nombre"),
    };
  });

  return NextResponse.json({ users: result });
}
