"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RecommendationCard, type Recommendation } from "@/components/RecommendationCard";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { NewsCard } from "@/components/NewsCard";
import { ReviewCard } from "@/components/ReviewCard";
import {
  FilterPanel,
  EMPTY_CATALOG_FILTERS,
  buildCatalogQuery,
  type CatalogFilters,
  type Genre,
  type Country,
  type Provider,
  type SavedFilterEntry,
} from "@/components/explore/FilterPanel";
import { loadStoredFilters, storeFilters, clearStoredFilters } from "@/lib/filterStorage";
import { useSavedFilters } from "@/lib/useSavedFilters";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";
import type { NewsListItem } from "@/lib/news";
import type { ReviewListItem } from "@/lib/reviews";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-foryou-tabs"]',
    title: "Recomendaciones, noticias y reseñas",
    body: "Todo lo que armamos para ti vive acá, en tres pestañas.",
  },
  {
    selector: '[data-tour="tour-rec-filters"]',
    title: "Filtra tus recomendaciones",
    body: "Por género, plataforma, año, puntaje y más. Se guardan para la próxima vez que entres.",
  },
  {
    selector: '[data-tour="tour-rec-list"]',
    title: "Reacciona a cada una",
    body: "No me interesa, la voy a ver o ya la vi -- cada respuesta afina las siguientes recomendaciones.",
  },
];

type Tab = "recomendaciones" | "noticias" | "resenas";

export default function RecommendationsPage() {
  const [tab, setTab] = useState<Tab>("recomendaciones");

  const [genres, setGenres] = useState<Genre[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_CATALOG_FILTERS);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string | null>(null);
  const { savedFilters, saveError, save, remove } = useSavedFilters();

  const [news, setNews] = useState<NewsListItem[] | null>(null);
  const [newsError, setNewsError] = useState(false);
  const [reviews, setReviews] = useState<ReviewListItem[] | null>(null);
  const [reviewsError, setReviewsError] = useState(false);

  useEffect(() => {
    (async () => {
      const [genresRes, countriesRes, providersRes] = await Promise.all([
        fetch("/api/genres"),
        fetch("/api/countries"),
        fetch("/api/providers"),
      ]);
      setGenres((await genresRes.json()).genres);
      setCountries((await countriesRes.json()).countries);
      setProviders((await providersRes.json()).providers);
    })();
  }, []);

  const load = useCallback(async (f: CatalogFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildCatalogQuery(f);
      const res = await fetch(`/api/recommendations?${params.toString()}`);
      if (!res.ok) {
        throw new Error("No se pudieron cargar las recomendaciones");
      }
      const data = await res.json();
      setRecs(data.recommendations);
    } catch {
      setError("No se pudieron cargar las recomendaciones. Inténtalo de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = loadStoredFilters("recommendations") ?? EMPTY_CATALOG_FILTERS;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted filters + fetch on mount
    setFilters(stored);
    load(stored);
  }, [load]);

  // Noticias/Reseñas are fetched lazily, once, the first time each tab is
  // actually opened -- both do real work server-side (news relevance
  // scoring, TMDB review lookups), no reason to pay for either on a visit
  // that only ever looks at Recomendaciones.
  useEffect(() => {
    if (tab === "noticias" && news === null) {
      fetch("/api/news")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => setNews(data.news))
        .catch(() => setNewsError(true));
    }
    if (tab === "resenas" && reviews === null) {
      fetch("/api/reviews")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => setReviews(data.reviews))
        .catch(() => setReviewsError(true));
    }
  }, [tab, news, reviews]);

  function applyFilters() {
    storeFilters("recommendations", filters);
    load(filters);
  }

  function clearFilters() {
    clearStoredFilters("recommendations");
    setActiveSavedFilterId(null);
    setFilters(EMPTY_CATALOG_FILTERS);
    load(EMPTY_CATALOG_FILTERS);
  }

  function changeFilters(updater: (prev: CatalogFilters) => CatalogFilters) {
    setActiveSavedFilterId(null);
    setFilters(updater);
  }

  function applySavedFilters(entry: SavedFilterEntry) {
    setActiveSavedFilterId(entry.id);
    setFilters(entry.filters);
    storeFilters("recommendations", entry.filters);
    load(entry.filters);
  }

  async function saveCurrentFilters(name: string) {
    const saved = await save(name, filters);
    if (saved) {
      setActiveSavedFilterId(saved.id);
      applyFilters();
    }
  }

  function handleRated(titleId: string) {
    setRecs((prev) => prev.filter((r) => r.id !== titleId));
  }

  const relevantNews = news?.filter((n) => n.relevant) ?? [];
  const restNews = news?.filter((n) => !n.relevant) ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
      <BackToHomeLink />
      <PageTour pageKey="recommendations" steps={TOUR_STEPS} />

      <div>
        <h1 className="text-2xl font-bold">Para ti</h1>
        <p className="mt-1 text-sm text-muted">Recomendaciones, noticias y reseñas a tu medida.</p>
      </div>

      <div data-tour="tour-foryou-tabs" role="tablist" className="flex gap-1 border-b border-border">
        <TabButton active={tab === "recomendaciones"} onClick={() => setTab("recomendaciones")}>
          Recomendaciones
        </TabButton>
        <TabButton active={tab === "noticias"} onClick={() => setTab("noticias")}>
          Noticias
        </TabButton>
        <TabButton active={tab === "resenas"} onClick={() => setTab("resenas")}>
          Reseñas
        </TabButton>
      </div>

      {tab === "recomendaciones" && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside data-tour="tour-rec-filters" className="flex-shrink-0 lg:w-72">
            <div className="lg:sticky lg:top-20">
              <FilterPanel
                filters={filters}
                onChange={changeFilters}
                genres={genres}
                countries={countries}
                providers={providers}
                onApply={applyFilters}
                onClear={clearFilters}
                savedFilters={savedFilters}
                activeSavedFilterId={activeSavedFilterId}
                onApplySaved={applySavedFilters}
                onDeleteSaved={remove}
                onSaveCurrent={saveCurrentFilters}
                saveError={saveError}
              />
            </div>
          </aside>

          <div className="flex-1">
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link href="/explore" className="text-accent-hover hover:underline">
                Explorar catálogo completo →
              </Link>
              <Link href="/wishlist" className="text-accent-hover hover:underline">
                Mi lista →
              </Link>
              <Link href="/whats-new" className="text-accent-hover hover:underline">
                Novedades para ti →
              </Link>
            </div>

            <div data-tour="tour-rec-list" className="flex flex-col gap-3">
              {loading && <p className="text-center text-sm text-muted">Cargando…</p>}
              {error && (
                <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                  {error}
                </p>
              )}
              {!loading && !error && recs.length === 0 && (
                <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                  No encontramos más recomendaciones nuevas por ahora. Califica más títulos, actores o
                  géneros para descubrir más.
                </p>
              )}
              {recs.map((r) => (
                <RecommendationCard key={r.id} rec={r} onRated={handleRated} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "noticias" && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          {news === null && !newsError && <p className="text-center text-sm text-muted">Cargando…</p>}
          {newsError && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              No pudimos traer noticias por ahora. Vuelve a intentarlo en un rato.
            </p>
          )}
          {news !== null && news.length === 0 && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              No pudimos traer noticias por ahora. Vuelve a intentarlo en un rato.
            </p>
          )}
          {relevantNews.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Noticias relacionadas con lo que te gusta.</p>
              <div className="flex flex-col gap-3">
                {relevantNews.map((n) => (
                  <NewsCard key={n.id} item={n} />
                ))}
              </div>
            </div>
          )}
          {restNews.length > 0 && (
            <div className="flex flex-col gap-3">
              {relevantNews.length > 0 && <h2 className="text-lg font-bold text-white">Más noticias</h2>}
              <div className="flex flex-col gap-3">
                {restNews.map((n) => (
                  <NewsCard key={n.id} item={n} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "resenas" && (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {reviews === null && !reviewsError && <p className="text-center text-sm text-muted">Cargando…</p>}
          {reviewsError && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              No pudimos traer reseñas por ahora. Vuelve a intentarlo en un rato.
            </p>
          )}
          {reviews !== null && reviews.length === 0 && (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              Todavía no encontramos reseñas para lo que más te recomendamos. Sigue calificando para
              afinar tus recomendaciones y vuelve a intentarlo.
            </p>
          )}
          {reviews !== null && reviews.length > 0 && (
            <>
              <p className="text-sm text-muted">De las películas y series que más te recomendamos.</p>
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
        active ? "border-accent text-white" : "border-transparent text-muted hover:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
