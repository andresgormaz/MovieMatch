import Link from "next/link";
import { auth } from "@/lib/auth";
import { countUnseenReceived } from "@/lib/friends";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-social-main"]',
    title: "Amigos y grupos",
    body: "Amigos es para mandar un título puntual; grupos combina el gusto de todos para recomendaciones conjuntas.",
  },
];

export default async function SocialPage() {
  const session = await auth();
  const userId = session!.user.id;
  const pendingFriends = await countUnseenReceived(userId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="social" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">Social</h1>
        <p className="mt-1 text-sm text-muted">Comparte y descubre junto a otras personas.</p>
      </div>

      <div data-tour="tour-social-main" className="grid grid-cols-2 gap-2.5">
        <Link
          href="/friends"
          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
        >
          Amigos
          {pendingFriends > 0 && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
              {pendingFriends > 99 ? "99+" : pendingFriends}
            </span>
          )}
        </Link>
        <Link
          href="/groups"
          className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:border-accent"
        >
          Grupos
          <span aria-hidden className="text-muted">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
