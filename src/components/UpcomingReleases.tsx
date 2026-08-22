import Link from "next/link";
import { Poster } from "@/components/Poster";
import type { UpcomingMovie, UpcomingSeries } from "@/lib/upcoming";

const DATE_LABEL = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

// Two separate, honestly-labeled rows rather than one blended list --
// "próximos estrenos" means something different for each: movies are
// upcoming theatrical releases (cine), series are shows already streaming
// somewhere with a new episode/season on the way. See getUpcomingReleases
// for why we don't claim to know streaming *premiere* dates.
export function UpcomingReleases({ movies, series }: { movies: UpcomingMovie[]; series: UpcomingSeries[] }) {
  if (movies.length === 0 && series.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {movies.length > 0 && (
        <Row title="🎬 Próximos estrenos de cine">
          {movies.map((m) => (
            <PosterCard key={m.id} id={m.id} name={m.name} posterUrl={m.posterUrl} type="MOVIE" date={m.releaseDate} />
          ))}
        </Row>
      )}

      {series.length > 0 && (
        <Row title="📺 Series que vuelven pronto">
          {series.map((s) => (
            <PosterCard
              key={s.id}
              id={s.id}
              name={s.name}
              posterUrl={s.posterUrl}
              type="SERIES"
              date={s.nextEpisodeAirDate}
            />
          ))}
        </Row>
      )}
    </div>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-white">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function PosterCard({
  id,
  name,
  posterUrl,
  type,
  date,
}: {
  id: string;
  name: string;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
  date: Date | null;
}) {
  return (
    <Link href={`/title/${id}`} className="flex w-24 flex-shrink-0 flex-col gap-1.5 sm:w-28">
      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg shadow-black/40">
        <Poster name={name} type={type} posterUrl={posterUrl} />
      </div>
      <p className="truncate text-xs font-medium text-white" title={name}>
        {name}
      </p>
      {date && <p className="text-[11px] text-muted">{DATE_LABEL.format(new Date(date))}</p>}
    </Link>
  );
}
