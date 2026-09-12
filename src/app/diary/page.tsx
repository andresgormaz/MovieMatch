import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { Poster } from "@/components/Poster";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { StarDisplay } from "@/components/StarRating";
import { watchProgressLabel } from "@/lib/seriesStatus";

const MONTH_LABEL = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const DAY_LABEL = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

// The data was always there (every rating carries a date) -- this just
// surfaces it as a timeline instead of leaving it locked inside individual
// title pages, the way the wishlist already does for "quiero ver".
export default async function DiaryPage() {
  const session = await auth();
  const userId = session!.user.id;

  const ratings = await prisma.userTitleRating.findMany({
    where: { userId },
    include: { title: { select: { id: true, name: true, type: true, releaseYear: true, posterPath: true } } },
    orderBy: { ratedAt: "desc" },
    take: 300,
  });

  const groups: { label: string; items: typeof ratings }[] = [];
  for (const r of ratings) {
    const label = MONTH_LABEL.format(r.ratedAt);
    const group = groups[groups.length - 1];
    if (group?.label === label) {
      group.items.push(r);
    } else {
      groups.push({ label, items: [r] });
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Mi diario</h1>
        <p className="mt-1 text-sm text-muted">Todo lo que calificaste, en orden.</p>
      </div>

      {ratings.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Todavía no calificaste nada. A medida que marques títulos como vistos, van a aparecer aquí.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <h2 className="mb-2 text-sm font-semibold capitalize text-white">{group.label}</h2>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {group.items.map((r) => (
              <Link
                key={r.id}
                href={`/title/${r.title.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-hover"
              >
                <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded">
                  <Poster name={r.title.name} type={r.title.type} posterUrl={tmdbPosterUrl(r.title.posterPath)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{r.title.name}</p>
                  <p className="text-xs text-muted">
                    {r.title.type === "MOVIE" ? "Película" : "Serie"}
                    {r.title.releaseYear ? ` · ${r.title.releaseYear}` : ""} · {DAY_LABEL.format(r.ratedAt)}
                  </p>
                </div>
                {r.seen ? (
                  <span className="flex flex-shrink-0 flex-col items-end gap-0.5">
                    <span className="rounded bg-accent/20 px-2 py-1 text-xs font-bold text-accent">
                      {r.score != null ? <StarDisplay score={r.score} /> : "Vista"}
                    </span>
                    {watchProgressLabel(r.watchProgress) && (
                      <span className="text-[10px] text-muted">{watchProgressLabel(r.watchProgress)}</span>
                    )}
                  </span>
                ) : (
                  <span className="flex-shrink-0 rounded bg-white/10 px-2 py-1 text-xs font-medium text-neutral-400">
                    {r.notInterested ? "No me interesa" : "No la he visto"}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
