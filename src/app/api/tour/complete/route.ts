import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Marks the home coach-mark tutorial as seen, whether the user finished it
// or hit "Saltar" partway through -- either way it shouldn't show again.
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tourSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
