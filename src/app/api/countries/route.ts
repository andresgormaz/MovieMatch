import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countryName } from "@/lib/countries";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.title.findMany({
    where: { originCountry: { not: null } },
    select: { originCountry: true },
    distinct: ["originCountry"],
  });

  const countries = rows
    .map((r) => r.originCountry!)
    .sort()
    .map((code) => ({ code, name: countryName(code) }));

  return NextResponse.json({ countries });
}
