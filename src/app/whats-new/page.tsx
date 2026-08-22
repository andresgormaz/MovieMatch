import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWhatsNew } from "@/lib/whatsNew";
import { formatScore } from "@/lib/format";
import { watchProgressLabel } from "@/lib/seriesStatus";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { PosterRow, type PosterRowItem } from "@/components/PosterRow";

const AIR_DATE_LABEL = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

export default async function WhatsNewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true, originalTitles: true },
  });

  const data = await getWhatsNew(userId, {
    userCountry: user?.country ?? null,
    useOriginalTitles: user?.originalTitles ?? false,
  });

  const newMovies: PosterRowItem[] = data.newMovies.map((m) => ({
    ...m,
    subtitle: `Match: ${formatScore(m.score)}`,
  }));
  const newSeries: PosterRowItem[] = data.newSeries.map((s) => ({
    ...s,
    subtitle: `Match: ${formatScore(s.score)}`,
  }));
  const sagaMovies: PosterRowItem[] = data.sagaMovies.map((m) => ({
    ...m,
    subtitle: `Match: ${formatScore(m.score)}`,
  }));
  const resumeSeries: PosterRowItem[] = data.resumeSeries.map((s) => ({
    id: s.id,
    name: s.name,
    type: "SERIES",
    posterUrl: s.posterUrl,
    subtitle: [
      s.lastAirDate ? `Nuevo ${AIR_DATE_LABEL.format(new Date(s.lastAirDate))}` : null,
      watchProgressLabel(s.watchProgress),
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  const isEmpty = newMovies.length === 0 && newSeries.length === 0 && resumeSeries.length === 0 && sagaMovies.length === 0;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Novedades para ti</h1>
        <p className="mt-1 text-sm text-muted">Lo más nuevo, elegido según tu gusto.</p>
      </div>

      {isEmpty && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Todavía no encontramos novedades para mostrarte. Sigue calificando títulos para que esto se afine.
        </p>
      )}

      {(newMovies.length > 0 || newSeries.length > 0) && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-white">Estrenos para ti</h2>
          <PosterRow title="Películas nuevas" items={newMovies} />
          <PosterRow title="Series" items={newSeries} />
        </div>
      )}

      {resumeSeries.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Retomar series</h2>
            <p className="text-sm text-muted">Series que te encantaron y sacaron algo nuevo hace poco.</p>
          </div>
          <PosterRow items={resumeSeries} />
        </div>
      )}

      {sagaMovies.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Continúa la saga</h2>
            <p className="text-sm text-muted">Otras películas de sagas que ya empezaste a ver.</p>
          </div>
          <PosterRow items={sagaMovies} />
        </div>
      )}
    </div>
  );
}
