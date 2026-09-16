import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Whether the current user has already seen a given page's coach-mark tour
// (see PageTour.tsx). "home" isn't handled here -- the home tour's own seen
// state is computed server-side in dashboard/page.tsx from User.tourSeenAt.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pageKey = searchParams.get("pageKey");
  if (!pageKey) return NextResponse.json({ error: "Falta pageKey" }, { status: 400 });

  const row = await prisma.userPageTourSeen.findUnique({
    where: { userId_pageKey: { userId: session.user.id, pageKey } },
  });

  return NextResponse.json({ seen: Boolean(row) });
}
