import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReviewsForUser } from "@/lib/reviews";

// Backs the "Reseñas" tab on /recommendations ("Para ti") -- fetched lazily
// client-side the first time that tab is opened, not on every page load.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { originalTitles: true, country: true } });
  const reviews = await getReviewsForUser(session.user.id, user?.originalTitles ?? false, user?.country ?? null);
  return NextResponse.json({ reviews });
}
