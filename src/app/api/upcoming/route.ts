import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingReleases } from "@/lib/upcoming";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true, originalTitles: true },
  });

  const data = await getUpcomingReleases({
    userCountry: user?.country ?? null,
    useOriginalTitles: user?.originalTitles ?? false,
  });

  return NextResponse.json(data);
}
