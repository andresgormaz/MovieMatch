import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savedFilterSchema } from "@/lib/validation";
import { EMPTY_CATALOG_FILTERS, type CatalogFilters } from "@/lib/catalogFilters";

// `filters` is stored as a JSON string (see SavedFilter in schema.prisma) --
// spread onto EMPTY_CATALOG_FILTERS so an older saved row missing a field
// added later (e.g. a new filter dimension) still parses into a complete,
// valid CatalogFilters instead of leaving `undefined` holes.
function parseStoredFilters(raw: string): CatalogFilters {
  try {
    return { ...EMPTY_CATALOG_FILTERS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_CATALOG_FILTERS;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.savedFilter.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    savedFilters: rows.map((r) => ({ id: r.id, name: r.name, filters: parseStoredFilters(r.filters) })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const body = await request.json().catch(() => null);
  const parsed = savedFilterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const existing = await prisma.savedFilter.findUnique({
    where: { userId_name: { userId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un filtro guardado con ese nombre." }, { status: 400 });
  }

  const created = await prisma.savedFilter.create({
    data: { userId, name: parsed.data.name, filters: JSON.stringify(parsed.data.filters) },
  });

  return NextResponse.json({
    savedFilter: { id: created.id, name: created.name, filters: parsed.data.filters },
  });
}
