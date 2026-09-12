import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().max(80).optional(),
  role: z.enum(["MAMA", "PAPA"]),
});

// Creates a child profile, makes the caller its owner, and links them as a
// caregiver with the role they picked. Blocked if the caller already
// belongs to one -- this app only ever intends one shared profile per
// couple, and silently letting someone end up with a second, disconnected
// profile is exactly the bug that caused a caregiver to stop seeing their
// partner's entries (requireAnyChild always resolves to the earliest-joined
// one, so a stray extra profile silently "wins" and hides the shared one).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const existing = await prisma.childCaregiver.findFirst({ where: { userId: session.user.id } });
  if (existing) {
    return NextResponse.json(
      { error: "Ya perteneces a un perfil de MarAntonia. No puedes crear otro." },
      { status: 400 },
    );
  }

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
