import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tmdbPosterUrl } from "@/lib/tmdb";
import { displayTitleName } from "@/lib/titleDisplay";
import { Poster } from "@/components/Poster";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-top-list"]',
    title: "Tu top 5",
    body: "Las mejores películas y series según las notas que les pusiste -- toca cualquiera para ver su ficha.",
  },
];

async function topByType(userId: string, type: "MOVIE" | "SERIES", useOriginalTitles: boolean) {
  const ratings = await prisma.userTitleRating.findMany({
    where: { userId, seen: true, score: { not: null }, title: { type } },
    orderBy: { score: "desc" },
    take: 5,
    include: {
      title: {
        include: {
          genres: { include: { genre: true } },
        },
      },
    },
  });
  return ratings.map((r) => ({
    id: r.title.id,
    name: displayTitleName(r.title, useOriginalTitles),
    releaseYear: r.title.releaseYear,
    posterUrl: tmdbPosterUrl(r.title.posterPath),
    genres: r.title.genres.map((g) => g.genre.name),
    score: r.score!,
  }));
}

export default async function TopPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { originalTitles: true } });
  const useOriginalTitles = user?.originalTitles ?? false;

  const [topMovies, topSeries] = await Promise.all([
    topByType(userId, "MOVIE", useOriginalTitles),
    topByType(userId, "SERIES", useOriginalTitles),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="top" steps={TOUR_STEPS} />
      <div>
        <h1 className="text-2xl font-bold">Tu top 5</h1>
        <p className="mt-1 text-sm text-muted">Según las notas que les pusiste a las que ya viste.</p>
      </div>

      <div data-tour="tour-top-list" className="flex flex-col gap-8">
        <TopSection title="Películas" items={topMovies} />
        <TopSection title="Series" items={topSeries} />
      </div>
    </div>
  );
}

interface TopItem {
  id: string;
  name: string;
  releaseYear: number | null;
  posterUrl: string | null;
  genres: string[];
  score: number;
}

function TopSection({ title, items }: { title: string; items: TopItem[] }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Todavía no calificaste ninguna. Ve a{" "}
          <Link href="/onboarding/titles" className="text-white underline">
            calificar títulos
          </Link>{" "}
          para que aparezcan aquí.
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {items.map((item, i) => (
            <li key={item.id}>
              <Link href={`/title/${item.id}`} className="group flex flex-col gap-1.5">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg shadow-black/40 transition-transform group-hover:scale-[1.02]">
                  <Poster name={item.name} posterUrl={item.posterUrl} />
                  <span className="absolute top-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-bold text-green-400">
                    {item.score}/5
                  </span>
                </div>
                <p className="truncate text-xs font-medium text-white group-hover:underline" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-muted">{item.releaseYear ?? ""}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
