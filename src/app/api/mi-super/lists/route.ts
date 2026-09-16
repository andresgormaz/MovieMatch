import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAnyHousehold, authzErrorResponse } from "@/lib/miSuper/authz";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let membership;
  try {
    membership = await requireAnyHousehold(session.user.id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const lists = await prisma.shoppingList.findMany({
    where: { householdId: membership.householdId },
    orderBy: [{ plannedAt: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ lists });
}

const createSchema = z.object({
  title: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  plannedAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let membership;
  try {
    membership = await requireAnyHousehold(session.user.id, "EDITOR");
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const list = await prisma.shoppingList.create({
    data: {
      householdId: membership.householdId,
      title: parsed.data.title,
      plannedAt: parsed.data.plannedAt ? new Date(parsed.data.plannedAt) : null,
    },
  });
  return NextResponse.json({ list }, { status: 201 });
}
