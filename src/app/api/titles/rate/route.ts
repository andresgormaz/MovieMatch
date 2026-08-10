import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { titleRatingSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = titleRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const { titleId, seen, score } = parsed.data;
  const userId = session.user.id;

  const rating = await prisma.userTitleRating.upsert({
    where: { userId_titleId: { userId, titleId } },
    update: { seen, score: seen ? score : null },
    create: { userId, titleId, seen, score: seen ? score : null },
  });

  return NextResponse.json({ rating });
}
