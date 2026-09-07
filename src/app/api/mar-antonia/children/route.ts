import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().max(80).optional(),
  role: z.enum(["MAMA", "PAPA"]),
});

// Creates a child profile, makes the caller its owner, and links them as a
// caregiver with the role they picked. A user isn't restricted to one child
// at the data level, but this app's UI only ever guides them through
// creating/joining a single one (see mar-antonia/(guarded)/layout.tsx).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const child = await prisma.child.create({
    data: {
      name: parsed.data.name || undefined, // undefined omits the field, letting the schema's default ("MarAntonia") apply
      ownerUserId: session.user.id,
      caregivers: { create: { userId: session.user.id, role: parsed.data.role } },
    },
  });

  return NextResponse.json({ child }, { status: 201 });
}
