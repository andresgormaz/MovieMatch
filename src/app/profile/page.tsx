import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CountrySelector } from "@/components/CountrySelector";
import { TitleLanguageToggle } from "@/components/TitleLanguageToggle";
import { BackToHomeLink } from "@/components/BackToHomeLink";
import { ReplayTourButton } from "@/components/ReplayTourButton";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [
    titleCount,
    personCount,
    genreCount,
    countryCount,
    totalTitles,
    user,
    moviesWatched,
    moviesWishlist,
    seriesWatched,
    seriesWishlist,
  ] = await Promise.all([
    prisma.userTitleRating.count({ where: { userId } }),
    prisma.userPersonRating.count({ where: { userId } }),
    prisma.userGenrePreference.count({ where: { userId } }),
    prisma.userCountryPreference.count({ where: { userId } }),
    prisma.title.count(),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.userTitleRating.count({ where: { userId, seen: true, title: { type: "MOVIE" } } }),
    prisma.wishlist.count({ where: { userId, title: { type: "MOVIE" } } }),
    prisma.userTitleRating.count({ where: { userId, seen: true, title: { type: "SERIES" } } }),
    prisma.wishlist.count({ where: { userId, title: { type: "SERIES" } } }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <BackToHomeLink />
      <div>
        <h1 className="text-2xl font-bold">Perfil y estadísticas</h1>
        <p className="mt-1 text-sm text-muted">
          {user?.name ? `${user.name} · ` : ""}
          {user?.email}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Títulos calificados" value={`${titleCount}/${totalTitles}`} />
        <Stat label="Personas calificadas" value={personCount} />
        <Stat label="Géneros con preferencia" value={genreCount} />
        <Stat label="Países con preferencia" value={countryCount} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Mi actividad</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Películas vistas" value={moviesWatched} />
          <Stat label="Películas por ver" value={moviesWishlist} />
          <Stat label="Series vistas" value={seriesWatched} />
          <Stat label="Series por ver" value={seriesWishlist} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CountrySelector initialCountry={user?.country ?? null} />
        <TitleLanguageToggle initialOriginal={user?.originalTitles ?? false} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Ajustar mi gusto</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <QuickLink href="/top" label="Ver mi top 5 películas y series" />
          <QuickLink href="/diary" label="Ver mi diario de calificaciones" />
          <QuickLink href="/rate" label="Calificar lo que ya viste" />
          <QuickLink href="/vs" label='Seguir con "¿cuál te gusta más?"' />
          <QuickLink href="/onboarding/actors" label="Seguir calificando actores y directores" />
          <QuickLink href="/tastes" label="Ver y editar mis gustos" />
          <QuickLink href="/groups" label="Vincular cuentas y ver recomendaciones en grupo" />
          <ReplayTourButton />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-white/30 hover:bg-surface-hover hover:text-white"
    >
      {label}
      <span aria-hidden className="text-muted">
        →
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
