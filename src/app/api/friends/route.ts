import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { displayTitleName } from "@/lib/titleDisplay";
import { listFriends, markReceivedAsSeen } from "@/lib/friends";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userId = session.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { friendCode: true, originalTitles: true } });
  const useOriginalTitles = user?.originalTitles ?? false;

  const [friends, received] = await Promise.all([
    listFriends(userId),
    prisma.sentRecommendation.findMany({
      where: { toUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        fromUser: { select: { name: true, email: true } },
        title: { select: { id: true, name: true, originalName: true, type: true, posterPath: true, releaseYear: true } },
      },
    }),
  ]);

  // Opening the list is what clears the unread badge -- see markReceivedAsSeen.
  await markReceivedAsSeen(userId);

  return NextResponse.json({
    friendCode: user?.friendCode ?? null,
    friends,
    received: received.map((r) => ({
      id: r.id,
      from: r.fromUser.name || r.fromUser.email,
      createdAt: r.createdAt,
      title: {
        id: r.title.id,
        name: displayTitleName(r.title, useOriginalTitles),
        type: r.title.type,
        posterUrl: tmdbPosterUrl(r.title.posterPath),
        releaseYear: r.title.releaseYear,
      },
    })),
  });
}
