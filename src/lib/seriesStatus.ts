// Spanish labels for TMDB's raw TV `status` field, and small formatters for
// showing seasons/status consistently across every card and the title
// detail page.
const SERIES_STATUS_LABELS: Record<string, string> = {
  "Returning Series": "En emisión",
  Planned: "Planeada",
  "In Production": "En producción",
  Ended: "Finalizada",
  Canceled: "Cancelada",
  Pilot: "Piloto",
};

export function seriesStatusLabel(status: string | null): string | null {
  if (!status) return null;
  return SERIES_STATUS_LABELS[status] ?? status;
}

export function seasonsLabel(seasonsCount: number | null): string | null {
  if (!seasonsCount) return null;
  return seasonsCount === 1 ? "1 temporada" : `${seasonsCount} temporadas`;
}

// Short "3 temporadas · Finalizada" summary for cards -- null when there's
// nothing to show (movies, or a series whose status hasn't been backfilled
// yet), so callers can just conditionally render it.
export function seasonsSummary(seasonsCount: number | null, status: string | null): string | null {
  const seasons = seasonsLabel(seasonsCount);
  const statusText = seriesStatusLabel(status);
  if (seasons && statusText) return `${seasons} · ${statusText}`;
  return seasons ?? statusText;
}
