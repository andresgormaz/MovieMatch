import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFriends } from "@/lib/friends";

// Just the friend list, no side effects -- unlike GET /api/friends (which
// also marks received recommendations as seen), this is safe to call from
// anywhere that just needs "who can I send this to" (e.g. the title detail
// page's friend picker) without silently clearing the /friends unread badge.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const friends = await listFriends(session.user.id);
  return NextResponse.json({ friends });
}
