import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Wraps every MiSuper page except onboarding/join (kept as sibling routes
// outside this group specifically so they're reachable without a household
// yet -- a route group changes nothing about the URL, just which layout
// applies). Redirects to onboarding the moment someone with no household
// membership lands on any real MiSuper page. Auth itself is already
// enforced for all of /mi-super by proxy.ts, so this only needs to check
// for a household.
export default async function MiSuperGuardedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await prisma.householdMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) redirect("/mi-super/onboarding");

  return <>{children}</>;
}
