import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CountrySelector } from "@/components/CountrySelector";

export default async function DashboardPage() {
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

  const onboardingDone = Boolean(user?.onboardingCompletedAt);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola{user?.name ? `, ${user.name}` : ""} 👋</h1>
        <p className="mt-1 text-sm text-muted">Este es tu progreso en MovieMatch.</p>
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

      <Link
        href="/top"
        className="rounded-xl border border-white/15 bg-surface px-6 py-4 text-center font-bold text-white hover:border-white/30 transition-colors"
      >
        Ver mi top 5 películas y series →
      </Link>

      <CountrySelector initialCountry={user?.country ?? null} />

      {onboardingDone ? (
        <Link
          href="/recommendations"
          className="rounded-xl bg-accent px-6 py-4 text-center font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Ver mis recomendaciones →
        </Link>
      ) : (
        <Link
          href="/onboarding/titles"
          className="rounded-xl bg-accent px-6 py-4 text-center font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Continuar configuración inicial →
        </Link>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Más opciones</h2>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <QuickLink href="/explore" label="Explorar el catálogo con filtros" />
          <QuickLink href="/groups" label="Vincular cuentas y ver recomendaciones en grupo" />
          <QuickLink href="/wishlist" label='Revisar tu lista de "las voy a ver"' />
          <QuickLink href="/onboarding/titles" label="Seguir calificando películas y series" />
          <QuickLink href="/onboarding/actors" label="Seguir calificando actores y directores" />
          <QuickLink href="/onboarding/preferences" label="Ajustar géneros y países favoritos" />
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
