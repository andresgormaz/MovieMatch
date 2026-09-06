import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { DEFAULT_CATEGORIES } from "@/lib/miSuper/categories";

const createSchema = z.object({ name: z.string().trim().max(80).optional() });

// Creates a household, makes the caller its OWNER, and seeds the default
// category list -- so a brand-new household's first list isn't a wall of
// uncategorized items. A user isn't restricted to one household at the data
// level, but Fase 1's UI only ever guides them through creating/joining a
// single one (see mi-super/(guarded)/layout.tsx's membership check).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const household = await prisma.household.create({
    data: {
      name: parsed.data.name || null,
      ownerUserId: session.user.id,
      members: { create: { userId: session.user.id, role: "OWNER" } },
      categories: { create: DEFAULT_CATEGORIES.map((name, i) => ({ name, sortOrder: i })) },
    },
  });

  return NextResponse.json({ household }, { status: 201 });
}
