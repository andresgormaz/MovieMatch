import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Wraps every MarAntonia page except onboarding/join (kept as sibling routes
// outside this group specifically so they're reachable without a child
// profile yet -- a route group changes nothing about the URL, just which
// layout applies). Redirects to onboarding the moment someone with no
// caregiver relationship lands on any real MarAntonia page. Auth itself is
// already enforced for all of /mar-antonia by proxy.ts, so this only needs
// to check for a child.
export default async function MarAntoniaGuardedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const caregiver = await prisma.childCaregiver.findFirst({ where: { userId: session.user.id } });
  if (!caregiver) redirect("/mar-antonia/onboarding");

  return <>{children}</>;
}
