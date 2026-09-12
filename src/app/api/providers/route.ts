import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { country: true } });
  if (!user?.country) return NextResponse.json({ providers: [], userCountry: null });

  const rows = await prisma.titleProvider.findMany({
    where: { countryCode: user.country },
    select: { provider: { select: { id: true, name: true, logoPath: true } } },
    distinct: ["providerId"],
  });

  const providers = rows
    .map((r) => r.provider)
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ providers, userCountry: user.country });
}
