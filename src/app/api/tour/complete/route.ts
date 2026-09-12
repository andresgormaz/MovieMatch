import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Marks a coach-mark tutorial as seen, whether the user finished it or hit
// "Saltar" partway through -- either way it shouldn't show again. No
// pageKey (or pageKey "home") means the original home tour, tracked on
// User.tourSeenAt; any other pageKey is a per-page tour tracked in
// UserPageTourSeen (see PageTour.tsx).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const pageKey = typeof body?.pageKey === "string" ? body.pageKey : undefined;

  if (!pageKey || pageKey === "home") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { tourSeenAt: new Date() },
    });
  } else {
    await prisma.userPageTourSeen.upsert({
      where: { userId_pageKey: { userId: session.user.id, pageKey } },
      update: { seenAt: new Date() },
      create: { userId: session.user.id, pageKey },
    });
  }

  return NextResponse.json({ ok: true });
}

// Clears the "seen" flag so a tutorial shows again -- lets a user replay it
// (e.g. from Perfil) without needing a fresh account.
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const pageKey = typeof body?.pageKey === "string" ? body.pageKey : undefined;

  if (!pageKey || pageKey === "home") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { tourSeenAt: null },
    });
  } else {
    await prisma.userPageTourSeen.deleteMany({
      where: { userId: session.user.id, pageKey },
    });
  }

  return NextResponse.json({ ok: true });
}
