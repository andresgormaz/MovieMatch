import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireChildCaregiver, authzErrorResponse } from "@/lib/marAntonia/authz";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const child = await prisma.child.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, inviteCode: true, ownerUserId: true, birthDate: true, sex: true },
  });
  return NextResponse.json({ child });
}

// name stays required (a profile always has one); birthDate/sex are
// optional fields the growth charts and vaccine schedule need but the rest
// of the app doesn't -- omitted entirely means "don't touch," explicit null
// clears it back to unset.
const updateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80).optional(),
  birthDate: z.string().datetime().nullable().optional(),
  sex: z.enum(["MALE", "FEMALE"]).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    // No OWNER/EDITOR distinction here -- both caregivers can edit.
    await requireChildCaregiver(session.user.id, id);
  } catch (e) {
    return authzErrorResponse(e);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const child = await prisma.child.update({
    where: { id },
    data: {
      name: parsed.data.name,
      birthDate: parsed.data.birthDate === undefined ? undefined : parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,
      sex: parsed.data.sex,
    },
    select: { id: true, name: true, inviteCode: true, ownerUserId: true, birthDate: true, sex: true },
  });
  return NextResponse.json({ child });
}
