import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Google sign-in always lands here first (see the callbackUrl passed to
// signIn("google", ...)) so we can route based on how far along the
// account is, instead of dropping everyone on the dashboard -- a brand
// new Google account has no country yet (register.tsx normally collects
// that before onboarding starts; Google skips straight past that form).
export default async function AfterGooglePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true, onboardingCompletedAt: true },
  });

  if (!user?.country) redirect("/onboarding/country");
  if (!user.onboardingCompletedAt) redirect("/onboarding/titles");
  redirect("/");
}
