import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { titleRatingSchema, titleUnrateSchema } from "@/lib/validation";

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

// Lets a user fully undo having rated/marked a title -- "pasar de vista a
// no vista" (2026-08-27 request) -- back to the same clean-slate state as
// never having interacted with it (eligible for recommendations again,
// no leftover "vs"/rating evidence for it either since there's no row left
// to derive from).
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = titleUnrateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  await prisma.userTitleRating.deleteMany({ where: { userId: session.user.id, titleId: parsed.data.titleId } });

  return NextResponse.json({ ok: true });
}
