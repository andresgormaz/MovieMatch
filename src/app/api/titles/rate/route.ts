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

  // Once rated (watched or "not interested"), it no longer belongs in the
  // wishlist -- covers both the wishlist page's own "already watched"
  // button and rating something from Explore/Recommendations that happened
  // to be on the list.
  const [rating] = await prisma.$transaction([
    prisma.userTitleRating.upsert({
      where: { userId_titleId: { userId, titleId } },
      update: { seen, score: seen ? score : null },
      create: { userId, titleId, seen, score: seen ? score : null },
    }),
    prisma.wishlist.deleteMany({ where: { userId, titleId } }),
  ]);

  return NextResponse.json({ rating });
}
