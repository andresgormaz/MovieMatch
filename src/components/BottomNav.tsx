import { auth } from "@/lib/auth";
import { BottomNavLinks } from "@/components/BottomNavLinks";

// Same self-contained "check the session, render nothing if logged out"
// shape as Navbar -- no point in a tab bar before/without a session.
export async function BottomNav() {
  const session = await auth();
  if (!session?.user) return null;
  return <BottomNavLinks />;
}
