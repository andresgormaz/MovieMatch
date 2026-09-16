import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ titleId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { titleId } = await params;
  await prisma.wishlist.deleteMany({ where: { userId: session.user.id, titleId } });

  return NextResponse.json({ ok: true });
}
