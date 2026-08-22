"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Poster } from "@/components/Poster";
import { PageTour } from "@/components/PageTour";
import type { TourStep } from "@/components/TourOverlay";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="tour-person-filmography"]',
    title: "Su filmografía",
    body: "Toca cualquier título para ir a su ficha -- así puedes navegar entre personas y títulos relacionados.",
  },
];

interface FilmographyItem {
  id: string;
  name: string;
  type: "MOVIE" | "SERIES";
  releaseYear: number | null;
  posterUrl: string | null;
  roles: string[];
}

interface PersonDetail {
  id: string;
  name: string;
  photoUrl: string | null;
  knownForDepartment: string | null;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  filmography: FilmographyItem[];
}

// Birthdays/deathdays are stored as UTC midnight with no meaningful time
// component -- format in UTC so a Chile (UTC-3/-4) browser doesn't roll the
// date back by a day.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/people/${id}`);
        if (!res.ok) throw new Error("not found");
        setPerson(await res.json());
      } catch {
        setError("No pudimos cargar esta ficha. Inténtalo de nuevo en un momento.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Cargando…</p>;
  }
  if (error || !person) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
        <BackButton onClick={() => router.back()} />
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {error ?? "No encontramos a esta persona."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <PageTour pageKey="personDetail" steps={TOUR_STEPS} />
      <BackButton onClick={() => router.back()} />

      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-full bg-white/10">
          {person.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-neutral-500">
              {person.name.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{person.name}</h1>
          {person.knownForDepartment && <p className="mt-0.5 text-sm text-muted">{person.knownForDepartment}</p>}
          {(person.birthday || person.deathday) && (
            <p className="mt-2 text-sm text-neutral-300">
              {person.birthday && (
                <>
                  Nacimiento: {formatDate(person.birthday)}
                  {person.placeOfBirth ? ` en ${person.placeOfBirth}` : ""}
                </>
              )}
              {person.birthday && person.deathday && <br />}
              {person.deathday && <>Fallecimiento: {formatDate(person.deathday)}</>}
            </p>
          )}
        </div>
      </div>

      {person.biography ? (
        <p className="text-sm leading-relaxed text-neutral-200">{person.biography}</p>
      ) : (
        <p className="text-sm text-muted">No hay biografía disponible.</p>
      )}

      {person.filmography.length > 0 && (
        <div data-tour="tour-person-filmography">
          <h2 className="mb-3 text-lg font-bold text-white">Filmografía</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {person.filmography.map((f) => (
              <Link key={f.id} href={`/title/${f.id}`} className="group flex flex-col gap-1.5">
                <div className="aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg shadow-black/40 transition-transform group-hover:scale-[1.02]">
                  <Poster name={f.name} type={f.type} posterUrl={f.posterUrl} />
                </div>
                <p className="truncate text-xs text-white group-hover:underline" title={f.name}>
                  {f.name}
                </p>
                <p className="truncate text-[11px] text-muted">
                  {f.releaseYear ?? ""} {f.releaseYear ? "· " : ""}
                  {f.roles.join(", ")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Volver"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:bg-white/10"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
