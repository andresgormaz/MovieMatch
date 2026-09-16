import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Deliberately not done inside the dashboard Server Component's render:
// rendering can be triggered more than once for the same "visit" (route
// prefetching, React re-renders), and a write inside render would corrupt
// the homeVisitedAt baseline the "new since your last visit" count depends
// on. This only runs when the client actually mounts and fires it.
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { homeVisitedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
