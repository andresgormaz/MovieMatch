import { prisma } from "@/lib/prisma";

// Friendship rows are unordered pairs stored in a canonical order (smaller
// id first) so there's exactly one row per pair regardless of who sent the
// invite, and no risk of a mirrored duplicate.
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  if (userId === otherId) return false;
  const [userAId, userBId] = orderedPair(userId, otherId);
  const row = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  return Boolean(row);
}

export interface FriendInfo {
  id: string;
  name: string | null;
  email: string;
  friendshipId: string;
  since: Date;
}

export async function listFriends(userId: string): Promise<FriendInfo[]> {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      userA: { select: { id: true, name: true, email: true } },
      userB: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((f) => {
    const other = f.userAId === userId ? f.userB : f.userA;
    return { id: other.id, name: other.name, email: other.email, friendshipId: f.id, since: f.createdAt };
  });
}

// How many recommendations sent TO this user are still unseen -- the badge
// count for the home "Social" block and the bottom-of-app friends entry
// point. "Seen" is marked in bulk the first time /friends is opened (see
// markReceivedAsSeen below), not per item.
export async function countUnseenReceived(userId: string): Promise<number> {
  return prisma.sentRecommendation.count({ where: { toUserId: userId, seenAt: null } });
}

export async function markReceivedAsSeen(userId: string): Promise<void> {
  await prisma.sentRecommendation.updateMany({
    where: { toUserId: userId, seenAt: null },
    data: { seenAt: new Date() },
  });
}
