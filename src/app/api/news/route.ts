import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshNewsIfStale, getNewsForUser } from "@/lib/news";

// Backs the "Noticias" tab on /recommendations ("Para ti") -- fetched lazily
// client-side the first time that tab is opened, not on every page load.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { originalTitles: true } });
  await refreshNewsIfStale();
  const news = await getNewsForUser(session.user.id, user?.originalTitles ?? false);
  return NextResponse.json({ news });
}
