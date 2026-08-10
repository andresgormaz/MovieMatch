import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [titleCount, personCount, genreCount, countryCount, totalTitles, user] = await Promise.all([
    prisma.userTitleRating.count({ where: { userId } }),
    prisma.userPersonRating.count({ where: { userId } }),
    prisma.userGenrePreference.count({ where: { userId } }),
    prisma.userCountryPreference.count({ where: { userId } }),
    prisma.title.count(),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const onboardingDone = Boolean(user?.onboardingCompletedAt);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Hola{user?.name ? `, ${user.name}` : ""} 👋</h1>
        <p className="mt-1 text-sm text-neutral-400">Este es tu progreso en MovieMatch.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Títulos calificados" value={`${titleCount}/${totalTitles}`} />
        <Stat label="Personas calificadas" value={personCount} />
        <Stat label="Géneros con preferencia" value={genreCount} />
        <Stat label="Países con preferencia" value={countryCount} />
      </div>

      {onboardingDone ? (
        <Link
          href="/recommendations"
          className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"
        >
          Ver mis recomendaciones →
        </Link>
      ) : (
        <Link
          href="/onboarding/titles"
          className="rounded-2xl bg-white px-6 py-4 text-center font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors"
        >
          Continuar configuración inicial →
        </Link>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <Link href="/onboarding/titles" className="text-neutral-400 hover:text-white transition-colors">
          → Seguir calificando películas y series
        </Link>
        <Link href="/onboarding/actors" className="text-neutral-400 hover:text-white transition-colors">
          → Seguir calificando actores y directores
        </Link>
        <Link href="/onboarding/preferences" className="text-neutral-400 hover:text-white transition-colors">
          → Ajustar géneros y países favoritos
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}
